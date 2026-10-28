/**
 * Tests for the Copilot review collection in fetchAndFilterPullRequests.
 *
 * Run with:
 *   node --test tests/copilotReviews.test.mjs
 *
 * No npm dependencies — uses Node.js built-in test runner.
 * The GitHub GraphQL endpoint is stubbed via globalThis.fetch.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// chrome stub must exist BEFORE importing the module under test (see githubApi.test.mjs)
globalThis.chrome = {
    storage: {
        local: {
            get: (_keys, cb) => cb({ githubApiBaseUrl: 'https://api.github.test' }),
            set: (_obj, cb) => cb && cb(),
        },
    },
    runtime: { lastError: null },
};

// Build a minimal GraphQL PullRequest node with the given review authors.
function prNode(number, reviewAuthors) {
    return {
        __typename: 'PullRequest',
        id: `PR_${number}`,
        title: `PR ${number}`,
        url: `https://github.com/acme/widgets/pull/${number}`,
        number,
        isDraft: false,
        state: 'OPEN',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-26T10:00:00Z',
        repository: { name: 'widgets', owner: { login: 'acme', avatarUrl: '' } },
        author: { login: 'testuser', avatarUrl: '' },
        reviewRequests: { nodes: [] },
        labels: { nodes: [] },
        additions: 1, deletions: 1, changedFiles: 1,
        commits: { nodes: [] },
        comments: { nodes: [] },
        reviews: {
            nodes: reviewAuthors.map((login, i) => ({
                state: 'COMMENTED',
                author: { login, avatarUrl: '' },
                body: `review ${i} by ${login}`,
                bodyHTML: `<p>review ${i}</p>`,
                bodyText: `review ${i} by ${login}`,
                createdAt: `2026-10-26T0${i + 1}:00:00Z`,
                comments: { nodes: [] },
            })),
        },
    };
}

// Route GraphQL searches: only the "is:pr is:open author:" search (the `mine` bucket) returns
// PRs; every other search (reviewer, mentions, issues) is empty.
function stubFetch(authoredPrs) {
    globalThis.fetch = async (_url, opts) => {
        const query = JSON.parse(opts.body).query || '';
        const nodes = /is:pr is:open author:testuser/.test(query) ? authoredPrs : [];
        return {
            ok: true,
            status: 200,
            json: async () => ({
                data: { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } },
            }),
            text: async () => '',
        };
    };
}

const { fetchAndFilterPullRequests } = await import('../src/shared/githubApi.js');

describe('fetchAndFilterPullRequests — copilot bucket', () => {

    test('collects only reviews authored by a copilot login', async () => {
        stubFetch([
            prNode(1, ['copilot-pull-request-reviewer', 'human']),
            prNode(2, ['human']),
        ]);
        const results = await fetchAndFilterPullRequests('testuser', 'fake-token');

        assert.equal(results.copilot.length, 1);
        assert.equal(results.copilot[0].id, 'PR_1');
        assert.equal(results.copilot[0].reviews.nodes.length, 1);
        assert.equal(results.copilot[0].reviews.nodes[0].author.login, 'copilot-pull-request-reviewer');
    });

    test('matches the copilot login case-insensitively', async () => {
        stubFetch([prNode(3, ['GitHub-Copilot'])]);
        const results = await fetchAndFilterPullRequests('testuser', 'fake-token');
        assert.equal(results.copilot.length, 1);
    });

    test('is empty when no review is authored by copilot', async () => {
        stubFetch([prNode(4, ['human', 'other'])]);
        const results = await fetchAndFilterPullRequests('testuser', 'fake-token');
        assert.deepEqual(results.copilot, []);
    });

    test('does not duplicate copilot entries (the copilot bucket must not re-scan itself)', async () => {
        // Two PRs with one Copilot review each, found only via `mine`: expect exactly 2 entries.
        // Before the fix the copilot bucket re-scanned its own entries and doubled this to 4.
        stubFetch([
            prNode(5, ['copilot-pull-request-reviewer']),
            prNode(6, ['copilot-pull-request-reviewer']),
        ]);
        const results = await fetchAndFilterPullRequests('testuser', 'fake-token');

        const sourceBuckets = ['personal', 'team', 'mine', 'mentions', 'issues', 'watched'];
        const expected = sourceBuckets.reduce((n, key) =>
            n + results[key].reduce((m, pr) =>
                m + pr.reviews.nodes.filter(r => r.author.login.toLowerCase().includes('copilot')).length, 0), 0);

        assert.equal(expected, 2);
        assert.equal(results.copilot.length, expected);
        assert.deepEqual(results.copilot.map(p => p.id).sort(), ['PR_5', 'PR_6']);
    });

    test('is sorted newest first', async () => {
        const a = prNode(7, ['copilot-pull-request-reviewer']);
        const b = prNode(8, ['copilot-pull-request-reviewer']);
        a.createdAt = '2026-10-01T00:00:00Z';
        b.createdAt = '2026-10-15T00:00:00Z';
        stubFetch([a, b]);
        const results = await fetchAndFilterPullRequests('testuser', 'fake-token');

        const times = results.copilot.map(p => new Date(p.createdAt).getTime());
        const sorted = [...times].sort((x, y) => y - x);
        assert.deepEqual(times, sorted);
    });
});

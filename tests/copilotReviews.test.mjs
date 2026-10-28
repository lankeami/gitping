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
            nodes: reviewAuthors.map((entry, i) => {
                // an entry is a login (bot if it looks like a copilot/github app) or { login, __typename }
                const login = typeof entry === 'string' ? entry : entry.login;
                const __typename = typeof entry === 'string'
                    ? (login === 'human' || login === 'other' ? 'User' : 'Bot')
                    : entry.__typename;
                return {
                state: 'COMMENTED',
                author: { login, __typename, avatarUrl: '' },
                body: `review ${i} by ${login}`,
                bodyHTML: `<p>review ${i}</p>`,
                bodyText: `review ${i} by ${login}`,
                createdAt: `2026-10-26T0${i + 1}:00:00Z`,
                comments: { nodes: [] },
                };
            }),
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

const apiModule = await import('../src/shared/githubApi.js');
const { fetchAndFilterPullRequests } = apiModule;

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
    test('one copilot entry per PR even when the PR is found via several buckets', async () => {
        // The same PR is returned by every search (mine, personal, team, mentions...), so it lands in
        // several source buckets. Before dedupe this produced one identical copilot entry per bucket.
        globalThis.fetch = async (_url, opts) => ({
            ok: true, status: 200, text: async () => '',
            json: async () => ({ data: { search: { pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [prNode(9, ['copilot-pull-request-reviewer'])] } } }),
        });
        const results = await fetchAndFilterPullRequests('testuser', 'fake-token');
        const bucketsWithPr = ['personal', 'team', 'mine', 'mentions', 'issues', 'watched']
            .filter(k => results[k].some(p => p.id === 'PR_9'));
        assert.ok(bucketsWithPr.length > 1, 'precondition: PR_9 is in more than one source bucket');
        assert.equal(results.copilot.length, 1);
        assert.equal(results.copilot[0].id, 'PR_9');
    });

    test('keeps the newest copilot review when a PR has several', async () => {
        const pr = prNode(10, ['copilot-pull-request-reviewer', 'copilot-pull-request-reviewer']);
        // prNode gives the second review a later createdAt (02:00 vs 01:00)
        stubFetch([pr]);
        const results = await fetchAndFilterPullRequests('testuser', 'fake-token');
        assert.equal(results.copilot.length, 1);
        assert.equal(results.copilot[0].reviews.nodes[0].createdAt, '2026-10-26T02:00:00Z');
    });

    test('a human user whose login contains "copilot" is NOT classified as Copilot', async () => {
        stubFetch([
            prNode(11, [{ login: 'copilot-fan', __typename: 'User' }]),
            prNode(12, [{ login: 'GitHub-Copilot', __typename: 'User' }, { login: 'human', __typename: 'User' }]),
        ]);
        const results = await fetchAndFilterPullRequests('testuser', 'fake-token');
        assert.deepEqual(results.copilot, []);
    });

    test('the real Bot account is matched, even next to a human copilot-named user on the same PR', async () => {
        stubFetch([
            prNode(13, [
                { login: 'copilot-fan', __typename: 'User' },
                { login: 'copilot-pull-request-reviewer', __typename: 'Bot' },
            ]),
        ]);
        const results = await fetchAndFilterPullRequests('testuser', 'fake-token');
        assert.equal(results.copilot.length, 1);
        assert.equal(results.copilot[0].reviews.nodes[0].author.login, 'copilot-pull-request-reviewer');
        assert.equal(results.copilot[0].reviews.nodes[0].author.__typename, 'Bot');
    });

    test('a review author with no __typename is not treated as Copilot', async () => {
        const pr = prNode(14, ['copilot-pull-request-reviewer']);
        delete pr.reviews.nodes[0].author.__typename;
        stubFetch([pr]);
        const results = await fetchAndFilterPullRequests('testuser', 'fake-token');
        assert.deepEqual(results.copilot, []);
    });
});

describe('isCopilotBot', () => {
    const { isCopilotBot } = apiModule;

    test('GraphQL Bot shape matches', () => {
        assert.equal(isCopilotBot({ login: 'copilot-pull-request-reviewer', __typename: 'Bot' }), true);
    });
    test('REST bot shape matches', () => {
        assert.equal(isCopilotBot({ login: 'copilot-pull-request-reviewer[bot]', type: 'Bot' }), true);
    });
    test('human users with copilot in the login do not match (GraphQL and REST)', () => {
        assert.equal(isCopilotBot({ login: 'copilot-fan', __typename: 'User' }), false);
        assert.equal(isCopilotBot({ login: 'copilot-fan', type: 'User' }), false);
    });
    test('other bots and missing authors do not match', () => {
        assert.equal(isCopilotBot({ login: 'dependabot[bot]', type: 'Bot' }), false);
        assert.equal(isCopilotBot(null), false);
        assert.equal(isCopilotBot({}), false);
    });
});

describe('GraphQL queries request __typename on review authors', () => {
    test('the search query asks for __typename on the review author', async () => {
        let body = '';
        globalThis.fetch = async (_url, opts) => {
            body = JSON.parse(opts.body).query;
            return { ok: true, status: 200, text: async () => '',
                json: async () => ({ data: { search: { pageInfo: { hasNextPage: false }, nodes: [] } } }) };
        };
        const { GQLSearchPullRequests } = await import('../src/shared/githubGraphql.js');
        await GQLSearchPullRequests('is:pr is:open author:testuser', 'fake-token');
        assert.match(body, /reviews\(last: 15\)\s*\{\s*nodes\s*\{\s*state\s*author\s*\{\s*__typename/);
    });
});

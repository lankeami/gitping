/**
 * Tests built on a fixture shaped like the REAL GitHub GraphQL response (see the fixture's _comment).
 * Run with: node --test tests/realShape.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.chrome = {
    storage: { local: { get: (_k, cb) => cb({ githubApiBaseUrl: 'https://api.github.test' }), set: (_o, cb) => cb && cb() } },
    runtime: { lastError: null },
};

const fixture = JSON.parse(readFileSync(new URL('./fixtures/realGraphqlCopilotReview.json', import.meta.url), 'utf8'));
const { fetchAndFilterPullRequests } = await import('../src/shared/githubApi.js');

// Mirror reality: the same open PR is returned by both the `author:` search (mine) and the
// `mentions:` search (observed live: one PR in mine + mentions); other searches are empty.
function stubFetch() {
    globalThis.fetch = async (_url, opts) => {
        const q = JSON.parse(opts.body).query || '';
        const hit = /is:pr is:open (author|mentions):testuser/.test(q);
        const nodes = hit ? [structuredClone(fixture.pullRequest)] : [];
        return { ok: true, status: 200, text: async () => '',
            json: async () => ({ data: { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } }) };
    };
}

describe('real-shaped GraphQL response', () => {
    test('detects the real Copilot reviewer login and keeps only the newest Copilot review', async () => {
        stubFetch();
        const r = await fetchAndFilterPullRequests('testuser', 'fake-token');
        assert.equal(r.copilot.length, 1);
        assert.equal(r.copilot[0].reviews.nodes.length, 1);
        assert.equal(r.copilot[0].reviews.nodes[0].author.login, 'copilot-pull-request-reviewer');
        assert.equal(r.copilot[0].reviews.nodes[0].createdAt, '2025-09-30T21:03:32Z');
    });

    test('the PR lands in several source buckets but yields one copilot entry and counts once for the badge', async () => {
        stubFetch();
        const r = await fetchAndFilterPullRequests('testuser', 'fake-token');
        assert.equal(r.mine.length, 1);
        assert.equal(r.mentions.length, 1);
        const { countUniqueAcrossBuckets, BADGE_BUCKET_PRIORITY } = await import('../src/shared/dedupe.js');
        assert.equal(countUniqueAcrossBuckets(r, BADGE_BUCKET_PRIORITY).total, 1);
    });

    test('a null check-suite node (token cannot read checks) does not crash enrichment', async () => {
        stubFetch();
        const r = await fetchAndFilterPullRequests('testuser', 'fake-token');
        assert.equal(r.mine[0].card.ciStatus, 'success');
    });
});

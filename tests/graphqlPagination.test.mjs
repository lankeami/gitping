/**
 * Tests for fetchGraphQL pagination (exercised through GQLSearchPullRequests / GQLSearchIssues).
 * Run with: node --test tests/graphqlPagination.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

globalThis.chrome = {
    storage: { local: { get: (_k, cb) => cb({ githubApiBaseUrl: 'https://api.github.test' }), set: (_o, cb) => cb && cb() } },
    runtime: { lastError: null },
};

const { GQLSearchPullRequests, GQLSearchIssues } = await import('../src/shared/githubGraphql.js');

// Serve pages in order; each page reports hasNextPage until the last one. Records the `after` cursors requested.
function stubPages(pages) {
    const cursors = [];
    globalThis.fetch = async (_url, opts) => {
        const q = JSON.parse(opts.body).query;
        const m = q.match(/after: (null|"[^"]*")/);
        const after = m && m[1] !== 'null' ? JSON.parse(m[1]) : null;
        cursors.push(after);
        const idx = after ? Number(after.replace('cursor-', '')) : 0;
        const last = idx === pages.length - 1;
        return { ok: true, status: 200, text: async () => '',
            json: async () => ({ data: { search: {
                pageInfo: { hasNextPage: !last, endCursor: last ? null : `cursor-${idx + 1}` },
                nodes: pages[idx],
            } } }) };
    };
    return cursors;
}

describe('fetchGraphQL pagination', () => {
    test('returns the full concatenated array across 3 pages (not a push() length)', async () => {
        const pages = [
            [{ id: 'a1' }, { id: 'a2' }],
            [{ id: 'b1' }, { id: 'b2' }],
            [{ id: 'c1' }],
        ];
        const cursors = stubPages(pages);
        const result = await GQLSearchPullRequests('is:pr is:open author:testuser', 'fake-token');
        assert.ok(Array.isArray(result), 'result must be an array');
        assert.deepEqual(result.map(n => n.id), ['a1', 'a2', 'b1', 'b2', 'c1']);
        assert.deepEqual(cursors, [null, 'cursor-1', 'cursor-2']);
    });

    test('also works for the issue search with 2 pages', async () => {
        stubPages([[{ id: 'i1' }], [{ id: 'i2' }, { id: 'i3' }]]);
        const result = await GQLSearchIssues('is:issue is:open author:testuser', 'fake-token');
        assert.deepEqual(result.map(n => n.id), ['i1', 'i2', 'i3']);
    });

    test('a single page is returned unchanged', async () => {
        const cursors = stubPages([[{ id: 'only' }]]);
        const result = await GQLSearchPullRequests('is:pr', 'fake-token');
        assert.deepEqual(result, [{ id: 'only' }]);
        assert.equal(cursors.length, 1);
    });
});

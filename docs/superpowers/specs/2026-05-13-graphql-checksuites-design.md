# Design: GraphQL checkSuites Inline CI Status

**Date:** 2026-05-13
**Branch:** feature/cicd-status-badge (#83)
**Status:** Approved

## Problem

The CI badge feature (PR #83) introduced a separate REST call to
`/repos/{owner}/{repo}/commits/{sha}/check-runs` for every PR across the
`personal`, `mine`, `team`, and `mentions` tabs after each poll cycle. At a
1-minute polling interval this exhausted the GitHub API rate limit, causing
non-`mine` tabs to silently return empty data. The `mine` tab survived because
it is fetched first in the sequence.

## Goal

Eliminate the per-PR REST check-runs calls by folding CI status data into the
existing GraphQL query, reducing additional API requests per poll to zero.

## Chosen Approach: GraphQL `checkSuites` Inline

GitHub's GraphQL API exposes `checkSuites` on `Commit` objects. Adding it to
the existing `commits(last: 1)` block in `getPrSchema()` returns CI suite
statuses as part of the same query already made for every PR node — no extra
network requests.

`headRefOid` is retained in the schema (useful for future work).

## Design

### 1. GraphQL Schema (`src/shared/githubGraphql.js`)

Add `checkSuites(first: 10)` inside the `commit` node in `getPrSchema()`:

```graphql
commits(last: 1) {
    nodes {
        commit {
            message
            messageHeadline
            messageBody
            messageBodyHTML
            committedDate
            author {
                user {
                    login
                    avatarUrl
                }
            }
            checkSuites(first: 10) {
                nodes {
                    status        # QUEUED | IN_PROGRESS | COMPLETED
                    conclusion    # SUCCESS | FAILURE | TIMED_OUT | NEUTRAL | SKIPPED | ...
                }
            }
        }
    }
}
```

`first: 10` is sufficient for any real repo (most have 1–3 CI apps).

### 2. Data Layer (`src/shared/githubApi.js`)

**`enrichIssue()`** — map CI status from the new GraphQL data instead of
leaving it for the post-enrichment pass:

```js
const checkSuiteNodes =
    issue.commits?.nodes?.[0]?.commit?.checkSuites?.nodes ?? [];
result.card.ciStatus = aggregateCiStatus(
    checkSuiteNodes.map(s => ({
        status: s.status.toLowerCase(),
        conclusion: s.conclusion?.toLowerCase() ?? null,
    }))
);
```

The `.toLowerCase()` call normalises GitHub GraphQL's uppercase enum values
(`IN_PROGRESS`, `SUCCESS`, etc.) to the lowercase format `aggregateCiStatus`
already expects from the REST API. The pure function itself does not change.

**`fetchAndFilterPullRequests()`** — remove:
- The `CI_TABS` constant
- The `Promise.allSettled` post-enrichment CI pass
- The `fetchCheckRuns` function

`card.head_sha` (mapped from `headRefOid`) is kept on the card object.

### 3. Testing (`tests/githubApi.test.mjs`)

The existing 18-test `aggregateCiStatus` suite continues to pass unchanged.

Add a new `describe` block covering the uppercase-to-lowercase normalisation
introduced by the GraphQL path:

```js
describe('aggregateCiStatus with GraphQL checkSuites nodes (normalised)', () => {
    test('handles uppercase STATUS/CONCLUSION from GraphQL', () => {
        const runs = [{ status: 'COMPLETED', conclusion: 'SUCCESS' }]
            .map(s => ({ status: s.status.toLowerCase(),
                         conclusion: s.conclusion?.toLowerCase() ?? null }));
        assert.equal(aggregateCiStatus(runs), 'success');
    });

    test('handles in-progress GraphQL suite', () => {
        const runs = [{ status: 'IN_PROGRESS', conclusion: null }]
            .map(s => ({ status: s.status.toLowerCase(),
                         conclusion: s.conclusion?.toLowerCase() ?? null }));
        assert.equal(aggregateCiStatus(runs), 'running');
    });
});
```

## Files Changed

| File | Change |
|------|--------|
| `src/shared/githubGraphql.js` | Add `checkSuites(first: 10)` block to `getPrSchema()` |
| `src/shared/githubApi.js` | Add CI mapping in `enrichIssue()`; remove `fetchCheckRuns`, `CI_TABS`, `Promise.allSettled` CI pass |
| `tests/githubApi.test.mjs` | Add normalisation tests for GraphQL uppercase enums |

## Out of Scope

- SHA-based caching of terminal CI statuses (can be added later if needed)
- REST fallback for GitHub Enterprise instances with Checks API disabled
  (can be added if a real GHE compatibility issue is reported; `headRefOid`
  is retained to support this path)

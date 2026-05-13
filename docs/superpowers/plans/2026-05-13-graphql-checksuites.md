# GraphQL checkSuites Inline CI Status — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-PR REST check-runs calls with inline `checkSuites` data in the existing GraphQL query, eliminating extra API requests per poll cycle.

**Architecture:** Add `checkSuites(first: 10)` to the `commit` node in `getPrSchema()` so CI suite statuses arrive as part of the existing PR GraphQL query. Map the data in `enrichIssue()` using the existing `aggregateCiStatus` pure function with uppercase→lowercase normalisation. Remove `fetchCheckRuns`, `CI_TABS`, and the `Promise.allSettled` post-enrichment pass.

**Tech Stack:** Vanilla JS ES modules, GitHub GraphQL API, Node.js built-in `node:test`

---

## File Map

| File | Change |
|------|--------|
| `src/shared/githubGraphql.js` | Add `checkSuites(first: 10)` block inside `commit` node in `getPrSchema()` (lines 67–79) |
| `src/shared/githubApi.js` | (a) Add `ciStatus` field to card in `enrichIssue()` (line 494); (b) Remove orphaned JSDoc (lines 500–507); (c) Remove `fetchCheckRuns` function (lines 522–532); (d) Remove `CI_TABS` + `Promise.allSettled` CI pass (lines 621–632) |
| `tests/githubApi.test.mjs` | Add normalisation `describe` block for GraphQL uppercase enums |

---

## Task 1: Add normalisation tests

These tests verify the contract: GraphQL returns uppercase enum strings; callers must `.toLowerCase()` before passing to `aggregateCiStatus`. The tests pass immediately (the function already handles lowercase), but they pin the expected behaviour.

**Files:**
- Modify: `tests/githubApi.test.mjs`

- [ ] **Step 1: Add the normalisation describe block**

Open `tests/githubApi.test.mjs` and append this block after the closing `});` of the existing `aggregateCiStatus` describe block:

```js
describe('aggregateCiStatus with GraphQL checkSuites nodes (normalised)', () => {

    test('handles uppercase COMPLETED/SUCCESS from GraphQL', () => {
        const suites = [
            { status: 'COMPLETED', conclusion: 'SUCCESS' },
            { status: 'COMPLETED', conclusion: 'SUCCESS' },
        ];
        const runs = suites.map(s => ({
            status: s.status.toLowerCase(),
            conclusion: s.conclusion?.toLowerCase() ?? null,
        }));
        assert.equal(aggregateCiStatus(runs), 'success');
    });

    test('handles IN_PROGRESS suite from GraphQL', () => {
        const suites = [{ status: 'IN_PROGRESS', conclusion: null }];
        const runs = suites.map(s => ({
            status: s.status.toLowerCase(),
            conclusion: s.conclusion?.toLowerCase() ?? null,
        }));
        assert.equal(aggregateCiStatus(runs), 'running');
    });

    test('handles QUEUED suite from GraphQL', () => {
        const suites = [{ status: 'QUEUED', conclusion: null }];
        const runs = suites.map(s => ({
            status: s.status.toLowerCase(),
            conclusion: s.conclusion?.toLowerCase() ?? null,
        }));
        assert.equal(aggregateCiStatus(runs), 'running');
    });

    test('handles FAILURE conclusion from GraphQL', () => {
        const suites = [
            { status: 'COMPLETED', conclusion: 'SUCCESS' },
            { status: 'COMPLETED', conclusion: 'FAILURE' },
        ];
        const runs = suites.map(s => ({
            status: s.status.toLowerCase(),
            conclusion: s.conclusion?.toLowerCase() ?? null,
        }));
        assert.equal(aggregateCiStatus(runs), 'failure');
    });

    test('handles TIMED_OUT conclusion from GraphQL', () => {
        const suites = [{ status: 'COMPLETED', conclusion: 'TIMED_OUT' }];
        const runs = suites.map(s => ({
            status: s.status.toLowerCase(),
            conclusion: s.conclusion?.toLowerCase() ?? null,
        }));
        assert.equal(aggregateCiStatus(runs), 'failure');
    });

    test('handles empty checkSuites array', () => {
        assert.equal(aggregateCiStatus([]), null);
    });
});
```

- [ ] **Step 2: Run tests — expect all pass**

```bash
node --test tests/githubApi.test.mjs
```

Expected output ends with:
```
ℹ tests 24
ℹ pass 24
ℹ fail 0
```

- [ ] **Step 3: Commit**

```bash
git add tests/githubApi.test.mjs
git commit -m "feature | add GraphQL checkSuites normalisation tests (#83)"
```

---

## Task 2: Add checkSuites to GraphQL schema

**Files:**
- Modify: `src/shared/githubGraphql.js` (lines 67–79)

- [ ] **Step 1: Add `checkSuites` block inside the `commit` node**

In `getPrSchema()`, find this block (lines 67–79):

```
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
                    }
```

Replace it with:

```
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
                                status
                                conclusion
                            }
                        }
                    }
```

- [ ] **Step 2: Syntax-check the file**

```bash
node --check src/shared/githubGraphql.js
```

Expected: no output (clean).

- [ ] **Step 3: Run tests — all still pass**

```bash
node --test tests/githubApi.test.mjs
```

Expected:
```
ℹ tests 24
ℹ pass 24
ℹ fail 0
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/githubGraphql.js
git commit -m "feature | add checkSuites to GraphQL PR schema (#83)"
```

---

## Task 3: Map ciStatus in enrichIssue

**Files:**
- Modify: `src/shared/githubApi.js` (line 494)

- [ ] **Step 1: Add `ciStatus` to the card object**

In `enrichIssue()`, find the card object assignment ending at line 494–495:

```js
        head_sha: issue.headRefOid || null,
        meta: meta
    }
```

Replace with:

```js
        head_sha: issue.headRefOid || null,
        ciStatus: aggregateCiStatus(
            (issue.commits?.nodes?.[0]?.commit?.checkSuites?.nodes ?? [])
                .map(s => ({
                    status: s.status.toLowerCase(),
                    conclusion: s.conclusion?.toLowerCase() ?? null,
                }))
        ),
        meta: meta
    }
```

- [ ] **Step 2: Syntax-check the file**

```bash
node --check src/shared/githubApi.js
```

Expected: no output (clean).

- [ ] **Step 3: Run tests — all still pass**

```bash
node --test tests/githubApi.test.mjs
```

Expected:
```
ℹ tests 24
ℹ pass 24
ℹ fail 0
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/githubApi.js
git commit -m "feature | map ciStatus from GraphQL checkSuites in enrichIssue (#83)"
```

---

## Task 4: Remove the REST CI pass

Remove three things from `src/shared/githubApi.js`:
1. Orphaned JSDoc block (lines 500–507, refers to the old `fetchCheckRuns` signature)
2. The `fetchCheckRuns` async function (lines 508–532 after previous edits, or thereabouts)
3. The `CI_TABS` + `Promise.allSettled` post-enrichment block in `fetchAndFilterPullRequests`

**Files:**
- Modify: `src/shared/githubApi.js`

- [ ] **Step 1: Remove the orphaned JSDoc and `fetchCheckRuns` function**

Find and delete this entire block (the orphaned JSDoc + function):

```js
/**
 * Fetch CI check-runs for a PR's head commit and return an aggregated status.
 * @param {string} owner - Repository owner (org or user login).
 * @param {string} repo - Repository name.
 * @param {string} sha - The PR head commit SHA.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<'success'|'failure'|'running'|null>}
 */
async function fetchCheckRuns(owner, repo, sha, token) {
    try {
        const data = await fetchFromGitHub(
            `/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`,
            token
        );
        return aggregateCiStatus(data.check_runs || []);
    } catch {
        return null;
    }
}
```

- [ ] **Step 2: Remove the CI_TABS + Promise.allSettled block**

In `fetchAndFilterPullRequests()`, find and delete this entire block:

```js
    // fetch CI check-runs for PR tabs only
    const CI_TABS = ['personal', 'mine', 'team', 'mentions'];
    await Promise.allSettled(
        CI_TABS.flatMap(key =>
            (results[key] || [])
                .filter(pr => pr.card?.head_sha)
                .map(async pr => {
                    const [owner, repo] = pr.card.repo_name.split('/');
                    pr.card.ciStatus = await fetchCheckRuns(owner, repo, pr.card.head_sha, token);
                })
        )
    );
```

After deletion, `fetchAndFilterPullRequests` should flow directly from the enrichment loop to `setFirstUpdateTime()`:

```js
    // enrich all the results
    Object.keys(results).forEach((key) => {
        results[key].sort((a, b) => {
            const aTime = new Date(a.updated_at || a.updatedAt || 0).getTime();
            const bTime = new Date(b.updated_at || b.updatedAt || 0).getTime();
            return bTime - aTime;
        });
        results[key] = results[key].map(issue => enrichIssue(issue, key));
    });

    // ensure we set the first update time -- used for display purposes
    setFirstUpdateTime();

    return results;
```

- [ ] **Step 3: Syntax-check the file**

```bash
node --check src/shared/githubApi.js
```

Expected: no output (clean).

- [ ] **Step 4: Run the full test suite**

```bash
node --test tests/githubApi.test.mjs
```

Expected:
```
ℹ tests 24
ℹ pass 24
ℹ fail 0
```

- [ ] **Step 5: Commit**

```bash
git add src/shared/githubApi.js
git commit -m "feature | remove REST check-runs pass, CI status now from GraphQL (#83)"
```

---

## Task 5: Verify and push

- [ ] **Step 1: Run the full test suite one final time**

```bash
node --test tests/githubApi.test.mjs
```

Expected:
```
ℹ tests 24
ℹ pass 24
ℹ fail 0
```

- [ ] **Step 2: Confirm no stray references to fetchCheckRuns or CI_TABS**

```bash
grep -rn "fetchCheckRuns\|CI_TABS" src/
```

Expected: no output.

- [ ] **Step 3: Push the branch**

```bash
git push
```

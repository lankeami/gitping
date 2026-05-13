# CI/CD Status Badge on PR Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CI/CD status badge (✅ pass / ❌ fail / 🔄 running) to PR cards in the GitPing popup by fetching GitHub check-runs during the background polling cycle.

**Architecture:** A second pass runs `Promise.allSettled` over PR results for 4 tabs (`personal`, `mine`, `team`, `mentions`) after the existing `enrichIssue()` enrichment, fetching check-runs per PR and attaching `ciStatus` to each `pr.card`. The badge is rendered in `cardTitle()` in `uiUtils.js` after the existing status badge.

**Tech Stack:** Vanilla JavaScript (ES6 modules), Chrome Extension Manifest V3, GitHub REST Checks API (`/repos/{owner}/{repo}/commits/{sha}/check-runs`), no build step.

---

## File Map

| File | Change |
|------|--------|
| `src/shared/githubGraphql.js` | Add `headRefOid` to `getPrSchema()` — exposes the PR head commit SHA from GraphQL |
| `src/shared/githubApi.js` | Add `card.head_sha` in `enrichIssue()`; add `fetchCheckRuns()`; add second CI pass in `fetchAndFilterPullRequests()` |
| `src/shared/uiUtils.js` | Render CI badge in `cardTitle()` after the existing status badge |
| `src/shared/design-system.css` | Add `.ci-badge` base styles and modifier variants |

---

## Task 1: Create Feature Branch

- [ ] **Step 1: Create and switch to the feature branch**

```bash
git checkout -b feature/cicd-status-badge
```

Expected: `Switched to a new branch 'feature/cicd-status-badge'`

---

## Task 2: Add `headRefOid` to GraphQL PR Schema

`headRefOid` is the GitHub GraphQL field for the PR's head commit SHA. It lives on the `PullRequest` object — one field alongside the existing `commits(last: 1)` block.

**Files:**
- Modify: `src/shared/githubGraphql.js:64`

- [ ] **Step 1: Add `headRefOid` to `getPrSchema()`**

In `src/shared/githubGraphql.js`, locate the `commits(last: 1) {` block (around line 64) and add `headRefOid` immediately before it:

```js
// BEFORE:
            commits(last: 1) {

// AFTER:
            headRefOid
            commits(last: 1) {
```

The full surrounding context for precision:

```js
            labels(first: 20) {
                nodes {
                    name
                    color
                    description
                }
            }

            headRefOid
            commits(last: 1) {
                nodes {
                    commit {
```

- [ ] **Step 2: Syntax-check the file**

```bash
node --check src/shared/githubGraphql.js
```

Expected: no output (clean pass).

---

## Task 3: Pass `head_sha` Through `enrichIssue()`

`enrichIssue()` builds the `card` object used by the popup. We need `head_sha` on the card so the second CI pass can read it without touching the raw GraphQL response again.

**Files:**
- Modify: `src/shared/githubApi.js:474` (inside the `result.card = {` block)

- [ ] **Step 1: Add `head_sha` to the `card` object in `enrichIssue()`**

Locate the `result.card = {` block in `enrichIssue()` (around line 474). Add `head_sha` after the `labels` line:

```js
// BEFORE:
        labels: labels,
        meta: meta
    }

// AFTER:
        labels: labels,
        head_sha: issue.headRefOid || null,
        meta: meta
    }
```

- [ ] **Step 2: Syntax-check the file**

```bash
node --check src/shared/githubApi.js
```

Expected: no output (clean pass).

---

## Task 4: Implement `fetchCheckRuns()`

This function calls `GET /repos/{owner}/{repo}/commits/{sha}/check-runs` and aggregates all runs into a single `ciStatus`. It uses the existing `fetchFromGitHub` helper.

**Note on the API response shape:** `fetchFromGitHub` returns the raw JSON object. For this endpoint, GitHub returns `{ total_count, check_runs: [...] }` — not a plain array. Access `.check_runs` on the result. Adding `?per_page=100` keeps us under the pagination threshold (no PR has 100+ checks in practice).

**Files:**
- Modify: `src/shared/githubApi.js` — add new function before `fetchWatchedRepositories`

- [ ] **Step 1: Add `fetchCheckRuns()` to `githubApi.js`**

Locate the comment block before `fetchWatchedRepositories` (around line 499):

```js
//
//
//  WATCHED FUNCTIONS
//
//
```

Insert the new function immediately before that block:

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
        const runs = data.check_runs || [];
        if (runs.length === 0) return null;
        if (runs.some(r => r.conclusion === 'failure' || r.conclusion === 'timed_out')) return 'failure';
        if (runs.some(r => r.status === 'in_progress' || r.status === 'queued')) return 'running';
        if (runs.every(r => r.conclusion === 'success')) return 'success';
        return null;
    } catch {
        return null;
    }
}

//
//
//  WATCHED FUNCTIONS
//
//
```

- [ ] **Step 2: Syntax-check the file**

```bash
node --check src/shared/githubApi.js
```

Expected: no output (clean pass).

---

## Task 5: Add CI Second Pass in `fetchAndFilterPullRequests()`

After the existing enrichment loop, run `Promise.allSettled` over the 4 scoped tabs and attach `ciStatus` to each card. `allSettled` ensures one failed check-runs call never blocks others.

**Files:**
- Modify: `src/shared/githubApi.js` — inside `fetchAndFilterPullRequests()`, after the enrichment loop

- [ ] **Step 1: Add the second CI pass after the enrichment loop**

Locate the existing enrichment block (around line 577):

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

Replace with:

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

    // ensure we set the first update time -- used for display purposes
    setFirstUpdateTime();

    return results;
```

- [ ] **Step 2: Syntax-check the file**

```bash
node --check src/shared/githubApi.js
```

Expected: no output (clean pass).

---

## Task 6: Render CI Badge in `cardTitle()`

The badge goes after the existing `pr-status-badge` span in `cardTitle()`. No badge is rendered when `ciStatus` is absent or `null`.

**Files:**
- Modify: `src/shared/uiUtils.js:248` — after `title.appendChild(statusBadge)`

- [ ] **Step 1: Add CI badge after the status badge in `cardTitle()`**

Locate the end of `cardTitle()` (around line 248):

```js
    title.appendChild(statusBadge);
    return title;
}
```

Replace with:

```js
    title.appendChild(statusBadge);

    if (pr.ciStatus) {
        const ciEmoji = { success: '✅', failure: '❌', running: '🔄' };
        const ciBadge = document.createElement('span');
        ciBadge.className = `ci-badge ci-badge--${pr.ciStatus}`;
        ciBadge.textContent = ciEmoji[pr.ciStatus];
        ciBadge.title = `CI: ${pr.ciStatus}`;
        title.appendChild(ciBadge);
    }

    return title;
}
```

- [ ] **Step 2: Syntax-check the file**

```bash
node --check src/shared/uiUtils.js
```

Expected: no output (clean pass).

---

## Task 7: Add `.ci-badge` Styles to Design System

**Files:**
- Modify: `src/shared/design-system.css` — append at end of file

- [ ] **Step 1: Append CI badge styles**

Add to the very end of `src/shared/design-system.css`:

```css
/* ========================================
   CI/CD Status Badge
   ======================================== */

.ci-badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--font-size-xs);
  margin-left: var(--space-1);
  line-height: 1;
}

.ci-badge--success {}
.ci-badge--failure {}
.ci-badge--running {}
```

---

## Task 8: Final Syntax Check + Commit

- [ ] **Step 1: Syntax-check all modified JS files**

```bash
node --check src/shared/githubGraphql.js src/shared/githubApi.js src/shared/uiUtils.js
```

Expected: no output (clean pass on all three files).

- [ ] **Step 2: Verify `manifest.json` is unchanged**

```bash
git diff manifest.json
```

Expected: no output (no changes).

- [ ] **Step 3: Commit all changes**

```bash
git add src/shared/githubGraphql.js src/shared/githubApi.js src/shared/uiUtils.js src/shared/design-system.css
git commit -m "$(cat <<'EOF'
feature | CI/CD status badge on PR cards (#83)
EOF
)"
```

---

## Task 9: Manual Verification

Before opening the PR, verify the feature end-to-end in Chrome.

- [ ] **Step 1: Load the extension unpacked**

1. Go to `chrome://extensions/` with Developer Mode enabled
2. Click "Load unpacked" and point to the repo root
3. If already loaded, click the refresh icon on the GitPing card

- [ ] **Step 2: Verify badges appear**

1. Open the GitPing popup
2. Navigate to the "Needs Your Approval" and "Your PRs" tabs
3. For PRs with CI checks: confirm ✅ / ❌ / 🔄 badge appears to the right of the Open/Draft badge
4. For PRs with no CI checks or failed API call: confirm no badge appears (card unchanged)
5. For Issues tab: confirm no CI badges appear

- [ ] **Step 3: Open draft PR**

```bash
git push -u origin feature/cicd-status-badge
gh pr create \
  --title "feature | CI/CD status badge on PR cards" \
  --draft \
  --body "$(cat <<'EOF'
## Summary

- Adds CI/CD status badge (✅ / ❌ / 🔄) to PR cards in the popup
- Fetches check-runs during background polling cycle via `GET /repos/{owner}/{repo}/commits/{sha}/check-runs`
- Scoped to 4 tabs: personal, mine, team, mentions — not issues or watched
- Uses `Promise.allSettled` so one failed call never blocks others
- No new permissions, no `manifest.json` changes

Closes #83
EOF
)"
```

Return the PR URL once created.

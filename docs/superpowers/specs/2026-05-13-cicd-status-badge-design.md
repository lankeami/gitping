# CI/CD Status Badge on PR Cards

**Date:** 2026-05-13
**Issue:** #83
**Status:** Approved

---

## Summary

Add a CI/CD status badge (✅ pass / ❌ fail / 🔄 running) to each PR card in the GitPing popup. The badge surfaces build status without requiring users to open GitHub, eliminating a context switch that happens dozens of times per day.

---

## Scope

### In scope
- Fetch check-runs during the background polling cycle
- Display CI badge on cards in 4 tabs: **personal** (needs your approval), **mine** (your open PRs), **team** (needs your team's approval), **mentions** (PR conversations)
- Aggregate all check runs to a single status per PR
- Cache result in Chrome local storage alongside existing PR data

### Out of scope
- Issues tab — CI status is not meaningful for issues
- Watched tab — watched items may include issues; CI status not prioritised there
- Lazy/on-demand fetching
- Per-check-run breakdown or tooltips listing individual checks

---

## Architecture

```
fetchAndFilterPullRequests()
  │
  ├── [existing] fetch all 6 tab categories via GraphQL
  ├── [existing] enrichIssue() for all items → builds pr.card
  │
  └── [NEW] second pass over ['personal', 'mine', 'team', 'mentions']
        │
        ├── Promise.allSettled over all PRs in those tabs
        │     └── fetchCheckRuns(owner, repo, head_sha, token)
        │           └── GET /repos/{owner}/{repo}/commits/{sha}/check-runs
        │
        └── attach ciStatus to pr.card.ciStatus
              'success' | 'failure' | 'running' | null
```

`enrichIssue()` remains synchronous. All failures are isolated per-card via `Promise.allSettled` — one failed check-runs call never breaks others.

---

## Data Layer

### `githubGraphql.js` — `getPrSchema()`

Add `headRefOid` to the existing PR schema (alongside the `commits` block). This is the head commit SHA returned by GitHub's GraphQL API.

```
headRefOid
```

No new permissions. No new GraphQL query — added to the existing search schema.

### `githubApi.js`

#### `enrichIssue()` — pass through `head_sha`

```js
card.head_sha = issue.headRefOid || null;
```

Synchronous. `headRefOid` only exists on PullRequest nodes; issues get `null`.

#### New function: `fetchCheckRuns(owner, repo, sha, token)`

Uses the existing `fetchFromGitHub` helper.

Endpoint: `GET /repos/{owner}/{repo}/commits/{sha}/check-runs`

Aggregation logic (priority order):
1. Any `conclusion === 'failure'` or `conclusion === 'timed_out'` → `'failure'`
2. Any `status === 'in_progress'` or `status === 'queued'` → `'running'`
3. All `conclusion === 'success'` → `'success'`
4. Empty array or call throws → `null`

Returns: `'success' | 'failure' | 'running' | null`

#### `fetchAndFilterPullRequests()` — second pass

After the existing enrichment loop:

```js
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

---

## UI Layer

### `uiUtils.js` — `cardTitle()`

After the existing `pr-status-badge` span, append a CI badge when `pr.ciStatus` is set:

```js
if (pr.ciStatus) {
    const ciEmoji = { success: '✅', failure: '❌', running: '🔄' };
    const ciBadge = document.createElement('span');
    ciBadge.className = `ci-badge ci-badge--${pr.ciStatus}`;
    ciBadge.textContent = ciEmoji[pr.ciStatus];
    ciBadge.title = `CI: ${pr.ciStatus}`;
    title.appendChild(ciBadge);
}
```

No badge rendered if `ciStatus` is `null` or `undefined`.

Card visual order: `[PR icon] [title text] [Open/Draft badge] [CI badge]`

### `design-system.css`

```css
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

Modifier classes defined for future extension. Emoji carries sufficient visual meaning without additional colour styling.

---

## Files Touched

| File | Change |
|------|--------|
| `src/shared/githubGraphql.js` | Add `headRefOid` to `getPrSchema()` |
| `src/shared/githubApi.js` | `card.head_sha` in `enrichIssue()`, new `fetchCheckRuns()`, second pass in `fetchAndFilterPullRequests()` |
| `src/shared/uiUtils.js` | CI badge in `cardTitle()` |
| `src/shared/design-system.css` | `.ci-badge` base + modifier classes |

**No new files. No `manifest.json` changes. No new permissions.**

---

## Error Handling

- `fetchCheckRuns` wraps in try/catch, returns `null` on any error
- `Promise.allSettled` in the second pass ensures one failure never affects other cards
- If `ciStatus` is `null`, no badge renders — card degrades gracefully

---

## Success Criteria

- PR cards in personal, mine, team, and mentions tabs show ✅ / ❌ / 🔄 based on current check-runs
- Cards in issues and watched tabs are unchanged
- No badge rendered for PRs with no check-runs or failed API calls
- `manifest.json` is unchanged
- `node --check` passes on all modified JS files

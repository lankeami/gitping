# Daily Recap Feature

A standalone page that generates AI-powered summaries of GitHub activity across all organizations the user belongs to.

## Overview

The Daily Recap feature fetches ALL PRs, issues, and conversations from the user's GitHub organizations and generates an intelligent summary using GitHub Models AI.

**Key Capabilities:**
- Fetches activity across ALL organizations the user belongs to
- Configurable date range (Yesterday, 7 days, 14 days, 30 days)
- AI-generated summary highlighting key items
- Raw markdown view of all activity data
- Caching to avoid redundant API calls

---

## Architecture

### Files Created

```
src/recap/
├── recap.html          # Standalone page UI
├── recap.css           # Page styling
└── recap.js            # Page orchestration

src/shared/
├── recapApi.js         # Activity fetching with org-wide queries
├── recapMarkdown.js    # Markdown document builder
├── recapStorage.js     # Caching utilities
└── githubModels.js     # GitHub Models AI integration
```

### Files Modified

- `manifest.json` - Added `host_permissions` for `https://models.github.ai/*`
- `src/popup/popup.html` - Added recap button to left nav
- `src/popup/popup.js` - Event handler for recap button
- `src/popup/popup.css` - Styling for recap tab button

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      USER CLICKS RECAP                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              1. FETCH USER'S ORGANIZATIONS                  │
│                   GET /user/orgs                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              2. QUERY ALL ACTIVITY (GraphQL)                │
│   For each org: is:pr org:{org} updated:{dateRange}         │
│   For each org: is:issue org:{org} updated:{dateRange}      │
│   Plus: involves:{username} for external repos              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              3. BUILD MARKDOWN DOCUMENT                     │
│   Hierarchy: Org > Repo > PR/Issue > Activity               │
│   Includes: status, labels, comments, reviews               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              4. GENERATE AI SUMMARY                         │
│   GitHub Models API (GPT-4.1 / GPT-4o-mini)                 │
│   Hierarchical summarization for large datasets             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              5. DISPLAY & CACHE RESULTS                     │
│   AI Summary (rendered markdown)                            │
│   Raw Activity Data (collapsible)                           │
│   Cache key: recap_{days}d_{date}                           │
└─────────────────────────────────────────────────────────────┘
```

---

## GraphQL Queries

### Organization-Wide Queries
For each organization the user belongs to:
```graphql
is:pr org:{orgName} updated:{startDate}..{endDate}
is:issue org:{orgName} updated:{startDate}..{endDate}
```

### User-Specific Queries (for external repos)
```graphql
is:pr involves:{username} updated:{dateRange}
is:issue involves:{username} updated:{dateRange}
is:pr user:{username} updated:{dateRange}    # Personal repos
is:issue user:{username} updated:{dateRange}
```

---

## Markdown Document Structure

```markdown
# GitHub Activity Recap
**User:** @username
**Period:** Feb 2, 2026 - Feb 8, 2026
**Organizations:** org1, org2, org3

## Summary Statistics
- **Total PRs:** 45 (12 involve you)
- **Total Issues:** 23 (5 involve you)
- **Active Repositories:** 18
- **Organizations:** 3

## Organization: org1

### Repository: repo-name

#### Pull Requests

##### PR #123: Feature title
- **Status:** Open
- **Author:** @author
- **Labels:** enhancement, priority-high
- **Your Role:** reviewer
- **Yesterday's Activity:**
  - Review APPROVED by @reviewer1
  - Comment by @author: "Updated based on feedback..."

#### Issues
...

## Organization: org2
...
```

---

## AI Summarization

### Current Approach
- Uses GitHub Models API (`https://models.github.ai/inference/chat/completions`)
- Model: `openai/gpt-4.1` (8K token limit)
- Truncates large documents to fit context

### Planned: Hierarchical Summarization
For datasets exceeding token limits:

```
Full Activity Data (50K+ chars)
         │
         ▼
┌────────────────────────────┐
│  CHUNK BY ORGANIZATION     │
└────────────────────────────┘
         │
    ┌────┼────┬────┐
    ▼    ▼    ▼    ▼
  Org1  Org2  Org3  Org4   ← Summarize each in PARALLEL
    │    │    │    │
    └────┴────┴────┘
         │
         ▼
┌────────────────────────────┐
│  COMBINE SUMMARIES         │
│  Final coherent summary    │
└────────────────────────────┘
```

**Benefits:**
- No data loss from truncation
- Parallel processing for speed
- Handles unlimited activity data

---

## Caching Strategy

- **Cache Key:** `recap_{daysBack}d_{endDate}` (e.g., `recap_7d_2026-02-08`)
- **Storage:** `chrome.storage.local`
- **Max Cached:** 7 most recent recaps
- **Contents:** `{ summary: string, markdown: string, cachedAt: ISO string }`

---

## UI Components

### Date Range Selector
```html
<select id="date-range">
  <option value="1">Yesterday</option>
  <option value="7" selected>Last 7 days</option>
  <option value="14">Last 14 days</option>
  <option value="30">Last 30 days</option>
</select>
```

### Progress States
1. "Checking authentication..."
2. "Fetching GitHub activity from the last N days..."
3. "Building activity document..."
4. "Generating AI summary..." (or "Summarizing org 1/5...")
5. Display results

### Error States
- **No token:** "Please configure your GitHub token in Settings"
- **No models:read scope:** "Your token needs the 'models:read' scope"
- **No activity:** "No GitHub activity found for this period"
- **API error:** Specific error message with Retry button

---

## Configuration Requirements

### manifest.json
```json
{
  "host_permissions": [
    "https://models.github.ai/*"
  ]
}
```

### GitHub Token Scopes
- `repo` - Access to repositories
- `read:org` - Read organization membership
- `models:read` - Access to GitHub Models AI

---

## Upcoming Work

### Phase 1: Upgrade Model
- Switch from `gpt-4.1` to `gpt-4o-mini` (16K token limit)
- Update `MAX_INPUT_TOKENS` to 14000

### Phase 2: Hierarchical Summarization
1. Add `chunkByOrganization()` function
2. Add `summarizeOrgChunk()` for parallel org summaries
3. Add `combineOrgSummaries()` for final reduction
4. Update progress UI to show "Summarizing org X/Y..."

### Phase 3: Edge Cases
- Handle single org exceeding limits (chunk by repo)
- Rate limiting between parallel calls
- Recursive collapse if combined summaries still too large

---

## Testing

### Manual Test Cases
1. **Small dataset:** 1 org, few PRs → single API call
2. **Medium dataset:** 3 orgs, ~50 items → may need chunking
3. **Large dataset:** 5+ orgs, 100+ items → definitely needs chunking
4. **Empty activity:** No PRs/issues → shows "No activity" message
5. **Cache hit:** Second load of same date range → instant display

### Console Logs to Check
```
[RecapAPI] Found organizations: [org1, org2, org3]
[RecapAPI] Executing PR query: org-org1 -> "is:pr org:org1 updated:..."
[RecapAPI] PR query "org-org1" returned 15 results from repos: [repo1, repo2]
[GitHubModels] Original document size: 50000 chars (~16667 tokens)
[GitHubModels] Chunking into 3 organizations...
[GitHubModels] Final summary generated
```

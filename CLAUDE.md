# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitPing is a Chrome Extension (Manifest V3) for tracking GitHub PRs, issues, and review requests with real-time notifications. It uses **zero npm dependencies** — pure vanilla JavaScript with ES6 modules loaded natively by Chrome. There is no build step, bundler, or package.json.

## Development

**Loading the extension:** Load unpacked at `chrome://extensions/` with Developer Mode enabled, pointing to the repo root.

**No build/lint/test commands exist.** Development is manual: edit files, reload the extension in Chrome, test. Syntax check files with `node --check <file>`.

**Version** is managed solely in `manifest.json`.

## Architecture

```
background.js          ← Service worker: polling (Chrome alarms), notifications, badge updates
popup/                 ← Main UI: tabbed view of PRs/issues with multi-criteria filters
options/               ← Settings: GitHub token, API base URL, polling interval
recap/                 ← Technical Recap page: date-ranged activity summary via AI
shared/                ← Shared modules used by all above
```

### Data Flow

1. **Background service worker** polls GitHub every N minutes via Chrome alarms (not `setInterval` — survives worker termination)
2. Fetches data via REST (`githubApi.js`) and GraphQL (`githubGraphql.js`), filters into categories (personal reviews, team reviews, mentions, issues, watched)
3. Stores results in **Chrome local storage** (`storageUtils.js` wraps callback API with Promises)
4. **Popup** reads storage and renders cards (`uiUtils.js`) with XOR-based multi-select filters persisted per tab
5. **Recap page** fetches activity for a date range, builds a markdown document (`recapMarkdown.js`), sends to GitHub Models API (`githubModels.js`) for AI summarization

### Key Shared Modules

- **`githubApi.js`** — REST API calls, PR/issue fetching, data enrichment via `enrichIssue()` which normalizes REST+GraphQL responses into a unified card format
- **`githubGraphql.js`** — All GraphQL queries and schemas, pagination, custom queries for PR/issue details and direct commits
- **`githubModels.js`** — GitHub Models AI API integration, hierarchical map-reduce summarization for large documents, configurable prompts
- **`storageUtils.js`** — Promise wrappers around `chrome.storage.local`, auth token/username getters
- **`uiUtils.js`** — DOM card creation, avatar loading, filter rendering
- **`design-system.css`** — CSS custom properties (colors, spacing, typography, shadows) imported by all page stylesheets

### Recap Summarization Pipeline

For documents exceeding ~40K chars, uses a map-reduce approach:
1. Chunks markdown by `## Organization:` boundaries
2. Summarizes each org chunk in parallel via GitHub Models API (GPT-4o-mini)
3. Combines org summaries into a final unified recap
4. Custom prompt is configurable and persisted in `chrome.storage.local`

## Conventions

- **Commit messages:** `[type] | description (#PR)` — types: `feature`, `bugfix`, `support`, `chore`, `cleanup`
- **Code style:** Early returns, functional patterns (map/filter/reduce), immutability, JSDoc for function signatures
- **Async:** All storage and API calls use async/await with Promise wrappers
- **Error handling:** Centralized `setLastError()` pattern stored in Chrome storage
- **CSS:** Custom properties in `design-system.css`, BEM-like naming (`.pr-card`, `.tab-badge`, `.filter-accordion`)
- **No host_permissions needed** — Extension pages can fetch any URL directly; GitHub API calls use Bearer token auth

## Chrome Permissions — Minimize at All Costs

**Adding new permissions to `manifest.json` causes Chrome to disable the extension and prompt users to re-approve. This directly causes customer churn. Never add new permissions without explicit approval.**

Current permissions: `storage`, `notifications`, `alarms` — that's it.

Rules:
- **No `host_permissions`** — Extension pages (popup, options, recap) can `fetch()` any URL without declaring host permissions. Bearer token auth handles GitHub API access.
- **No `optional_host_permissions`** unless absolutely unavoidable. Even optional permissions trigger user-facing prompts via `chrome.permissions.request()`.
- **Prefer workarounds** over new permissions. If a feature seems to require a new permission, explore alternatives first (e.g., using existing APIs differently, restructuring the approach).
- **Never add `tabs`, `activeTab`, `scripting`, `webRequest`, or broad host patterns** — these are high-friction permissions that scare users.
- If a new permission is truly required, document the justification and flag it for review before implementing.

## Chrome Extension APIs Used

`chrome.storage.local`, `chrome.alarms`, `chrome.notifications`, `chrome.action`, `chrome.tabs.create`, `chrome.runtime.openOptionsPage`, `chrome.permissions`

## GitHub Enterprise Support

All API calls go through a configurable base URL (`githubApiBaseUrl` in storage) to support GitHub Enterprise instances.

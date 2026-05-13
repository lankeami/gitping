---
name: release
description: Create a GitHub release for this project. Optionally accepts a version argument (vx.y.z). If omitted, fetches the latest GitHub release and bumps to the next minor version (vx.y.0). Always operates off main — ignores the current working branch.
args:
  - name: version
    description: Target version in vx.y.z format (e.g., v1.4.0). If omitted, auto-increments latest release to next minor.
    required: false
---

You are creating a GitHub release. Follow these steps exactly and in order.

## Step 1: Resolve Target Version

**If a version argument was provided:**
- Validate it matches `v\d+\.\d+\.\d+`. If not, stop and tell the user the format must be `vX.Y.Z`.
- Use it as `TARGET_VERSION`.

**If no version argument:**
- Run: `gh release list --limit 1 --json tagName --jq '.[0].tagName'`
- If no releases exist, default to `v0.1.0` and tell the user.
- Otherwise parse the result as `vX.Y.Z`, increment Y by 1, set Z to 0.
- Tell the user: "No version provided. Latest release is vX.Y.Z → bumping to vX.(Y+1).0. Confirm to proceed."
- Wait for user confirmation before continuing.

Store as:
- `TARGET_VERSION` — e.g., `v1.4.0`
- `MANIFEST_VERSION` — same without the `v` prefix, e.g., `1.4.0`

## Step 2: Identify Previous Release Tag

Run: `gh release list --limit 1 --json tagName --jq '.[0].tagName'`

Store as `PREV_TAG`. If no previous release exists, set `PREV_TAG` to the first commit: `git rev-list --max-parents=0 HEAD`

## Step 3: Get Commits Between PREV_TAG and main

ALWAYS use `origin/main`. NEVER use the current branch.

```bash
git fetch origin main
git log {PREV_TAG}..origin/main --no-merges --pretty=format:"%s" --reverse
```

If this returns nothing, stop and tell the user: "No commits found between {PREV_TAG} and origin/main. Nothing to release."

## Step 4: Build Release Notes

Parse each commit subject using the pattern `[type] | description (#PR)`.

Group into sections — skip any section with no entries:

```
## What's New in {TARGET_VERSION}

### Features
- <description> (<#PR>)

### Bug Fixes
- <description> (<#PR>)

### Support
- <description> (<#PR>)
```

Mapping:
- `feature` → Features
- `bugfix` → Bug Fixes
- `support`, `chore`, `cleanup` → Support

Strip the `[type] | ` prefix from each entry. Keep the `(#PR)` suffix.

Any commit not matching the pattern goes under **Other** verbatim.

## Step 5: Update manifest.json Version

Read `manifest.json`. Find the `"version"` field and replace its value with `{MANIFEST_VERSION}`.

ONLY modify the `"version"` field. Do not touch anything else in the file.

## Step 6: Commit and Push Version Bump

**STOP.** Show the user the proposed commit and release notes. Ask: "Ready to push version bump and create release {TARGET_VERSION}?"

Only proceed after explicit confirmation.

```bash
git checkout main
git pull origin main
git add manifest.json
git commit -m "[support] | bump version to {TARGET_VERSION}"
git push origin main
```

## Step 7: Create GitHub Release

```bash
gh release create {TARGET_VERSION} \
  --title "{TARGET_VERSION}" \
  --notes "{RELEASE_NOTES}" \
  --target main
```

## Step 8: Confirm

Output:
```
Released {TARGET_VERSION}
N commits since {PREV_TAG}
Run `gh release view {TARGET_VERSION}` to view on GitHub
```

## Hard Constraints

- NEVER operate on the current branch — always use `origin/main`
- NEVER run a build step — this project has no bundler or build system
- NEVER modify any file other than `manifest.json`
- NEVER push or create a release tag without explicit user confirmation
- If `gh` is not authenticated, stop immediately and tell the user to run `gh auth login`

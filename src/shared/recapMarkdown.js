/**
 * Build a nested markdown document from activity data
 * Structure: Org > Repo > PRs/Issues/Commits > Activity
 *
 * @param {Object} activity - Activity data from fetchYesterdayActivity
 * @param {string} username - The current user's username
 * @returns {string} Markdown document
 */
export function buildRecapMarkdown(activity, username) {
    const { prs, issues, directCommits = [], dateRange, organizations = [] } = activity;

    if (prs.length === 0 && issues.length === 0 && directCommits.length === 0) {
        return '';
    }

    const lines = [];

    // Header with date range
    const dateLabel = dateRange.start === dateRange.end
        ? dateRange.start
        : `${dateRange.start} to ${dateRange.end}`;
    lines.push(`# GitHub Activity Recap`);
    lines.push(`**User:** @${username}`);
    lines.push(`**Period:** ${dateLabel}`);
    if (organizations.length > 0) {
        lines.push(`**Organizations:** ${organizations.join(', ')}`);
    }
    lines.push('');

    // Summary statistics
    const stats = buildStatistics(prs, issues, directCommits, username);
    lines.push('## Summary Statistics');
    lines.push(`- **Total PRs:** ${stats.prCount} (${stats.userPrCount} involve you)`);
    lines.push(`- **Total Issues:** ${stats.issueCount} (${stats.userIssueCount} involve you)`);
    lines.push(`- **Direct Commits:** ${stats.commitCount} (${stats.userCommitCount} by you)`);
    lines.push(`- **Active Repositories:** ${stats.repoCount}`);
    lines.push(`- **Organizations:** ${stats.orgCount}`);
    lines.push('');

    // Group by organization
    const grouped = groupByOrganization(prs, issues, directCommits);

    // Build sections for each org
    for (const [orgName, orgData] of Object.entries(grouped)) {
        lines.push(`## Organization: ${orgName}`);
        lines.push('');

        for (const [repoName, repoData] of Object.entries(orgData.repos)) {
            lines.push(`### Repository: ${repoName}`);
            lines.push('');

            // PRs for this repo
            if (repoData.prs.length > 0) {
                lines.push('#### Pull Requests');
                lines.push('');

                for (const pr of repoData.prs) {
                    lines.push(...formatPullRequest(pr, username));
                    lines.push('');
                }
            }

            // Issues for this repo
            if (repoData.issues.length > 0) {
                lines.push('#### Issues');
                lines.push('');

                for (const issue of repoData.issues) {
                    lines.push(...formatIssue(issue, username));
                    lines.push('');
                }
            }

            // Direct commits for this repo
            if (repoData.commits && repoData.commits.length > 0) {
                lines.push('#### Direct Commits (not via PR)');
                lines.push('');

                for (const commit of repoData.commits) {
                    lines.push(...formatCommit(commit, username));
                    lines.push('');
                }
            }
        }
    }

    return lines.join('\n');
}

/**
 * Calculate summary statistics
 */
function buildStatistics(prs, issues, directCommits, username) {
    const repos = new Set();
    const orgs = new Set();

    // Count PRs that involve the user
    let userPrCount = 0;
    for (const pr of prs) {
        if (pr.repository) {
            repos.add(`${pr.repository.owner?.login}/${pr.repository.name}`);
            orgs.add(pr.repository.owner?.login);
        }
        if (pr.userRoles && pr.userRoles.length > 0 && !pr.userRoles.includes('participant')) {
            userPrCount++;
        }
    }

    // Count issues that involve the user
    let userIssueCount = 0;
    for (const issue of issues) {
        if (issue.repository) {
            repos.add(`${issue.repository.owner?.login}/${issue.repository.name}`);
            orgs.add(issue.repository.owner?.login);
        }
        if (issue.userRoles && issue.userRoles.length > 0 && !issue.userRoles.includes('participant')) {
            userIssueCount++;
        }
    }

    // Count commits by the user
    let userCommitCount = 0;
    for (const commit of directCommits) {
        if (commit.repository) {
            repos.add(`${commit.repository.owner?.login}/${commit.repository.name}`);
            orgs.add(commit.repository.owner?.login);
        }
        if (commit.userRoles && commit.userRoles.includes('author')) {
            userCommitCount++;
        }
    }

    return {
        prCount: prs.length,
        issueCount: issues.length,
        commitCount: directCommits.length,
        userPrCount,
        userIssueCount,
        userCommitCount,
        repoCount: repos.size,
        orgCount: orgs.size
    };
}

/**
 * Group PRs, Issues, and Commits by organization, then by repository
 */
function groupByOrganization(prs, issues, directCommits = []) {
    const grouped = {};

    const addItem = (item, type) => {
        const orgName = item.repository?.owner?.login || 'Unknown';
        const repoName = item.repository?.name || 'Unknown';

        if (!grouped[orgName]) {
            grouped[orgName] = { repos: {} };
        }

        if (!grouped[orgName].repos[repoName]) {
            grouped[orgName].repos[repoName] = { prs: [], issues: [], commits: [] };
        }

        if (type === 'pr') {
            grouped[orgName].repos[repoName].prs.push(item);
        } else if (type === 'issue') {
            grouped[orgName].repos[repoName].issues.push(item);
        } else if (type === 'commit') {
            grouped[orgName].repos[repoName].commits.push(item);
        }
    };

    for (const pr of prs) {
        addItem(pr, 'pr');
    }

    for (const issue of issues) {
        addItem(issue, 'issue');
    }

    for (const commit of directCommits) {
        addItem(commit, 'commit');
    }

    return grouped;
}

/**
 * Format a single PR for markdown output
 */
function formatPullRequest(pr, username) {
    const lines = [];

    // Title line
    const statusBadge = formatPrStatus(pr);
    lines.push(`##### PR #${pr.number}: ${pr.title}`);

    // Metadata
    lines.push(`- **Status:** ${statusBadge}`);
    lines.push(`- **Author:** @${pr.author?.login || 'unknown'}`);

    // Labels
    if (pr.labels?.nodes?.length > 0) {
        const labelNames = pr.labels.nodes.map(l => l.name).join(', ');
        lines.push(`- **Labels:** ${labelNames}`);
    }

    // User's role
    if (pr.userRoles?.length > 0) {
        lines.push(`- **Your Role:** ${pr.userRoles.join(', ')}`);
    }

    // Watched indicator
    if (pr.isWatched) {
        lines.push(`- **Watched:** Yes`);
    }

    // Yesterday's activity
    const activity = extractPrActivity(pr, username);
    if (activity.length > 0) {
        lines.push(`- **Yesterday's Activity:**`);
        for (const act of activity) {
            lines.push(`  - ${act}`);
        }
    }

    return lines;
}

/**
 * Format a single Issue for markdown output
 */
function formatIssue(issue, username) {
    const lines = [];

    // Title line
    const statusBadge = issue.state === 'OPEN' ? 'Open' : 'Closed';
    lines.push(`##### Issue #${issue.number}: ${issue.title}`);

    // Metadata
    lines.push(`- **Status:** ${statusBadge}`);
    lines.push(`- **Author:** @${issue.author?.login || 'unknown'}`);

    // Labels
    if (issue.labels?.nodes?.length > 0) {
        const labelNames = issue.labels.nodes.map(l => l.name).join(', ');
        lines.push(`- **Labels:** ${labelNames}`);
    }

    // User's role
    if (issue.userRoles?.length > 0) {
        lines.push(`- **Your Role:** ${issue.userRoles.join(', ')}`);
    }

    // Watched indicator
    if (issue.isWatched) {
        lines.push(`- **Watched:** Yes`);
    }

    // Yesterday's activity (comments)
    const activity = extractIssueActivity(issue);
    if (activity.length > 0) {
        lines.push(`- **Yesterday's Activity:**`);
        for (const act of activity) {
            lines.push(`  - ${act}`);
        }
    }

    return lines;
}

/**
 * Format a single direct commit for markdown output
 */
function formatCommit(commit, username) {
    const lines = [];

    // Commit hash (short) and message
    const shortOid = commit.oid?.substring(0, 7) || 'unknown';
    lines.push(`##### Commit ${shortOid}: ${commit.messageHeadline || 'No message'}`);

    // Metadata
    const authorLogin = commit.author?.user?.login;
    const authorName = commit.author?.name || 'unknown';
    const authorDisplay = authorLogin ? `@${authorLogin}` : authorName;
    lines.push(`- **Author:** ${authorDisplay}`);
    lines.push(`- **Branch:** ${commit.branchName || 'default'}`);

    // Date
    if (commit.committedDate) {
        const date = new Date(commit.committedDate);
        lines.push(`- **Date:** ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`);
    }

    // User's role
    if (commit.userRoles?.length > 0) {
        lines.push(`- **Your Role:** ${commit.userRoles.join(', ')}`);
    }

    // Full commit message if different from headline
    if (commit.message && commit.message !== commit.messageHeadline) {
        const body = commit.message.replace(commit.messageHeadline, '').trim();
        if (body) {
            const truncatedBody = truncateText(body, 200);
            lines.push(`- **Details:** ${truncatedBody}`);
        }
    }

    return lines;
}

/**
 * Format PR status
 */
function formatPrStatus(pr) {
    if (pr.isDraft) return 'Draft';
    if (pr.state === 'MERGED') return 'Merged';
    if (pr.state === 'CLOSED') return 'Closed';
    return 'Open';
}

/**
 * Extract activity from a PR (comments, reviews, commits)
 */
function extractPrActivity(pr, username) {
    const activity = [];

    // Reviews
    if (pr.reviews?.nodes) {
        for (const review of pr.reviews.nodes) {
            const author = review.author?.login || 'unknown';
            const state = formatReviewState(review.state);

            if (review.body && review.body.trim()) {
                // Truncate long review bodies
                const body = truncateText(review.body, 100);
                activity.push(`Review ${state} by @${author}: "${body}"`);
            } else {
                activity.push(`Review ${state} by @${author}`);
            }

            // Review comments
            if (review.comments?.nodes) {
                for (const comment of review.comments.nodes) {
                    const commentAuthor = comment.author?.login || 'unknown';
                    const body = truncateText(comment.body || comment.bodyText, 100);
                    activity.push(`Review comment by @${commentAuthor}: "${body}"`);
                }
            }
        }
    }

    // Regular comments
    if (pr.comments?.nodes) {
        for (const comment of pr.comments.nodes) {
            const author = comment.author?.login || 'unknown';
            const body = truncateText(comment.body || comment.bodyText, 100);
            activity.push(`Comment by @${author}: "${body}"`);
        }
    }

    // Last commit
    if (pr.commits?.nodes?.length > 0) {
        const commit = pr.commits.nodes[0].commit;
        const message = commit.messageHeadline || commit.message;
        const author = commit.author?.user?.login || 'unknown';
        activity.push(`Commit by @${author}: "${truncateText(message, 80)}"`);
    }

    return activity;
}

/**
 * Extract activity from an Issue (comments)
 */
function extractIssueActivity(issue) {
    const activity = [];

    if (issue.comments?.nodes) {
        for (const comment of issue.comments.nodes) {
            const author = comment.author?.login || 'unknown';
            const body = truncateText(comment.body || comment.bodyText, 100);
            activity.push(`Comment by @${author}: "${body}"`);
        }
    }

    return activity;
}

/**
 * Format review state to readable string
 */
function formatReviewState(state) {
    switch (state) {
        case 'APPROVED': return 'APPROVED';
        case 'CHANGES_REQUESTED': return 'CHANGES_REQUESTED';
        case 'COMMENTED': return 'COMMENTED';
        case 'DISMISSED': return 'DISMISSED';
        case 'PENDING': return 'PENDING';
        default: return state;
    }
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    text = text.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

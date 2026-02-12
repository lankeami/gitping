import { GQLSearchPullRequests, GQLSearchIssues, GQLFetchDirectCommits } from './githubGraphql.js';
import { getWatchListUrls } from './storageUtils.js';
import { GQLFetchPullRequest, GQLFetchIssue } from './githubGraphql.js';
import { fetchOrganizations } from './githubApi.js';

/**
 * Get date range in ISO format for GitHub search
 * @param {string} startDateStr - Start date in YYYY-MM-DD format
 * @param {string} endDateStr - End date in YYYY-MM-DD format
 * @returns {{ start: string, end: string, range: string, startDate: Date, endDate: Date }}
 */
function getDateRange(startDateStr, endDateStr) {
    // Parse dates (add time to avoid timezone issues)
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T23:59:59');

    return {
        start: startDateStr,
        end: endDateStr,
        range: `${startDateStr}..${endDateStr}`,
        startDate: startDate,
        endDate: endDate
    };
}

// Alias for backwards compatibility - uses last 7 days
function getYesterdayDateRange() {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
    return getDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
    );
}

/**
 * Parse a GitHub URL to extract owner, repo, type, and number
 * @param {string} url - The GitHub URL
 * @returns {{ owner: string, repo: string, type: 'pull' | 'issue', number: number } | null}
 */
function parseGitHubUrl(url) {
    if (!url) return null;

    // Match URLs like: https://github.com/owner/repo/pull/123 or https://github.com/owner/repo/issues/456
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/);
    if (!match) return null;

    return {
        owner: match[1],
        repo: match[2],
        type: match[3] === 'pull' ? 'pull' : 'issue',
        number: parseInt(match[4], 10)
    };
}

/**
 * Filter items to only those updated within the date range
 * @param {Array} items - PR or Issue objects
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @returns {Array} Filtered items
 */
function filterByDateRange(items, startDate, endDate) {
    return items.filter(item => {
        const updatedAt = new Date(item.updatedAt);
        return updatedAt >= startDate && updatedAt <= endDate;
    });
}

/**
 * Deduplicate items by their ID
 * @param {Array} items - Array of PR or Issue objects
 * @returns {Array} Deduplicated array
 */
function deduplicateById(items) {
    const seen = new Set();
    return items.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

/**
 * Determine user's relationship to a PR/Issue
 * @param {Object} item - The PR or Issue object
 * @param {string} username - The current user's username
 * @returns {string[]} Array of roles (e.g., ['author', 'reviewer'])
 */
function getUserRoles(item, username) {
    const roles = [];

    // Check if author
    if (item.author?.login?.toLowerCase() === username.toLowerCase()) {
        roles.push('author');
    }

    // Check if review was requested (PRs only)
    if (item.reviewRequests?.nodes) {
        const requested = item.reviewRequests.nodes.some(req => {
            const reviewer = req.requestedReviewer;
            if (reviewer?.__typename === 'User') {
                return reviewer.login?.toLowerCase() === username.toLowerCase();
            }
            return false;
        });
        if (requested) {
            roles.push('reviewer');
        }
    }

    // Check if user reviewed (PRs only)
    if (item.reviews?.nodes) {
        const reviewed = item.reviews.nodes.some(review =>
            review.author?.login?.toLowerCase() === username.toLowerCase()
        );
        if (reviewed && !roles.includes('reviewer')) {
            roles.push('reviewer');
        }
    }

    // Check if user commented
    if (item.comments?.nodes) {
        const commented = item.comments.nodes.some(comment =>
            comment.author?.login?.toLowerCase() === username.toLowerCase()
        );
        if (commented) {
            roles.push('commenter');
        }
    }

    // Default role if none found
    if (roles.length === 0) {
        roles.push('participant');
    }

    return roles;
}

/**
 * Fetch all of the user's GitHub activity for a date range
 * Uses efficient search queries to minimize API calls
 *
 * @param {string} username - The GitHub username
 * @param {string} token - The GitHub token
 * @param {string} startDateStr - Start date in YYYY-MM-DD format
 * @param {string} endDateStr - End date in YYYY-MM-DD format
 * @returns {Promise<{ prs: Array, issues: Array, dateRange: Object }>}
 */
export async function fetchYesterdayActivity(username, token, startDateStr, endDateStr) {
    const dateRange = getDateRange(startDateStr, endDateStr);
    const { range, startDate, endDate } = dateRange;

    console.log('[RecapAPI] Date range:', { range, start: dateRange.start, end: dateRange.end });
    console.log('[RecapAPI] Username:', username);

    // Step 1: Fetch user's organizations
    let orgs = [];
    try {
        console.log('[RecapAPI] Fetching organizations...');
        orgs = await fetchOrganizations(token);
        console.log('[RecapAPI] Found organizations:', orgs.map(o => o.login));
    } catch (err) {
        console.error('[RecapAPI] Failed to fetch organizations:', err);
    }

    // Step 2: Build queries for ALL activity across orgs
    const prQueries = [];
    const issueQueries = [];

    // Add org-wide queries (ALL PRs/issues in each org)
    for (const org of orgs) {
        prQueries.push({
            type: `org-${org.login}`,
            query: `is:pr org:${org.login} updated:${range}`
        });
        issueQueries.push({
            type: `org-${org.login}`,
            query: `is:issue org:${org.login} updated:${range}`
        });
    }

    // Add user's personal repos (not in any org)
    prQueries.push({
        type: 'user-repos',
        query: `is:pr user:${username} updated:${range}`
    });
    issueQueries.push({
        type: 'user-repos',
        query: `is:issue user:${username} updated:${range}`
    });

    // Also add user-involvement queries to catch anything in repos they might have access to outside their orgs
    prQueries.push({
        type: 'involves',
        query: `is:pr involves:${username} updated:${range}`
    });
    issueQueries.push({
        type: 'involves',
        query: `is:issue involves:${username} updated:${range}`
    });

    console.log('[RecapAPI] PR queries:', prQueries.map(q => q.query));
    console.log('[RecapAPI] Issue queries:', issueQueries.map(q => q.query));

    // Execute all queries in parallel for efficiency
    const [prResults, issueResults, watchedResults] = await Promise.all([
        // Fetch all PR queries
        Promise.all(prQueries.map(async q => {
            try {
                console.log(`[RecapAPI] Executing PR query: ${q.type} -> "${q.query}"`);
                const results = await GQLSearchPullRequests(q.query, token);
                const repos = [...new Set((results || []).map(pr => pr.repository?.name).filter(Boolean))];
                console.log(`[RecapAPI] PR query "${q.type}" returned ${results?.length || 0} results from repos:`, repos);
                return (results || []).map(pr => ({ ...pr, queryType: q.type }));
            } catch (err) {
                console.error(`[RecapAPI] Failed to fetch PRs for query "${q.type}":`, err.message || err);
                return [];
            }
        })),
        // Fetch all issue queries
        Promise.all(issueQueries.map(async q => {
            try {
                console.log(`[RecapAPI] Executing Issue query: ${q.type} -> "${q.query}"`);
                const results = await GQLSearchIssues(q.query, token);
                const repos = [...new Set((results || []).map(issue => issue.repository?.name).filter(Boolean))];
                console.log(`[RecapAPI] Issue query "${q.type}" returned ${results?.length || 0} results from repos:`, repos);
                return (results || []).map(issue => ({ ...issue, queryType: q.type }));
            } catch (err) {
                console.error(`[RecapAPI] Failed to fetch issues for query "${q.type}":`, err.message || err);
                return [];
            }
        })),
        // Fetch watched items
        fetchWatchedItemsActivity(token, startDate, endDate)
    ]);

    // Extract unique repos from PR/issue results to check for direct commits
    // This avoids needing the organization.repositories query (which needs extra scopes)
    const activeRepos = new Set();
    for (const results of prResults) {
        for (const pr of results) {
            const owner = pr.repository?.owner?.login;
            const name = pr.repository?.name;
            if (owner && name) activeRepos.add(`${owner}/${name}`);
        }
    }
    for (const results of issueResults) {
        for (const issue of results) {
            const owner = issue.repository?.owner?.login;
            const name = issue.repository?.name;
            if (owner && name) activeRepos.add(`${owner}/${name}`);
        }
    }

    // Fetch direct commits only for repos we already know about
    const sinceISO = startDate.toISOString();
    const untilISO = endDate.toISOString();
    const repoList = [...activeRepos].map(r => { const [owner, name] = r.split('/'); return { owner, name }; });

    console.log(`[RecapAPI] Fetching direct commits for ${repoList.length} active repos`);

    const directCommitsResults = await Promise.all(
        repoList.map(async ({ owner, name }) => {
            try {
                return await GQLFetchDirectCommits(owner, name, sinceISO, untilISO, token);
            } catch (err) {
                console.error(`[RecapAPI] Failed to fetch direct commits for ${owner}/${name}:`, err.message || err);
                return [];
            }
        })
    );

    // Flatten and deduplicate PRs
    const allPrs = prResults.flat();
    const uniquePrs = deduplicateById(allPrs);

    // Add user roles to each PR
    const prsWithRoles = uniquePrs.map(pr => ({
        ...pr,
        userRoles: getUserRoles(pr, username),
        itemType: 'pr'
    }));

    // Flatten and deduplicate issues
    const allIssues = issueResults.flat();
    const uniqueIssues = deduplicateById(allIssues);

    // Add user roles to each issue
    const issuesWithRoles = uniqueIssues.map(issue => ({
        ...issue,
        userRoles: getUserRoles(issue, username),
        itemType: 'issue'
    }));

    // Merge in watched items (they may already be in the other results)
    const watchedPrs = watchedResults.prs.map(pr => ({
        ...pr,
        userRoles: [...(pr.userRoles || []), 'watched'],
        itemType: 'pr',
        isWatched: true
    }));

    const watchedIssues = watchedResults.issues.map(issue => ({
        ...issue,
        userRoles: [...(issue.userRoles || []), 'watched'],
        itemType: 'issue',
        isWatched: true
    }));

    // Merge watched items with existing (avoiding duplicates)
    const finalPrs = deduplicateById([...prsWithRoles, ...watchedPrs]);
    const finalIssues = deduplicateById([...issuesWithRoles, ...watchedIssues]);

    // Process direct commits
    const allDirectCommits = directCommitsResults.flat();
    // Deduplicate by commit oid
    const seenOids = new Set();
    const uniqueCommits = allDirectCommits.filter(commit => {
        if (seenOids.has(commit.oid)) return false;
        seenOids.add(commit.oid);
        return true;
    });

    // Add user role to commits
    const commitsWithRoles = uniqueCommits.map(commit => {
        const authorLogin = commit.author?.user?.login?.toLowerCase();
        const isAuthor = authorLogin === username.toLowerCase();
        return {
            ...commit,
            userRoles: isAuthor ? ['author'] : ['participant'],
            itemType: 'commit'
        };
    });

    console.log('[RecapAPI] Final counts:', {
        prs: finalPrs.length,
        issues: finalIssues.length,
        directCommits: commitsWithRoles.length
    });

    return {
        prs: finalPrs,
        issues: finalIssues,
        directCommits: commitsWithRoles,
        organizations: orgs.map(o => o.login),
        dateRange: {
            start: dateRange.start,
            end: dateRange.end
        }
    };
}

/**
 * Fetch activity for watched items
 * @param {string} token - GitHub token
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @returns {Promise<{ prs: Array, issues: Array }>}
 */
async function fetchWatchedItemsActivity(token, startDate, endDate) {
    const watchListUrls = await getWatchListUrls();

    if (!watchListUrls || watchListUrls.length === 0) {
        return { prs: [], issues: [] };
    }

    const prs = [];
    const issues = [];

    // Fetch each watched item (limit to avoid too many requests)
    const urlsToFetch = watchListUrls.slice(0, 20); // Limit to 20 watched items

    const results = await Promise.all(urlsToFetch.map(async url => {
        const parsed = parseGitHubUrl(url);
        if (!parsed) return null;

        try {
            if (parsed.type === 'pull') {
                const pr = await GQLFetchPullRequest(parsed.owner, parsed.repo, parsed.number, token);
                return { type: 'pr', data: pr };
            } else {
                const issue = await GQLFetchIssue(parsed.owner, parsed.repo, parsed.number, token);
                return { type: 'issue', data: issue };
            }
        } catch (err) {
            console.error(`Failed to fetch watched item ${url}:`, err);
            return null;
        }
    }));

    // Filter by date range and categorize
    for (const result of results) {
        if (!result || !result.data) continue;

        const updatedAt = new Date(result.data.updatedAt);
        if (updatedAt >= startDate && updatedAt <= endDate) {
            if (result.type === 'pr') {
                prs.push(result.data);
            } else {
                issues.push(result.data);
            }
        }
    }

    return { prs, issues };
}

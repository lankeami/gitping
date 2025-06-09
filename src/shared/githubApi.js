import { getGitHubApiBaseUrl, setFirstUpdateTime, getWatchListUrls } from './storageUtils.js';

//
//
//  CORE GITHUB API FUNCTIONS / HELPERS
//
//

/**
 * Helper method to perform a fetch request to the GitHub API with pagination support.
 * @param {string} path - The API path (relative to the base URL).
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<any[]>} - The combined JSON response from all pages.
 * @throws {Error} - If the response is not OK.
 */
async function fetchFromGitHub(path, token) {
    const GITHUB_API_BASE_URL = await getGitHubApiBaseUrl();

    if (!GITHUB_API_BASE_URL) {
        throw new Error('Error: GitHub API URL is not set.');
    }

    const url = `${GITHUB_API_BASE_URL}${path}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `token ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`GitHub API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Check for pagination in the Link header
    const linkHeader = response.headers.get('Link');
    if (linkHeader) {
        const nextPageUrl = getNextPageUrl(linkHeader);
        if (nextPageUrl) {
            const nextPageData = await fetchFromGitHub(nextPageUrl.replace(GITHUB_API_BASE_URL, ''), token);
            return data.concat(nextPageData);
        }
    }

    return data;
}

/**
 * Helper method to extract the next page URL from the Link header.
 * @param {string} linkHeader - The Link header from the GitHub API response.
 * @returns {string|null} - The URL for the next page, or null if there is no next page.
 */
function getNextPageUrl(linkHeader) {
    const links = linkHeader.split(',').map((link) => link.trim());
    for (const link of links) {
        const [url, rel] = link.split(';').map((part) => part.trim());
        if (rel === 'rel="next"') {
            return url.slice(1, -1); // Remove the angle brackets around the URL
        }
    }
    return null;
}

/**
 * Fetch organizations for the authenticated user.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of organizations.
 */
export async function fetchOrganizations(token) {
    return fetchFromGitHub('/user/orgs?per_page=100', token);
}

/**
 * Fetch teams for the authenticated user.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of teams.
 */
export async function fetchTeams(token) {
    return fetchFromGitHub('/user/teams?per_page=100', token);
}

/**
 * Fetch repositories for a given organization.
 * @param {string} org - Organization name.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of repositories.
 */
export async function fetchRepositories(org, token) {
    return fetchFromGitHub(`/orgs/${org}/repos?type=all&per_page=100`, token);
}

/**
 * Fetch repositories for the authenticated user that are not part of an organization.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of personal repositories.
 */
export async function fetchUserRepositories(token) {
    return fetchFromGitHub('/user/repos?type=owner&per_page=100', token);
}

/**
 * Search Issues from Github
 */
export async function searchIssues(query, token) {
    const path = `/search/issues?q=${encodeURIComponent(query)}&sort=created&order=des&per_page=100`;
    const response = await fetchFromGitHub(path, token);
    return response.items || [];
}

/**
 * Fetch a Pull Request or Issue by its URL
 * @param {string} url - The URL of the pull request.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Object>} - The pull request object.
 */
export async function fetchPullRequestByUrl(url, token) {
    // the user passes in WWW (or their hosted url) so we need to remove it
    // break the URL into it's parts such that the last part of the path is the id, the 
    // second to last part is the type of request (pull, issue)
    // and the rest is the repo
    const urlParts = url.replace(/https?:\/\//, '').split('/');

    // first part of the path should be the organization name
    // second part of the path should be the repo name
    // the third part of the path should be the type of request (pull, issue)
    // the fourth part of the path should be the id of the request
    if (urlParts.length < 5) {
        throw new Error('Invalid URL format. \nExpected format: https://github.com/<org>/<repo>/<type>/<id>');
    }

    // Remove the first part (which is the domain) and get the last four parts
    const id    = urlParts[4]; // Get the last part as the ID
    let type    = urlParts[3]; // Get the second to last part as the type (pull, issue)
    const repo  = urlParts[2]; // Get the third to last part as the repo name
    const org   = urlParts[1]; // Get the fourth to last part as the organization name

    if (type == 'pull' || type == 'issue') {
        type = type + 's'; // Ensure type is plural
    }

    const path = `/repos/${org}/${repo}/${type}/${id}`;
    
    return await fetchFromGitHub(path, token);
}

//
//
//  PULL REQUEST FUNCTIONS
//
//


/**
 * Fetch pull requests for a given repository.
 * @param {string} org - Organization name.
 * @param {string} repo - Repository name.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of pull requests.
 */
export async function fetchPullRequests(org, repo, token) {
    return fetchFromGitHub(`/repos/${org}/${repo}/pulls?state=open&per_page=100`, token);
}


/**
 * Filter pull requests where the user is a requested reviewer.
 * @param {Array} pullRequests - List of pull requests.
 * @param {string} username - GitHub username.
 * @returns {Array} - Filtered pull requests.
 */
export function filterPullRequestsByReviewer(pullRequests, username) {
    return pullRequests.filter((pr) =>
        pr.requested_reviewers.some((reviewer) => reviewer.login === username)
    );
}

/**
 * Filter pull requests where the user is in a team that is requested to review.
 * @param {Array} pullRequests - List of pull requests.
 * @param {string} teams - List of Teams.
 * @returns {Array} - Filtered pull requests.
 */
export function filterPullRequestsByTeams(pullRequests, teams) {
    return pullRequests.filter((pr) =>
        pr.requested_teams.some((team) =>
            teams.some((t) => t.id === team.id)
        )
    );
}

/**
 * Filter pull requests where the author is the user.
 * @param {Array} pullRequests - List of pull requests.
 * @param {string} username - GitHub username.
 * @returns {Array} - Filtered pull requests.
 */
export function filterPullRequestsByAuthor(pullRequests, username) {
    return pullRequests.filter((pr) => pr.user.login === username);
}

/**
 * Search for mentions of the user in the comments of a pull request.
 * @param {string} username - GitHub username.
 * @param {string} token - GitHub personal access token.
 */
export async function searchForMentions(username, token) {
    const mentions_query = `is:pr is:open mentions:${username}`;
    const mentions = await searchIssues(mentions_query, token);
    const comments_query = `is:pr is:open commenter:${username}`;
    const comments = await searchIssues(comments_query, token);

    const results = [];

    // Combine both results
    results.push(...mentions, ...comments);
    // sort the array, and make them unique by id
    const uniqueResults = new Map();
    results.forEach((item) => {
        if (!uniqueResults.has(item.id)) {
            uniqueResults.set(item.id, item);
        }
    });

    results.length = 0; // Clear the original array
    results.push(...uniqueResults.values());

    // filter out comments that have comment.pull_request.merged_at not null
    const filteredResults = results.filter((issue) => {
        if (issue.state) {
            return issue.state !== "closed";
        }
        return true;
    });

    // Map issues to the same structure as pull requests
    return filteredResults.map(issue => ({
        ...issue,
        pull_request: {
            url: issue.pull_request ? issue.pull_request.url : null,
            html_url: issue.html_url,
            merged_at: null // Issues do not have merged_at, set to null
        },
        base: {
            repo: {
                full_name: issue.repository_url ? issue.repository_url.split('/').slice(-2).join('/') : null,
                owner: {
                    login: issue.repository_url ? issue.repository_url.split('/').slice(-2, -1).join('/') : null,
                    avatar_url: ''
                }
            }
        }
    }));
}

/**
 * Search for comments by the user in pull requests
 * @param {string} username - GitHub username.
 * @param {string} token - GitHub personal access token.
 * @param {string} since - Optional parameter to filter comments since a specific date
 * @returns {Promise<Array>} - List of comments made by the user.
 */

//
//
//  ISSUES FUNCTIONS
//
//

/**
 * Fetch unresolved (open) issues authored by the user, ordered by last updated time.
 * @param {string} username - GitHub username.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of unresolved issues.
 */
export async function fetchUnresolvedIssuesByAuthor(username, token) {
    // Use GitHub search API to find open issues authored by the user, sorted by updated
    const query = `is:issue is:open author:${username}`;
    return searchIssues(query, token);
}

/**
 * Fetch unresolved (open) issues where the user is metnioned, ordered by last updated time.
 * @param {string} username - GitHub username.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of unresolved issues.
 */
export async function fetchUnresolvedIssuesByMention(username, token) {
    // Use GitHub search API to find open issues where the user is mentioned, sorted by updated
    const query = `is:issue is:open mentions:${username}`;
    return searchIssues(query, token);
}

/**
 * fetch both issues authored by the user and issues mentioning the user
 * @param {string} username - GitHub username.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of unresolved issues.
 */
export async function fetchUnresolvedIssues(username, token) {
    const unresolvedIssuesByAuthor = await fetchUnresolvedIssuesByAuthor(username, token);
    const unresolvedIssuesByMention = await fetchUnresolvedIssuesByMention(username, token);

    // Combine both lists and remove duplicates
    const combinedIssues = [...new Set([...unresolvedIssuesByAuthor, ...unresolvedIssuesByMention])];

    // Map issues to the same structure as pull requests
    return combinedIssues.map(issue => ({
        ...issue,
        pull_request: {
            url: issue.pull_request ? issue.pull_request.url : null,
            html_url: issue.html_url,
            merged_at: null // Issues do not have merged_at, set to null
        },
        base: {
            repo: {
                full_name: issue.repository_url ? issue.repository_url.split('/').slice(-2).join('/') : null,
                owner: {
                    login: issue.repository_url ? issue.repository_url.split('/').slice(-2, -1).join('/') : null,
                    avatar_url: ''
                }
            }
        }
    }));
}

//
//
//  WATCHED FUNCTIONS
//
//

/**
 * Fetch watched repositories for the authenticated user.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of watched repositories.
 */
export async function fetchWatchedRepositories(token) {
    const watchListUrls = await getWatchListUrls();
    if (!watchListUrls || watchListUrls.length === 0) {
        return [];
    }

    const watchedRepos = [];
    for (const url of watchListUrls) {
        try {
            let repo = await fetchPullRequestByUrl(url, token);
            if (repo && repo.base && repo.base.repo && repo.base.repo.full_name) {
                watchedRepos.push(repo);
            }
        } catch (error) {
            console.error(`Error from Watched URL: ${url}:`, error);
        }
    }

    return watchedRepos;
}

//
//
//  MAIN FUNCTION TO FETCH AND FILTER PULL REQUESTS
//
//

/**
 * Fetch and filter pull requests where the user is a requested reviewer.
 * Includes repositories from both organizations and the user's personal repositories.
 * @param {string} username - GitHub username.
 * @param {string} token - GitHub personal access token.
 * @param {string} since - Optional parameter to filter comments since a specific date
 * @returns {Promise<Array>} - List of filtered pull requests.
 */
export async function fetchAndFilterPullRequests(username, token, since=null) {
    const allPullRequests = [];
    const teamPullRequests = [];
    const myPullRequests = [];

    const results = {};
    const teams = await fetchTeams(token);

    // Fetch repositories from organizations
    const organizations = await fetchOrganizations(token);
    for (const org of organizations) {
        const repositories = await fetchRepositories(org.login, token);
        for (const repo of repositories) {
            const pullRequests = await fetchPullRequests(org.login, repo.name, token);

            // Filter pull requests where the user is a requested reviewer
            const userRequestedPRs = filterPullRequestsByReviewer(pullRequests, username);
            allPullRequests.push(...userRequestedPRs);

            // Filter pull requests where the user is a member of the team requested for review
            const teamRequestedPRs = filterPullRequestsByTeams(pullRequests, teams);
            teamPullRequests.push(...teamRequestedPRs);

            // Filter pull requests where the user is the author
            const authorPRs = filterPullRequestsByAuthor(pullRequests, username);
            myPullRequests.push(...authorPRs);
        }
    }

    // Fetch user's personal repositories
    const userRepositories = await fetchUserRepositories(token);
    for (const repo of userRepositories) {
        const pullRequests = await fetchPullRequests(repo.owner.login, repo.name, token);
        const userRequestedPRs = filterPullRequestsByReviewer(pullRequests, username);
        allPullRequests.push(...userRequestedPRs);

        const teamRequestedPRs = filterPullRequestsByTeams(pullRequests, teams);
        teamPullRequests.push(...teamRequestedPRs);

        const authorPRs = filterPullRequestsByAuthor(pullRequests, username);
        myPullRequests.push(...authorPRs);
    }

    // Check for mentions in the pull requests
    const mentionsPullRequests = await searchForMentions(username, token);

    // Fetch unresolved issues authored by the user and issues where the user is mentioned
    const issuesPullRequests = await fetchUnresolvedIssues(username, token);

    // Fetch watched repositories
    const watchedRepos = await fetchWatchedRepositories(token);

    results['personal'] = allPullRequests;
    results['team']     = teamPullRequests;
    results['mentions'] = mentionsPullRequests;
    results['mine']     = myPullRequests;
    results['issues']   = issuesPullRequests;
    results['watched']  = watchedRepos; 

    // ensure we set the first update time -- used for display purposes
    setFirstUpdateTime();

    return results;
}
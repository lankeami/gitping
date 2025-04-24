const GITHUB_API_BASE_URL = 'https://api.github.com';

/**
 * Helper method to perform a fetch request to the GitHub API with pagination support.
 * @param {string} path - The API path (relative to the base URL).
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<any[]>} - The combined JSON response from all pages.
 * @throws {Error} - If the response is not OK.
 */
async function fetchFromGitHub(path, token) {
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
 * Fetch and filter pull requests where the user is a requested reviewer.
 * Includes repositories from both organizations and the user's personal repositories.
 * @param {string} username - GitHub username.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of filtered pull requests.
 */
export async function fetchAndFilterPullRequests(username, token) {
    const allPullRequests = [];
    try {
        // Fetch repositories from organizations
        const organizations = await fetchOrganizations(token);
        for (const org of organizations) {
            const repositories = await fetchRepositories(org.login, token);
            for (const repo of repositories) {
                const pullRequests = await fetchPullRequests(org.login, repo.name, token);
                const userRequestedPRs = filterPullRequestsByReviewer(pullRequests, username);
                allPullRequests.push(...userRequestedPRs);
            }
        }

        // Fetch user's personal repositories
        const userRepositories = await fetchUserRepositories(token);
        for (const repo of userRepositories) {
            const pullRequests = await fetchPullRequests(repo.owner.login, repo.name, token);
            const userRequestedPRs = filterPullRequestsByReviewer(pullRequests, username);
            allPullRequests.push(...userRequestedPRs);
        }
    } catch (error) {
        throw new Error(`Failed to fetch and filter pull requests: ${error.message}`);
    }

    return allPullRequests;
}
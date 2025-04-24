const GITHUB_API_BASE_URL = 'https://api.github.com';

/**
 * Fetch organizations for the authenticated user.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of organizations.
 */
export async function fetchOrganizations(token) {
    const url = `${GITHUB_API_BASE_URL}/user/orgs?per_page=100`;
    const response = await fetch(url, {
        headers: {
            Authorization: `token ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch organizations: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch repositories for a given organization.
 * @param {string} org - Organization name.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of repositories.
 */
export async function fetchRepositories(org, token) {
    const url = `${GITHUB_API_BASE_URL}/orgs/${org}/repos?type=all&per_page=100`;
    const response = await fetch(url, {
        headers: {
            Authorization: `token ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch repositories for ${org}: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch repositories for the authenticated user that are not part of an organization.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of personal repositories.
 */
export async function fetchUserRepositories(token) {
    const url = `${GITHUB_API_BASE_URL}/user/repos?type=owner&per_page=100`;
    const response = await fetch(url, {
        headers: {
            Authorization: `token ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch user repositories: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch pull requests for a given repository.
 * @param {string} org - Organization name.
 * @param {string} repo - Repository name.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of pull requests.
 */
export async function fetchPullRequests(org, repo, token) {
    const url = `${GITHUB_API_BASE_URL}/repos/${org}/${repo}/pulls?state=open&per_page=100`;
    const response = await fetch(url, {
        headers: {
            Authorization: `token ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch pull requests for ${org}/${repo}: ${response.statusText}`);
    }

    return response.json();
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
 * @param {string} username - GitHub username.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of filtered pull requests.
 */
export async function fetchAndFilterPullRequests(username, token) {
    const allPullRequests = [];
    try {
        const organizations = await fetchOrganizations(token);

        for (const org of organizations) {
            const repositories = await fetchRepositories(org.login, token);

            for (const repo of repositories) {
                const pullRequests = await fetchPullRequests(org.login, repo.name, token);
                const userRequestedPRs = filterPullRequestsByReviewer(pullRequests, username);
                allPullRequests.push(...userRequestedPRs);
            }
        }
    } catch (error) {
        throw new Error(`Failed to fetch and filter pull requests: ${error.message}`);
    }

    return allPullRequests;
}
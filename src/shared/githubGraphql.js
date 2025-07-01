import { getGitHubApiBaseUrl } from './storageUtils.js';

//
//
// GITHUB GRAPHQL API
//
//

/**
 * Helper function to define PR schema for the GraphQL query.
 * @returns {string} - The schema string for PRs.
 */
function getPrSchema() {
    return `
        pageInfo { 
            endCursor
            hasNextPage
        } 
        nodes { 
        __typename
        ... on PullRequest { 
            id
            title
            url
            number
            isDraft
            state
            createdAt
            updatedAt
            repository {
                name
                owner {
                    login
                    avatarUrl
                }
            }
            author {
                login
                avatarUrl
            }
            reviewRequests(first: 100) {
                nodes {
                    requestedReviewer {
                        __typename
                        ... on User {
                            login
                            avatarUrl
                        }
                        ... on Team {
                            name
                            slug
                        }
                    }
                }
            }
        }
    }
}`;
}

/**
 * Helper function to define Issue schema for the GraphQL query.
 * @returns {string} - The schema string for PRs.
 */
function getIssueSchema() {
    return `
        pageInfo { 
            endCursor
            hasNextPage
        } 
        nodes { 
        __typename
        ... on Issue { 
            id
            title
            url
            number
            state
            createdAt
            updatedAt
            repository {
                name
                owner {
                    login
                    avatarUrl
                }
            }
            author {
                login
                avatarUrl
            }
        }
    }
}`;
}

/**
 * Helper function to return a paginated query to use in fetchGraphQL
 * @param {string} query - The GraphQL query string.
 * @param {string} after - The page number to fetch.
 * @returns {string} - The paginated query string.
 */
function getPaginatedQuery(query, schema, after=null) {
    const pageNumber = after ? `"${after}"` : null;
    return `query {
        search(query: "${query}", type: ISSUE, first: 100, after: ${pageNumber}) {
        ${schema}
    }`;
}

/**
 * Helper method to perform a fetch request to the GitHub GraphQL API.
 * @param {string} query - The GraphQL query string.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<any>} - The JSON response from the API.
 * @throws {Error} - If the response is not OK or if the query fails.
 */
async function fetchGraphQL(query, schema, token, after = null) {
    const GITHUB_API_BASE_URL = await getGitHubApiBaseUrl();
    if (!GITHUB_API_BASE_URL) {
        throw new Error('Error: GitHub API URL is not set.');
    }
    const url = `${GITHUB_API_BASE_URL}/graphql`;

    const graphql = JSON.stringify({
        query: getPaginatedQuery(query, schema, after)
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: graphql,
    });

    const nodes = [];
    const data = await response.json();

    if (!response.ok) {
        throw new Error(`GitHub API request failed: ${response.statusText}`);
    }

    nodes.push(...data?.data?.search?.nodes || []);

    // check for pagination in data.search.pageInfo
    let pageInfo = data?.data?.search?.pageInfo || {hasNextPage: false};
    while (pageInfo.hasNextPage) {
        return nodes.push(
            ...(await fetchGraphQL(query, schema, token, pageInfo.endCursor))
        );
    }

    // check for the 
    return nodes;
}

/**
 * Fetch all pull requests from a specific search query
 * @param {string} query - The search query string.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - An array of pull requests.
 * @throws {Error} - If the fetchGraphQL request fails.
 */
export async function GQLSearchPullRequests(query, token) {
    const schema = getPrSchema();
    try {
        return await fetchGraphQL(query, schema, token);
    } catch (error) {
        throw new Error(`Failed to fetch pull requests: ${error.message}`);
    }
}

/**
 * Fetch all issues from a specific search query
 * @param {string} query - The search query string.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - An array of issues.
 * @throws {Error} - If the fetchGraphQL request fails.
 */
export async function GQLSearchIssues(query, token) {
    const schema = getIssueSchema();
    try {
        return await fetchGraphQL(query, schema, token);
    } catch (error) {
        throw new Error(`Failed to fetch issues: ${error.message}`);
    }
}
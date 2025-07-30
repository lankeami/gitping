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
            labels(first: 20) {
                nodes {
                    name
                    color
                    description
                }
            }

            commits(last: 1) {
                nodes {
                    commit {
                        message
                        committedDate
                        author {
                            user {
                                login
                                avatarUrl
                            }
                        }
                    }
                }
            }
            comments(last: 1) {
                nodes {
                    body
                    bodyHTML
                    author {
                        login
                        avatarUrl
                    }
                    createdAt
                    url
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
            labels(first: 20) {
                nodes {
                    name
                    color
                    description
                }
            }
            comments(last: 1) {
                nodes {
                    body
                    bodyHTML
                    author {
                        login
                        avatarUrl
                    }
                    createdAt
                    url
                }
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
 * Helper function to get the GraphQL query for fetching pull request details.
 * @returns {string} - The GraphQL query string for fetching pull request details.
 */
function getPullRequestQuery() {
    return `
query GetPullRequestDetails($owner: String!, $repo: String!, $pullNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pullNumber) {
      # --- Basic PR Details ---
      id
      __typename
      title
      url
      number
      isDraft
      state
      createdAt
      updatedAt

      # --- Author Details ---
      author {
        login
        avatarUrl
      }

      # --- Repository Details ---
      repository {
        name
        owner {
          login
          avatarUrl
        }
      }

      # --- Review Requests (first 10) ---
      reviewRequests(first: 10) {
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

      # --- Labels (first 20) ---
      labels(first: 20) {
        nodes {
          name
          color
          description
        }
      }

      # --- Last Commit Details ---
      commits(last: 1) {
        nodes {
          commit {
            message
            committedDate
            author {
              user {
                login
                avatarUrl
              }
            }
          }
        }
      }

      # --- Last Comment Details ---
      comments(last: 1) {
        nodes {
          body
          bodyHTML
          createdAt
          url
          author {
            login
            avatarUrl
          }
        }
      }
    }
  }
}
`;

}

/**
 * Helper function to get the GraphQL query for fetching issue details.
 * @returns {string} - The GraphQL query string for fetching issue details.
 */
function getIssueQuery() {
    return `
        query GetIssueDetails($owner: String!, $repo: String!, $issueNumber: Int!) {
            repository(owner: $owner, name: $repo) {
                issue(number: $issueNumber) {
                    __typename
                    id
                    number
                    title
                    bodyHTML
                    state
                    url
                    author {
                        login
                        avatarUrl
                    }
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
                    labels(first: 20) {
                        nodes {
                            name
                            color
                            description
                        }
                    }
                    comments(last: 1) {
                        nodes {
                            body
                            bodyHTML
                            author {
                                login
                                avatarUrl
                            }
                            createdAt
                            url
                        }
                    }
                    updatedAt
                    createdAt
                }
            }
        }
    `;
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
        const results = await fetchGraphQL(query, schema, token);
        return results;
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

//
//
// CUSTOM GRAPHQL QUERIES
//
//

/**
 * Fetch all pull requests from a specific search query
 * @param {string} query - The search query string.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - An array of pull requests.
 * @throws {Error} - If the fetchGraphQL request fails.
 */
async function fetchCustomGraphQL(query, variables, token) {
    const GITHUB_API_BASE_URL = await getGitHubApiBaseUrl();
    if (!GITHUB_API_BASE_URL) {
        throw new Error('Error: GitHub API URL is not set.');
    }
    const url = `${GITHUB_API_BASE_URL}/graphql`;

    const graphql = JSON.stringify({
        query: query,
        variables: variables,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: graphql,
    });

    if (!response.ok) {
        throw new Error(`GitHub API request failed: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Helper function to get the GraphQL query for fetching pull request details.
 * @param {*} owner 
 * @param {*} repo 
 * @param {*} pullNumber 
 * @param {*} token 
 * @returns {Promise<any>} - The JSON response of the Pull Request details.
 */
export async function GQLFetchPullRequest(owner, repo, pullNumber, token) {
    const query = getPullRequestQuery();

    // need to convert pullNumber to an integer
    pullNumber = parseInt(pullNumber, 10);
    let result = await fetchCustomGraphQL(query, {owner, repo, pullNumber}, token);

    if (!result || !result.data || !result.data.repository || !result.data.repository.pullRequest) {
        throw new Error(`Failed to fetch pull request details for ${owner}/${repo}#${pullNumber}`);
    }
    return result.data.repository.pullRequest;
}

/**
 * Helper function to get the GraphQL query for fetching issue details.
 * @param {*} owner 
 * @param {*} repo 
 * @param {*} issueNumber 
 * @param {*} token 
 * @returns {Promise<any>} - The JSON response of the Issue details.
 */
export async function GQLFetchIssue(owner, repo, issueNumber, token) {
    const query = getIssueQuery();

    // need to convert issueNumber to an integer
    issueNumber = parseInt(issueNumber, 10);
    let result = await fetchCustomGraphQL(query, {owner, repo, issueNumber}, token);

    if (!result || !result.data || !result.data.repository || !result.data.repository.issue) {
        throw new Error(`Failed to fetch issue details for ${owner}/${repo}#${issueNumber}`);
    }
    return result.data.repository.issue;
}
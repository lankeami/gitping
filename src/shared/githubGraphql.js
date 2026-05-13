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

            headRefOid
            commits(last: 1) {
                nodes {
                    commit {
                        message
                        messageHeadline
                        messageBody
                        messageBodyHTML
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
                    bodyText
                    author {
                        login
                        avatarUrl
                    }
                    createdAt
                    url
                }
            }

            reviews(last: 15) {
                nodes {
                    state
                    author {
                        login
                        avatarUrl
                    }
                    body
                    bodyHTML
                    bodyText
                    createdAt
                    comments(last: 1) {
                        nodes {
                            body
                            bodyHTML
                            bodyText
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
                    bodyText
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
    const fullQuery = `query {
        search(query: "${query}", type: ISSUE, first: 100, after: ${pageNumber}) {
        ${schema}
    }`;
    // Log first query for debugging
    if (!after) {
        console.log('[GraphQL] Query for:', query.substring(0, 50) + '...');
    }
    return fullQuery;
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
            messageHeadline
            messageBody
            messageBodyHTML
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
                bodyText
                createdAt
                url
                author {
                    login
                    avatarUrl
                }
            }
      }

      reviews(last: 15) {
        nodes {
            state
            author {
                login
                avatarUrl
            }
            body
            bodyHTML
            bodyText
            createdAt
            comments(last: 1) {
                nodes {
                    body
                    bodyHTML
                    bodyText
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
                            bodyText
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
        console.error('[GraphQL] Response not OK:', response.status, response.statusText);
        throw new Error(`GitHub API request failed: ${response.statusText}`);
    }

    // Check for GraphQL errors
    if (data.errors) {
        console.error('[GraphQL] Query errors:', data.errors);
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
 * Fetches pull request details from GitHub's GraphQL API.
 * Executes a GraphQL query to retrieve details of a specific pull request in a repository.
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {number} pullNumber - The pull request number to fetch details for.
 * @param {string} token - GitHub personal access token for authentication.
 * @returns {Promise<any>} - A promise that resolves to the JSON response containing the issue details.
 * @throws {Error} - If the fetch operation fails or the issue details are not found.
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
 * Fetches issue details from GitHub's GraphQL API.
 * Executes a GraphQL query to retrieve details of a specific issue in a repository.
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {number} issueNumber - The issue number to fetch details for.
 * @param {string} token - GitHub personal access token for authentication.
 * @returns {Promise<any>} - A promise that resolves to the JSON response containing the issue details.
 * @throws {Error} - If the fetch operation fails or the issue details are not found.
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

/**
 * GraphQL query for fetching commits on default branch
 */
function getDefaultBranchCommitsQuery() {
    return `
query GetDefaultBranchCommits($owner: String!, $repo: String!, $since: GitTimestamp!, $until: GitTimestamp!) {
    repository(owner: $owner, name: $repo) {
        name
        owner {
            login
        }
        defaultBranchRef {
            name
            target {
                ... on Commit {
                    history(first: 100, since: $since, until: $until) {
                        nodes {
                            oid
                            messageHeadline
                            message
                            committedDate
                            author {
                                name
                                email
                                user {
                                    login
                                    avatarUrl
                                }
                            }
                            associatedPullRequests(first: 1) {
                                nodes {
                                    number
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
`;
}

/**
 * Fetches commits on the default branch that are NOT associated with PRs
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {string} since - ISO timestamp for start of date range
 * @param {string} until - ISO timestamp for end of date range
 * @param {string} token - GitHub personal access token for authentication.
 * @returns {Promise<Array>} - Array of direct commits (not from PRs)
 */
export async function GQLFetchDirectCommits(owner, repo, since, until, token) {
    const query = getDefaultBranchCommitsQuery();

    try {
        const result = await fetchCustomGraphQL(query, { owner, repo, since, until }, token);

        if (!result?.data?.repository?.defaultBranchRef?.target?.history?.nodes) {
            return [];
        }

        const commits = result.data.repository.defaultBranchRef.target.history.nodes;
        const branchName = result.data.repository.defaultBranchRef.name;

        // Filter out commits that are associated with PRs
        const directCommits = commits.filter(commit => {
            const associatedPRs = commit.associatedPullRequests?.nodes || [];
            return associatedPRs.length === 0;
        });

        // Add repository info to each commit
        return directCommits.map(commit => ({
            ...commit,
            repository: {
                name: repo,
                owner: { login: owner }
            },
            branchName
        }));
    } catch (error) {
        console.error(`[GraphQL] Failed to fetch direct commits for ${owner}/${repo}:`, error);
        return [];
    }
}

/**
 * Fetches all repositories for an organization
 */
function getOrgReposQuery() {
    return `
query GetOrgRepos($org: String!, $after: String) {
    organization(login: $org) {
        repositories(first: 100, after: $after, orderBy: {field: PUSHED_AT, direction: DESC}) {
            pageInfo {
                hasNextPage
                endCursor
            }
            nodes {
                name
                owner {
                    login
                }
                isArchived
                defaultBranchRef {
                    name
                }
            }
        }
    }
}
`;
}

/**
 * Fetches direct commits across all repos in an organization
 * @param {string} org - The organization login
 * @param {string} since - ISO timestamp for start of date range
 * @param {string} until - ISO timestamp for end of date range
 * @param {string} token - GitHub personal access token
 * @returns {Promise<Array>} - Array of direct commits across all org repos
 */
export async function GQLFetchOrgDirectCommits(org, since, until, token) {
    const reposQuery = getOrgReposQuery();

    try {
        // First, get all repos in the org
        const reposResult = await fetchCustomGraphQL(reposQuery, { org }, token);
        const repos = reposResult?.data?.organization?.repositories?.nodes || [];

        // Filter out archived repos and repos without a default branch
        const activeRepos = repos.filter(repo => !repo.isArchived && repo.defaultBranchRef);

        console.log(`[GraphQL] Fetching direct commits for ${activeRepos.length} repos in ${org}`);

        // Fetch direct commits for each repo in parallel (limit to 10 at a time)
        const allCommits = [];
        const batchSize = 10;

        for (let i = 0; i < activeRepos.length; i += batchSize) {
            const batch = activeRepos.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(repo => GQLFetchDirectCommits(repo.owner.login, repo.name, since, until, token))
            );
            allCommits.push(...batchResults.flat());
        }

        return allCommits;
    } catch (error) {
        console.error(`[GraphQL] Failed to fetch org repos for ${org}:`, error);
        return [];
    }
}
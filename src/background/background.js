const GITHUB_API_URL = 'https://api.github.com';
const POLLING_INTERVAL = 60000; // 1 minute

async function getAuthToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['githubToken'], function(result) {
            resolve(result.githubToken);
        });
    });
}

async function getUsername() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['githubUsername'], function(result) {
            resolve(result.githubUsername);
        });
    });
}

async function fetchAndFilterPullRequests(username, token) {
    // TODO - pageinate all Github requests
    try {
        const orgsURL = `${GITHUB_API_URL}/user/orgs?per_page=100&page=1`;
        const orgsResponse = await fetch(orgsURL, {
            headers: {
                Authorization: `token ${token}`,
            },
        });

        // Check if the username and token were valid
        if (orgsResponse.status === 401) {
            throw new Error('Unauthorized: Invalid GitHub token');
        }

        if (!orgsResponse.ok) {
            throw new Error(`Failed to fetch organizations: ${orgsResponse.statusText}`);
        }

        const orgs = await orgsResponse.json();
        const allPullRequests = [];

        for (const org of orgs) {
            const reposURL = `${GITHUB_API_URL}/orgs/${org.login}/repos?type=all&per_page=100&page=1`;
            const reposResponse = await fetch(reposURL, {
                headers: {
                    Authorization: `token ${token}`,
                },
            });

            if (!reposResponse.ok) {
                throw new Error(`Failed to fetch repositories for ${org.login}: ${reposResponse.statusText}`);
            }

            const repos = await reposResponse.json();

            for (const repo of repos) {
                const prsURL = `${GITHUB_API_URL}/repos/${org.login}/${repo.name}/pulls?state=open&per_page=100&page=1`;
                const prsResponse = await fetch(prsURL, {
                    headers: {
                        Authorization: `token ${token}`,
                    },
                });

                if (!prsResponse.ok) {
                    throw new Error(`Failed to fetch pull requests for ${repo.name}: ${prsResponse.statusText}`);
                }

                const pullRequests = await prsResponse.json();

                // Filter pull requests where the user is in the requested_reviewers list
                const userRequestedPRs = pullRequests.filter((pr) =>
                    pr.requested_reviewers.some((reviewer) => reviewer.login === username)
                );

                allPullRequests.push(...userRequestedPRs);
            }
        }

        console.log('Open Pull Requests:', allPullRequests.length);
        return allPullRequests;
    } catch (error) {
        console.error('Error fetching pull requests:', error.message);
        chrome.storage.local.set({ lastError: error.message }); // Store the error message
        return []; // Return an empty array to avoid breaking the flow
    }
}

async function checkForUpdates() {
    try {
        const token = await getAuthToken();
        const username = await getUsername();

        if (token && username) {
            // Fetch the latest pull requests
            const pullRequests = await fetchAndFilterPullRequests(username, token);

            // Extract and sort the SHA values from the fetched pull requests
            const fetchedShas = pullRequests.map(pr => pr.head.sha).sort();

            // Get the stored pull requests
            chrome.storage.local.get(['pullRequests'], function (result) {
                const storedPullRequests = result.pullRequests || [];
                const storedShas = storedPullRequests.map(pr => pr.head.sha).sort();

                // Compare the sorted SHA arrays
                if (JSON.stringify(fetchedShas) !== JSON.stringify(storedShas)) {
                    console.log('Pull requests have changed. Updating storage...');
                    chrome.storage.local.set({ pullRequests: pullRequests });
                    updateExtensionBadge(pullRequests.length);
                }

                // Store the current timestamp as the last update time
                chrome.storage.local.set({ lastUpdateTime: new Date().toISOString() });
                // Clear the Last Error
                chrome.storage.local.set({ lastError: "" });
            });
        }
    } catch (error) {
        chrome.storage.local.set({ lastError: error.message }); // Store the error message
        updateExtensionBadge(0); // Clear the badge if an error occurs
    }
}

function updateExtensionBadge(count) {
    if (count > 0) {
        chrome.action.setBadgeText({ text: count.toString() }); // Set the badge text
        chrome.action.setBadgeBackgroundColor({ color: '#FF8469' }); // Set the badge color (red)
    } else {
        chrome.action.setBadgeText({ text: '' }); // Clear the badge if no PRs
    }
}

// Create an alarm to trigger periodic updates
chrome.alarms.create('checkForUpdates', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
    console.log(new Date().toLocaleString(), ': Alarm triggered:', alarm.name);
    if (alarm.name === 'checkForUpdates') {
        checkForUpdates();
    }
});
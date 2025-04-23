import { getAuthToken, getUsername, updateExtensionBadge, resetLocalStorage } from '../shared/storageUtils.js';
import { fetchOrganizations, fetchRepositories, fetchPullRequests, filterPullRequestsByReviewer } from '../shared/githubApi.js';

const POLLING_INTERVAL = 60000; // 1 minute

async function fetchAndFilterPullRequests(username, token) {
    const allPullRequests = [];
    try {
        const orgs = await fetchOrganizations(token);

        for (const org of orgs) {
            const repos = await fetchRepositories(org.login, token);

            for (const repo of repos) {
                const pullRequests = await fetchPullRequests(org.login, repo.name, token);
                const userRequestedPRs = filterPullRequestsByReviewer(pullRequests, username);
                allPullRequests.push(...userRequestedPRs);
            }
        }
    } catch (error) {
        console.error('Error fetching pull requests:', error);
        throw error;
    }

    return allPullRequests;
}

// Use getAuthToken and getUsername from shared module
async function checkForUpdates() {
    try {
        const token = await getAuthToken();
        const username = await getUsername();

        if (token && username) {
            const pullRequests = await fetchAndFilterPullRequests(username, token);
            chrome.storage.local.set({ pullRequests });
            updateExtensionBadge(pullRequests.length);
        }
    } catch (error) {
        console.error('Error during update check:', error);
        updateExtensionBadge('?');
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
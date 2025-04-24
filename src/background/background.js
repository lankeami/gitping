import { getAuthToken, getUsername, updateExtensionBadge, resetLocalStorage } from '../shared/storageUtils.js';
import { fetchOrganizations, fetchRepositories, fetchPullRequests, filterPullRequestsByReviewer, fetchAndFilterPullRequests } from '../shared/githubApi.js';

const POLLING_INTERVAL = 60000; // 1 minute

// Use getAuthToken and getUsername from shared module
async function checkForUpdates() {
    try {
        const token = await getAuthToken();
        const username = await getUsername();

        if (token && username) {
            const pullRequests = await fetchAndFilterPullRequests(username, token);
            chrome.storage.local.set({ pullRequests });
            updateExtensionBadge(pullRequests.length);

            // Store the current timestamp as the last update time
            chrome.storage.local.set({ lastUpdateTime: new Date().toISOString() });
            // Clear the Last Error
            chrome.storage.local.set({ lastError: "" });
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
import { getAuthToken, getUsername, updateExtensionBadge } from '../shared/storageUtils.js';
import { fetchAndFilterPullRequests } from '../shared/githubApi.js';

const POLLING_INTERVAL_MINUTES = 2;

// Use getAuthToken and getUsername from shared module
async function checkForUpdates() {
    try {
        const token = await getAuthToken();
        const username = await getUsername();

        if (token && username) {
            const pullRequests = await fetchAndFilterPullRequests(username, token);
            const personalPullRequests = pullRequests.personal;
            const teamPullRequests = pullRequests.teams;
            chrome.storage.local.set({ personalPullRequests });
            chrome.storage.local.set({ teamPullRequests });
            updateExtensionBadge(personalPullRequests.length);

            // Store the current timestamp as the last update time
            chrome.storage.local.set({ lastUpdateTime: new Date().toISOString() });
            // Clear the Last Error
            chrome.storage.local.set({ lastError: "" });
        }
    } catch (error) {
        console.error('checkForUpdates Error:', error);
    }
}

// Create an alarm to trigger periodic updates
chrome.alarms.create('checkForUpdates', { periodInMinutes: POLLING_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
    console.log(new Date().toLocaleString(), ': Alarm triggered:', alarm.name);
    if (alarm.name === 'checkForUpdates') {
        checkForUpdates();
    }
});
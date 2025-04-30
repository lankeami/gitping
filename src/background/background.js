import { getAuthToken, getUsername, updateExtensionBadge, getPersonalReviewRequests, getLastUpdateTime } from '../shared/storageUtils.js';
import { fetchAndFilterPullRequests } from '../shared/githubApi.js';

const POLLING_INTERVAL_MINUTES = 2;

/**
 * Flattens a list of pull requests to a list of commit hashes.
 * @param {Array} pullRequests - List of pull request objects.
 * @returns {Array<string>} - List of commit hashes.
 */
function flattenPullRequestsToCommitHashes(pullRequests) {
    if (!Array.isArray(pullRequests)) {
        console.log('Invalid pull requests data:', pullRequests);
        return [];
    }
    if (pullRequests.length === 0) {
        console.log('No pull requests found.');
        return [];
    }
    // Assuming each pull request has a `head` property with a `sha` field
    // If the structure is different, adjust this line accordingly

    return pullRequests.map((pr) => pr.head.sha); // Assuming `head.sha` contains the commit hash
}

// Use getAuthToken and getUsername from shared module
async function checkForUpdates() {
    try {
        const token = await getAuthToken();
        const username = await getUsername();
        const lastUpdateTime = await getLastUpdateTime();

        if (token && username) {
            // pull the current personal pull requests from local storage
            const currentPersonalPullRequests = await getPersonalReviewRequests();

            // Check Github for new pull requests
            const pullRequests = await fetchAndFilterPullRequests(username, token, lastUpdateTime);

            // Set the fetched pull requests in local storage
            const personalPullRequests = pullRequests.personal;
            const teamPullRequests = pullRequests.teams;
            const mentionsPullRequests = pullRequests.mentions;

            chrome.storage.local.set({ personalPullRequests });
            chrome.storage.local.set({ teamPullRequests });
            chrome.storage.local.set({ mentionsPullRequests });

            // compare the flattened pull requests with the previously stored ones
            const currentPersonalPullRequestsHashes = flattenPullRequestsToCommitHashes(currentPersonalPullRequests);
            const personalPullRequestsHashes = flattenPullRequestsToCommitHashes(personalPullRequests);
            const mentionPullRequestsHashes = flattenPullRequestsToCommitHashes(mentionsPullRequests);

            // Check if there are new pull requests
            const newPullRequests = personalPullRequests.filter((pr) => !currentPersonalPullRequestsHashes.includes(pr.head.sha));
            if (newPullRequests.length > 0) {
                // Update the extension badge with the count of personal pull requests
                console.log('New personal pull requests:', newPullRequests);
                updateExtensionBadge(personalPullRequests.length);
            }

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
    console.log(new Date().toLocaleString(), ': Job scheduled:', alarm.name);
    if (alarm.name === 'checkForUpdates') {
        checkForUpdates();
    }
});
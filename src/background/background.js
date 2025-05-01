import { getAuthToken, getUsername, updateExtensionBadge, getPersonalReviewRequests, getLastUpdateTime, getMentions, getMinePullRequests } from '../shared/storageUtils.js';
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

/**
 * Flattens a list of mentions to a list of ids.
 * @param {Array} mentions - List of mention objects.
 * @returns {Array<string>} - List of commit hashes.
 */
function flattenMentionsToIds(mentions) {
    if (!Array.isArray(mentions)) {
        console.log('Invalid mentions data:', mentions);
        return [];
    }
    if (mentions.length === 0) {
        console.log('No mentions found.');
        return [];
    }
    // Assuming each mention has a `commit` property with a `sha` field
    // If the structure is different, adjust this line accordingly

    return mentions.map((mention) => mention.id); // Assuming `commit.sha` contains the commit hash
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
            const currentMentions = await getMentions();
            const currentMine = await getMinePullRequests();

            // Check Github for new pull requests
            const pullRequests = await fetchAndFilterPullRequests(username, token, lastUpdateTime);

            // Set the fetched pull requests in local storage
            const personalPullRequests = pullRequests.personal;
            const teamPullRequests = pullRequests.teams;
            const mentionsPullRequests = pullRequests.mentions;
            const minePullRequests = pullRequests.mine;

            chrome.storage.local.set({ personalPullRequests });
            chrome.storage.local.set({ teamPullRequests });
            chrome.storage.local.set({ mentionsPullRequests });
            chrome.storage.local.set({ minePullRequests });

            // compare the flattened pull requests with the previously stored ones
            const currentPersonalPullRequestsHashes = flattenPullRequestsToCommitHashes(currentPersonalPullRequests);
            const currentMentionsIds = flattenMentionsToIds(currentMentions);
            const currentMinePullRequestsHashes = flattenPullRequestsToCommitHashes(currentMine);

            // Check if there are new pull requests
            const newPullRequests = personalPullRequests.filter((pr) => !currentPersonalPullRequestsHashes.includes(pr.head.sha));
            const newMentions = mentionsPullRequests.filter((mention) => !currentMentionsIds.includes(mention.id));
            const newMine = minePullRequests.filter((pr) => !currentMinePullRequestsHashes.includes(pr.head.sha));

            if (newPullRequests.length > 0 || newMentions.length > 0 || newMine.length > 0) {
                // Update the extension badge with the count of personal pull requests
                console.log('New personal pull requests:', newPullRequests);
                console.log('New mentions:', newMentions);
                console.log('New mine:', newMine);
                updateExtensionBadge(newPullRequests.length + newMentions.length + newMine.length);
            }

            // Store the current timestamp as the last update time
            chrome.storage.local.set({ lastUpdateTime: new Date().toLocaleString() });
            // Clear the Last Error
            chrome.storage.local.set({ lastError: "" });
        }
    } catch (error) {
        console.error(error);
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
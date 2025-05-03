import { getAuthToken, getUsername, updateExtensionBadge, getPersonalReviewRequests, getLastUpdateTime, getMentions, getMinePullRequests, getStoredPullRequests, setLastUpdateTime, setLastError } from '../shared/storageUtils.js';
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
            // do the new modular way
            const currentPullRequests = await getStoredPullRequests();
            const pullRequests = await fetchAndFilterPullRequests(username, token, lastUpdateTime);
            var diffs = {}

            Object.keys(currentPullRequests).forEach(element => {
                // see the difference between the current and the new pull requests                
                const newPullRequests = pullRequests[element].filter((pr) =>  {
                    // if mentions, use id
                    if (element === "mentions") {
                        const currentMentionsIds = flattenMentionsToIds(currentPullRequests[element]);
                        return !currentMentionsIds.includes(pr.id);
                    } else {
                        const currentPullRequestsHashes = flattenPullRequestsToCommitHashes(currentPullRequests[element]);
                        return !currentPullRequestsHashes.includes(pr.head.sha);
                    }
                });    
                diffs[element] = newPullRequests;
            });

            // save each set of pull requests in local storage
            Object.keys(pullRequests).forEach(element => {
                var key = element + "PullRequests";
                // save key and value in local storage
                chrome.storage.local.set({ [key]: pullRequests[element] });
            });

            // set the last update time
            setLastUpdateTime();

            // update the extension badge with the sum of the lengths of the arrays in diffs
            const totalNewPullRequests = Object.values(diffs).reduce((acc, arr) => acc + arr.length, 0);
            updateExtensionBadge(totalNewPullRequests);

            // reset the last error
            setLastError("");
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
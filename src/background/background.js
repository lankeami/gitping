import { getAppVersion, setAppVersion, getAuthToken, getUsername, updateExtensionBadge, getPersonalReviewRequests, getLastUpdateTime, getMentions, getMinePullRequests, getStoredPullRequests, setLastUpdateTime, setLastError, getPollingInterval, getLastViewedTime, pruneLocalStorage } from '../shared/storageUtils.js';
import { setLastPushNotificationDate, getLastPushNotificationDate, triggerPushNotification, setLastViewedTime } from '../shared/storageUtils.js';
import { fetchAndFilterPullRequests } from '../shared/githubApi.js';

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

        if (token && username) {
            // do the new modular way
            const currentPullRequests = await getStoredPullRequests();
            const pullRequests = await fetchAndFilterPullRequests(username, token);
            const lastViewedTime = await getLastViewedTime();
            const appVersion = chrome.runtime.getManifest().version;
            const lastAppVersion = await getAppVersion();
            if (appVersion && appVersion !== lastAppVersion) {
                console.log("App version has changed from ", lastAppVersion, "to", appVersion);
            }

            var diffs = {}

            Object.keys(currentPullRequests).forEach(element => {
                // see the difference between the current and the new pull requests
                const newPullRequests = pullRequests[element].filter((pr) => {
                    // if lastViewedTime is not set or null, include all pull requests
                    if (lastViewedTime === null || lastViewedTime === undefined) {
                        return true;
                    }
                    let updatedAt = pr.updatedAt || pr.updated_at || null;
                    // if the pr's updated_at is not set, include it into diffs
                    if (updatedAt === null) {
                        return true;
                    }
                    // if the pr's updated_at is greater than the lastViewedTime, include it into diffs
                    // make sure they are both unix timestamps
                    var prUpdatedAt = Date.parse(`${updatedAt}`);
                    var viewedTime = Date.parse(lastViewedTime);
                    if (prUpdatedAt > viewedTime) {
                        return true;
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
            setLastError();

            // set current app version
            setAppVersion();
        }
    } catch (error) {
        setLastError("Error checkForUpdates: " + error.message);
        // console log the stack trace for debugging
        console.error("Error in checkForUpdates:", error);
    }
}

// Create an alarm to trigger periodic updates
const pollingInterval = 5;
const purgeLocalStorageInterval = (60 * 24); // set to 1 day
const dailyLoginNotificationInterval = (60 * 24); // set to 1 day
chrome.alarms.create('dailyLoginNotification', { periodInMinutes: dailyLoginNotificationInterval, delayInMinutes: 0 });
chrome.alarms.create('checkForUpdates', { periodInMinutes: pollingInterval, delayInMinutes: 0 });
chrome.alarms.create('pruneLocalStorage', {periodInMinutes: purgeLocalStorageInterval, delayInMinutes: 0})

chrome.alarms.onAlarm.addListener((alarm) => {
    console.log(new Date().toLocaleString(), ': Job scheduled:', alarm.name);
    if (alarm.name === 'checkForUpdates' || alarm.name === 'popupCheckForUpdates') {
        checkForUpdates();
    };

    if (alarm.name === 'pruneLocalStorage') {
        pruneLocalStorage();
    }

    if (alarm.name === 'dailyLoginNotification') {
        sendDailyLoginNotificationIfNeeded();
    }

    if (alarm.name === 'updateLastViewedTime') {
        // update the last viewed time to now
        setLastViewedTime();
    }
});

/**
 * Checks if user is not logged in and sends a daily push notification encouraging login.
 */
async function sendDailyLoginNotificationIfNeeded() {
    console.log("Sending daily login notification to user to encourage login.");
    const token = await getAuthToken();
    if (!token && await shouldSendPushNotification()) {
        triggerPushNotification('Log in to GitPing to become a more efficient developer. Get real-time updates on reviews and issues.');
        await setLastPushNotificationDate(Date.now());
    }
}

/**
 * Check if a push notification should be sent (once per day).
 * @returns {Promise<boolean>} - True if notification should be sent.
 */
async function shouldSendPushNotification() {
    const lastDate = await getLastPushNotificationDate();
    if (!lastDate) return true;
    const now = Date.now();
    // dailyLoginNotificationInterval is in minutes, convert to ms
    return (now - lastDate) > dailyLoginNotificationInterval * 60 * 1000;
}
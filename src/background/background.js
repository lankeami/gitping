import { fetchOrganizations, fetchRepositories, fetchPullRequests, filterPullRequestsByReviewer } from '../shared/githubApi.js';

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

// Function to trigger a push notification using chrome.notifications API
function triggerPushNotification(msg) {
    const notificationOptions = {
        type: 'basic',
        iconUrl: '/icons/icon48.png', // Replace with the path to your extension's icon
        title: 'GitPing | Notice',
        message: msg,
        priority: 2
    };

    chrome.notifications.create('newPullRequests', notificationOptions, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.error('Failed to create notification:', chrome.runtime.lastError.message);
        } else {
            console.log('Notification shown with ID:', notificationId);
        }
    });

    // Optional: Add a click event listener for the notification
    chrome.notifications.onClicked.addListener((notificationId) => {
        if (notificationId === 'newPullRequests') {
            chrome.notifications.clear(notificationId); // Clear the notification
            chrome.tabs.create({ url: 'https://github.com/pulls/review-requested' }); // Open the GitHub page
        }
    });
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

                    // Trigger a push notification for new pull requests
                    triggerPushNotification(`You have ${pullRequests.length} new pull requests to review.`);
                }

                // Store the current timestamp as the last update time
                chrome.storage.local.set({ lastUpdateTime: new Date().toISOString() });
                // Clear the Last Error
                chrome.storage.local.set({ lastError: "" });
            });
        }
    } catch (error) {
        chrome.storage.local.set({ lastError: error.message }); // Store the error message
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
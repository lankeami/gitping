/**
 * Retrieve the GitHub token from chrome.storage.local.
 * @returns {Promise<string>} - The GitHub token.
 */
export async function getAuthToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['githubToken'], (result) => {
            resolve(result.githubToken);
        });
    });
}

/**
 * Retrieve the GitHub username from chrome.storage.local.
 * @returns {Promise<string>} - The GitHub username.
 */
export async function getUsername() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['githubUsername'], (result) => {
            resolve(result.githubUsername);
        });
    });
}

/**
 * Retrieve the GitHub API URL from chrome.storage.local.
 * @returns {Promise<string>} - The GitHub API URL.
 */
export async function getGitHubApiBaseUrl() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['githubApiBaseUrl'], (result) => {
            resolve(result.githubApiBaseUrl);
        });
    });
}

/**
 * Retrieve the polling interval from chrome.storage.local.
 * @returns {Promise<number>} - The polling interval in milliseconds.
 */
export async function getPollingInterval() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['pollingInterval'], (result) => {
            resolve(parseInt(result.pollingInterval, 2));
        });
    });
}

/**
 * Retrieve the lastUpdateTime from chrome.storage.local.
 * @returns {Promise<string>} - The GitHub username.
 */
export async function getLastUpdateTime() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['lastUpdateTime'], (result) => {
            resolve(result.lastUpdateTime);
        });
    });
}

/**
 * Set the lastUpdateTime in chrome.storage.local.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 * @description Sets the last update time to the current date and time in local storage.
 * The time is formatted as a locale string.
 */
export async function setLastUpdateTime() {
    const lastUpdateTime = new Date().toLocaleString();

    return new Promise((resolve) => {
        chrome.storage.local.set({ lastUpdateTime }, () => {
            resolve();
        });
    });
}

/**
 * Retrieve the lastError from chrome.storage.local.
 * @returns {Promise<string>} - The last error message.
 */
export async function getLastError() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['lastError'], (result) => {
            resolve(result.lastError);
        });
    });
}

/**
 * Set the lastError in chrome.storage.local.
 * @param {string} lastError - The last error message to set.
 */
export async function setLastError(lastError) {
    if (lastError === undefined || lastError === null) {
        lastError = '';
    }
    return new Promise((resolve) => {
        chrome.storage.local.set({ lastError }, () => {
            resolve();
        });
    });
}

/**
 * Retrieve review requests for user from chrome.storage.local.
 * @returns {Promise<string>} - The GitHub username.
 */
export async function getPersonalReviewRequests() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['personalPullRequests'], (result) => {
            resolve(result.personalPullRequests);
        });
    });
}

/** getMentions
 * Retrieve mentions from chrome.storage.local.
 * @returns {Promise<string>} - The GitHub username.
 */
export async function getMentions() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['mentionsPullRequests'], (result) => {
            resolve(result.mentionsPullRequests);
        });
    });
}

/** getMinePullRequests
 * Retrieve mine pull requests from chrome.storage.local.
 * @returns {Promise<string>} - The GitHub username.
 */
export async function getMinePullRequests() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['minePullRequests'], (result) => {
            resolve(result.minePullRequests);
        });
    });
}

/**
 * getTeamPullRequests
 * Retrieve team pull requests from chrome.storage.local.
 * @returns {Promise<string>} - The GitHub username.   
 */
export async function getTeamPullRequests() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['teamPullRequests'], (result) => {
            resolve(result.teamPullRequests);
        });
    });
}

/**
 * getStoredPullRequests
 * Retrieve all pull requests from chrome.storage.local.
 * @returns {Promise<string>} - The GitHub username.
 */
export async function getStoredPullRequests() {
    return new Promise((resolve) => {
        // TODO: hard coded Tab names / stored pull requests -- make them configurable
        chrome.storage.local.get(['personalPullRequests', 'teamPullRequests', 'mentionsPullRequests', 'minePullRequests'], (result) => {
            resolve({
                personal: result.personalPullRequests,
                team: result.teamPullRequests,
                mentions: result.mentionsPullRequests,
                mine: result.minePullRequests
            });
        });
    });
}

/**
 * Update the extension badge with the given count.
 * @param {number|string} count - The number to display on the badge.
 */
export function updateExtensionBadge(count) {
    if(count === undefined || count === null) {
        return;
    }

    const text = count > 0 ? count.toString() : '';
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF8469' });

    if(count > 0) {
        triggerPushNotification(`You have ${count} new pull requests to review!`);
    }
}

/**
 * Reset all GitHub-related data in chrome.storage.local.
 * @returns {Promise<void>}
 */
export async function resetLocalStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.remove(
            ['githubToken', 'githubUsername', 'pullRequests', 'lastError', 'lastUpdateTime'],
            () => {
                resolve();
            }
        );
    });
}

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
            console.log('Notification clicked:', notificationId);
            // Open the extension popup
            chrome.action.openPopup();
        }
    });
}
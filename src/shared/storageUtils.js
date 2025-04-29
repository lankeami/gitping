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
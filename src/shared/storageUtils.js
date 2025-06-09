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
 * sets the firstUpdateTime in chrome.storage.local.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 * @description Sets the first update time to the current date and time in local storage.
 * The time is formatted as a locale string.
 */
export async function setFirstUpdateTime() {
    const firstUpdateTime = new Date().toLocaleString();

    // check if the time is already set
    // if it is, do not set it again, just return
    // this is used to prevent overwriting the first update time
    const isSet = await getFirstUpdateTime();
    if (isSet) {
        return;
    }

    return new Promise((resolve) => {
        chrome.storage.local.set({ firstUpdateTime }, () => {
            resolve();
        });
    });
}

/** 
 * retrieves the firstUpdateTime from chrome.storage.local.
 * @returns {Promise<string>} - The first update time.
 * @description Retrieves the first update time from local storage.
 * The time is formatted as a locale string.
 */
export async function getFirstUpdateTime() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['firstUpdateTime'], (result) => {
            resolve(result.firstUpdateTime);
        });
    });
}

/**
 * sets the lastViewedTime in chrome.storage.local.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 * @description Sets the last viewed time to the current date and time in local storage.
 * The time is formatted as a locale string.
 */
export async function setLastViewedTime() {
    const lastViewedTime = new Date().toLocaleString();

    return new Promise((resolve) => {
        chrome.storage.local.set({ lastViewedTime }, () => {
            resolve();
        });
    });
}

/**
 * retrieves the lastViewedTime from chrome.storage.local.
 * @returns {Promise<string>} - The last viewed time.
 * @description Retrieves the last viewed time from local storage.
 */
export async function getLastViewedTime() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['lastViewedTime'], (result) => {
            resolve(result.lastViewedTime);
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
            if (lastError !== '') {
                console.error(lastError);
            }
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
        chrome.storage.local.get(['personalPullRequests', 'teamPullRequests', 'mentionsPullRequests', 'minePullRequests', 'issuesPullRequests', 'watchedPullRequests'], (result) => {
            resolve({
                personal: result.personalPullRequests,
                team:     result.teamPullRequests,
                mentions: result.mentionsPullRequests,
                mine:     result.minePullRequests,
                issues:   result.issuesPullRequests,
                watched:  result.watchedPullRequests
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
        chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
                console.error('Error clearing local storage:', chrome.runtime.lastError);
            } else {
                console.log('Local storage cleared successfully.');
            }
        });
    });
}

//
// WATCH LIST UTILS
//

/**
 * Retrieve a list of URLs for the watch list from chrome.storage.local.
 * @returns {Promise<string[]>} - The list of URLs.
 */
export async function getWatchListUrls() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['watchListUrls'], (result) => {
            const watchListUrls = result.watchListUrls || [];
            if (!Array.isArray(watchListUrls)) {
                console.error('Watch list URLs are not an array:', watchListUrls);
                resolve([]);
            } else {
                resolve(watchListUrls);
            }
        });
    });
}

/**
 * Add a URL to the watch list in chrome.storage.local.
 * @param {string} url - The URL to add to the watch list.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export async function addToWatchList(url) {
    if (!url) {
        console.error('URL must be provided to add to watch list.');
        return;
    }

    return new Promise((resolve) => {
        chrome.storage.local.get(['watchListUrls'], (result) => {
            const watchListUrls = result.watchListUrls || [];
            if (!Array.isArray(watchListUrls)) {
                console.error('Watch list URLs are not an array:', watchListUrls);
                resolve();
                return;
            }

            if (!watchListUrls.includes(url)) {
                watchListUrls.push(url);
                chrome.storage.local.set({ watchListUrls }, () => {
                    resolve();
                });
            } else {
                console.log('URL already exists in watch list:', url);
                resolve();
            }
        });
    });
}

/**
 * Remove a URL from the watch list in chrome.storage.local.
 * @param {string} url - The URL to remove from the watch list.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.   
 */
export async function removeFromWatchList(url) {
    if (!url) {
        console.error('URL must be provided to remove from watch list.');
        return;
    }

    return new Promise((resolve) => {
        chrome.storage.local.get(['watchListUrls'], (result) => {
            const watchListUrls = result.watchListUrls || [];
            if (!Array.isArray(watchListUrls)) {
                console.error('Watch list URLs are not an array:', watchListUrls);
                resolve();
                return;
            }

            const index = watchListUrls.indexOf(url);
            if (index > -1) {
                watchListUrls.splice(index, 1);
                chrome.storage.local.set({ watchListUrls }, () => {
                    resolve();
                });
            } else {
                console.log('URL not found in watch list:', url);
                resolve();
            }
        });
    });
}

//
// PUSH NOTIFICATIONS
//

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

//
// AVATAR STORAGE UTILS
//

function avatarHashKey(username) {
    if (!username) {
        console.error('Username must be provided to generate avatar hash key.');
        return '';
    }

    // use today's date as part of the key to ensure it expires in 24 hours
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    // return a unique key for the avatar based on the username and today's date
    return `Avatar_${username}_${today}`;
}


/**
 * Retrieve the avatar URL for a given username from chrome.storage.local.
 * The avatar storage is a hash, so it first will fetch the avatar hash, then look up by avatarHashKey
 * @param {string} username - The GitHub username.
 * @returns {Promise<string>} - The avatar URL.
 */
export async function getAvatarUrl(username) {
    if (!username) {
        console.error('Username must be provided to retrieve avatar URL.');
        return '';
    }
    // Use the avatarHashKey function to generate a unique key for the avatar
    const avatarKey = avatarHashKey(username);

    // Retrieve the avatar URL from chrome.storage.local using the generated key
    return new Promise((resolve) => {
        chrome.storage.local.get([avatarKey], (result) => {
            const avatarUrl = result[avatarKey];
            if (avatarUrl) {
                resolve(avatarUrl);
            } else {
                resolve(null);
            }
        });
    });
}

/**
 *  Set the avatar URL for a given username in chrome.storage.local. It should expire in 24 hours.
 * @param {string} username - The GitHub username.
 * @param {string} avatarUrl - The avatar URL to store.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 * @description Stores the avatar URL in local storage with a key based on the username.
*/
export async function setAvatarUrl(username, avatarUrl) {
    if (!username || !avatarUrl) {
        console.error('Username and avatar URL must be provided.');
        return;
    }

    const avatarKey = avatarHashKey(username);

    return new Promise((resolve) => {
        chrome.storage.local.set({ [avatarKey]: avatarUrl }, () => {
            resolve();
        });
    });
}
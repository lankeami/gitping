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
/**
 * Get the last push notification date from chrome.storage.local.
 * @returns {Promise<number>} - The timestamp of the last notification (ms since epoch).
 */
export async function getLastPushNotificationDate() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['lastPushNotificationDate'], (result) => {
            resolve(result.lastPushNotificationDate);
        });
    });
}

/**
 * Set the last push notification date in chrome.storage.local.
 * @param {number} timestamp - The timestamp to set (ms since epoch).
 * @returns {Promise<void>}
 */
export async function setLastPushNotificationDate(timestamp) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ lastPushNotificationDate: timestamp }, () => {
            resolve();
        });
    });
}

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
    console.log('Popup hidden, setting last viewed time');
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
 * @param {Object} newItems - Optional object containing arrays of new PRs/issues by category.
 */
export function updateExtensionBadge(count, newItems = null) {
    if(count === undefined || count === null) {
        return;
    }

    const text = count > 0 ? count.toString() : '';
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF8469' });

    if(count > 0) {
        triggerPushNotification(count, newItems);
    }
}

/**
 * Reset all GitHub-related data in chrome.storage.local.
 * Also clears the extension badge.
 * @returns {Promise<void>}
 */
export async function resetLocalStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
                console.error('Error clearing local storage:', chrome.runtime.lastError);
                resolve();
            } else {
                console.log('Local storage cleared successfully.');
                // Clear the extension badge
                chrome.action.setBadgeText({ text: '' });
                resolve();
            }
        });
    });
}

/**
 * Prune unneeded stored data from local storage
 * @returns {Promise<void>}
 */
export async function pruneLocalStorage() {
    // create an array of prefixes to purge
    const prefix = ["Avatar_"];
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
            const keysToRemove = [];
            Object.keys(items).forEach((key) => {
                for (const p of prefix) {
                    if (key.startsWith(p)) {
                        keysToRemove.push(key);
                        break;
                    }
                }
            });
            if (keysToRemove.length > 0) {
                chrome.storage.local.remove(keysToRemove, () => {
                    resolve();
                });
            } else {
            resolve();
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

/**
 * Remove a PR from the watched list in chrome.storage.local by id
 * @param {number} id - The ID of the PR to remove from the watched list.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export async function removeWatchedPullRequest(id) {
    if (!id) {
        console.error('ID must be provided to remove from watched pull requests.');
        return;
    }

    return new Promise((resolve) => {
        chrome.storage.local.get(['watchedPullRequests'], (result) => {
            const watchedPullRequests = result.watchedPullRequests || [];
            if (!Array.isArray(watchedPullRequests)) {
                console.error('Watched pull requests are not an array:', watchedPullRequests);
                resolve();
                return;
            }

            const index = watchedPullRequests.findIndex(pr => pr.id === id);
            if (index > -1) {
                watchedPullRequests.splice(index, 1);
                chrome.storage.local.set({ watchedPullRequests }, () => {
                    resolve();
                });
            } else {
                console.log('PR ID not found in watched pull requests:', id);
                resolve();
            }
        });
    });
}

//
// PUSH NOTIFICATIONS
//

export function triggerPushNotification(count, newItems = null) {
    let notificationOptions;

    // If we have detailed PR/issue data, create a rich notification
    if (newItems && Object.keys(newItems).length > 0) {
        // Collect all new items into a single array with category labels
        const allItems = [];
        const categoryLabels = {
            personal: 'Review Requested',
            team: 'Team',
            mentions: 'Mentions',
            mine: 'Your PRs',
            issues: 'Issues',
            watched: 'Watched'
        };

        Object.entries(newItems).forEach(([category, items]) => {
            if (items && items.length > 0) {
                items.forEach(item => {
                    allItems.push({
                        category: categoryLabels[category] || category,
                        title: item.card?.title || item.title,
                        repo: item.card?.repo_name || item.repo_name,
                        type: (item.card?.type || item.type) === 'pulls' ? 'PR' : 'Issue'
                    });
                });
            }
        });

        // Limit to first 5 items to avoid overwhelming the notification
        const displayItems = allItems.slice(0, 5);
        const remaining = count - displayItems.length;

        // Build the notification message
        let message = displayItems.map(item =>
            `${item.type} • ${item.repo}: ${item.title}`
        ).join('\n');

        if (remaining > 0) {
            message += `\n\n...and ${remaining} more`;
        }

        notificationOptions = {
            type: 'basic',
            iconUrl: '/icons/icon48.png',
            title: `GitPing | ${count} new update${count > 1 ? 's' : ''}`,
            message: message,
            priority: 2
        };
    } else {
        // Fallback to simple notification if no detailed data available
        notificationOptions = {
            type: 'basic',
            iconUrl: '/icons/icon48.png',
            title: 'GitPing | Notice',
            message: `You have ${count} new pull request${count > 1 ? 's' : ''} to review!`,
            priority: 2
        };
    }

    chrome.notifications.create('newPullRequests', notificationOptions, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.error('Failed to create notification:', chrome.runtime.lastError.message);
        } else {
            console.log('Notification shown with ID:', notificationId);
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

//
// APP VERSION UTILS
//

/**
 * Set the app version in chrome.storage.local.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 * @description Stores the app version in local storage.
 * This is useful for tracking the version of the extension.
 * Function pulls the current version from the manifest and stores it
 */
export async function setAppVersion() {
    const manifest = chrome.runtime.getManifest();
    const appVersion = manifest.version;

    return new Promise((resolve) => {
        chrome.storage.local.set({ appVersion }, () => {
            resolve();
        });
    });
}

/**
 * Retrieve the app version from chrome.storage.local.
 * @returns {Promise<string>} - The app version.
 * @description Retrieves the app version from local storage.
 * This is useful for tracking the version of the extension.
 */
export async function getAppVersion() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['appVersion'], (result) => {
            const appVersion = result.appVersion;
            if (appVersion) {
                resolve(appVersion);
            } else {
                resolve(null);
            }
        });
    });
}

//
// CHROME EXTENSION REVIEW UTILS
//

/**
 * Check if the review toast should be suppressed.
 * @returns {Promise<boolean>} - true if toast should NOT be shown.
 */
export async function shouldSuppressReviewToast() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['reviewClickedAt', 'reviewSnoozedAt', 'userReviewedExtension'], (result) => {
            // Permanently suppress if user clicked the review link
            if (result.reviewClickedAt) {
                resolve(true);
                return;
            }
            // Migrate legacy one-shot flag: treat as a snooze, not permanent block.
            // The old setter used toLocaleString(), which is not reliably parseable — treat
            // an unparseable timestamp conservatively as "was shown recently, suppress now".
            if (result.userReviewedExtension && !result.reviewSnoozedAt) {
                const legacyTime = new Date(result.userReviewedExtension).getTime();
                if (isNaN(legacyTime)) {
                    resolve(true); // Can't determine when; suppress to avoid nagging
                    return;
                }
                const fourteenDays = 14 * 24 * 60 * 60 * 1000;
                resolve(Date.now() - legacyTime < fourteenDays);
                return;
            }
            // Suppress for 14 days after a dismiss/snooze
            if (result.reviewSnoozedAt) {
                const snoozedAt = new Date(result.reviewSnoozedAt).getTime();
                const fourteenDays = 14 * 24 * 60 * 60 * 1000;
                resolve(Date.now() - snoozedAt < fourteenDays);
                return;
            }
            resolve(false);
        });
    });
}

/**
 * Mark that the user clicked the review link (permanent suppress).
 */
export async function setReviewClicked() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ reviewClickedAt: new Date().toISOString() }, resolve);
    });
}

/**
 * Snooze the review toast for 14 days (dismiss without reviewing).
 */
export async function snoozeReviewToast() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ reviewSnoozedAt: new Date().toISOString() }, resolve);
    });
}

/**
 * Get the number of times the popup has been opened (for engagement gating).
 */
export async function getPopupOpenCount() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['popupOpenCount'], (result) => {
            resolve(result.popupOpenCount || 0);
        });
    });
}

/**
 * Increment the popup open counter.
 */
export async function incrementPopupOpenCount() {
    const count = await getPopupOpenCount();
    return new Promise((resolve) => {
        chrome.storage.local.set({ popupOpenCount: count + 1 }, resolve);
    });
}

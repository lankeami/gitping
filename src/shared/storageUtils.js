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
/**
 * Recap storage utilities for caching generated recaps
 */

const RECAP_CACHE_PREFIX = 'recap_';
const MAX_CACHED_RECAPS = 7;

/**
 * Get a cached recap for a specific date
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @returns {Promise<{ summary: string, markdown: string } | null>}
 */
export async function getRecapCache(dateKey) {
    const key = RECAP_CACHE_PREFIX + dateKey;

    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            const cached = result[key];
            if (cached && cached.summary && cached.markdown) {
                resolve(cached);
            } else {
                resolve(null);
            }
        });
    });
}

/**
 * Store a recap in the cache
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {{ summary: string, markdown: string }} recap - The recap to cache
 * @returns {Promise<void>}
 */
export async function setRecapCache(dateKey, recap) {
    const key = RECAP_CACHE_PREFIX + dateKey;

    return new Promise((resolve) => {
        chrome.storage.local.set({
            [key]: {
                summary: recap.summary,
                markdown: recap.markdown,
                cachedAt: new Date().toISOString()
            }
        }, async () => {
            // Clean up old caches
            await cleanupOldRecapCaches();
            resolve();
        });
    });
}

/**
 * Remove old recap caches, keeping only the most recent ones
 * @returns {Promise<void>}
 */
async function cleanupOldRecapCaches() {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
            // Find all recap cache keys
            const recapKeys = Object.keys(items).filter(key =>
                key.startsWith(RECAP_CACHE_PREFIX)
            );

            if (recapKeys.length <= MAX_CACHED_RECAPS) {
                resolve();
                return;
            }

            // Sort by date (newest first)
            recapKeys.sort((a, b) => {
                const dateA = a.replace(RECAP_CACHE_PREFIX, '');
                const dateB = b.replace(RECAP_CACHE_PREFIX, '');
                return dateB.localeCompare(dateA);
            });

            // Remove old caches
            const keysToRemove = recapKeys.slice(MAX_CACHED_RECAPS);

            if (keysToRemove.length > 0) {
                chrome.storage.local.remove(keysToRemove, () => {
                    console.log(`Cleaned up ${keysToRemove.length} old recap caches`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    });
}

/**
 * Clear all recap caches
 * @returns {Promise<void>}
 */
export async function clearAllRecapCaches() {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
            const recapKeys = Object.keys(items).filter(key =>
                key.startsWith(RECAP_CACHE_PREFIX)
            );

            if (recapKeys.length > 0) {
                chrome.storage.local.remove(recapKeys, () => {
                    console.log(`Cleared ${recapKeys.length} recap caches`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    });
}

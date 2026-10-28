/**
 * Human-friendly labels for the storage/bucket keys used by the badge and push notifications.
 * Pure module (no chrome.* access) so it can be unit tested.
 */
export const BUCKET_LABELS = {
    personal: 'Review Requested',
    team: 'Team',
    mentions: 'Mentions',
    mine: 'Your PRs',
    issues: 'Issues',
    watched: 'Watched',
    copilot: 'Copilot reviews'
};

/**
 * Label for a bucket key; unknown keys fall back to the raw key so nothing is ever blank.
 * @param {string} key - Bucket key, e.g. 'personal' or 'copilot'.
 * @returns {string}
 */
export function getBucketLabel(key) {
    return Object.prototype.hasOwnProperty.call(BUCKET_LABELS, key) ? BUCKET_LABELS[key] : key;
}

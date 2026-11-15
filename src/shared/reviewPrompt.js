/**
 * Popup "Rate it" prompt.
 *
 * The counted events are pull-request updates GitPing has actually notified
 * the user about (`gp_pr_ping_count`). Each desktop notification adds the
 * number of PR updates in that ping. Issues and the signed-out login reminder
 * are not counted. The popup sentence uses this same total.
 *
 * No chrome.storage clearing happens on install or update in background.js,
 * so these keys are not part of a keep-list. They live in chrome.storage.local.
 */

export const GP_FIRST_USE_TIME = 'gp_first_use_time';
export const GP_REVIEW_CLICKED_AT = 'gp_review_clicked_at';
export const GP_REVIEW_DISMISS_COUNT = 'gp_review_dismiss_count';
export const GP_REVIEW_SNOOZED_AT = 'gp_review_snoozed_at';
export const GP_LAST_NOTIFICATION_CLICK = 'gp_last_notification_click';
export const GP_REVIEW_LAST_CHECKED_AT = 'gp_review_last_checked_at';
export const GP_PR_PING_COUNT = 'gp_pr_ping_count';

export const REVIEW_STORAGE_KEYS = [
    GP_FIRST_USE_TIME,
    GP_REVIEW_CLICKED_AT,
    GP_REVIEW_DISMISS_COUNT,
    GP_REVIEW_SNOOZED_AT,
    GP_LAST_NOTIFICATION_CLICK,
    GP_REVIEW_LAST_CHECKED_AT,
    GP_PR_PING_COUNT,
];

export const REVIEW_MIN_USE_MS = 7 * 24 * 60 * 60 * 1000;
export const REVIEW_MIN_EVENTS = 20;
export const REVIEW_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
/** Show only while the dismiss count is under this. The second dismissal is permanent. */
export const REVIEW_MAX_DISMISSALS = 2;

export const REVIEW_PROBLEM_URL = 'https://github.com/lankeami/gitping/issues';

const PR_TYPES = new Set(['pulls', 'pull', 'PR']);

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function asTime(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && value.trim() === String(numeric)) return numeric;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function asCount(value) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.floor(numeric);
}

/**
 * @param {number|string|null|undefined} count
 * @param {Object<string, Array<object>>|null|undefined} newItems
 * @returns {number} PR updates to add for this notification. Non-PR notices add 0.
 */
export function countPingedPullRequests(count, newItems) {
    if (newItems && typeof newItems === 'object') {
        let prs = 0;
        for (const items of Object.values(newItems)) {
            if (!Array.isArray(items)) continue;
            for (const item of items) {
                const type = item?.card?.type || item?.type;
                if (PR_TYPES.has(type)) prs += 1;
            }
        }
        return prs;
    }
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
        return Math.floor(count);
    }
    return 0;
}

/**
 * Decide whether the popup should show the rate prompt.
 * The first failing rule wins. `reason` is the console.debug skip text.
 *
 * @param {object} state
 * @param {number} state.now
 * @param {number|null} state.firstUseTime
 * @param {boolean} [state.isFirstRun]
 * @param {number} state.eventCount
 * @param {boolean} state.signedIn
 * @param {boolean} state.hasError
 * @param {boolean} state.hasRealContent
 * @param {number|null} state.snoozedAt
 * @param {number|null} state.clickedAt
 * @param {number} state.dismissCount
 * @param {number|null} state.lastNotificationClick
 * @param {number|null} state.lastCheckedAt
 * @param {boolean} [state.alreadyShownThisOpen]
 * @returns {{ show: boolean, reason: string, eventCount: number }}
 */
export function evaluateReviewPrompt(state) {
    const eventCount = asCount(state.eventCount);
    const fail = (reason) => ({ show: false, reason, eventCount });

    if (state.alreadyShownThisOpen) return fail('already shown this open');
    if (state.isFirstRun || asTime(state.firstUseTime) === null) return fail('first run');
    if (!state.signedIn) return fail('signed out');
    if (state.hasError) return fail('error');
    if (!state.hasRealContent) return fail('no content');
    if (asTime(state.clickedAt) !== null) return fail('already rated');
    if (asCount(state.dismissCount) >= REVIEW_MAX_DISMISSALS) return fail('dismissed permanently');

    const snoozedAt = asTime(state.snoozedAt);
    if (snoozedAt !== null && state.now - snoozedAt < REVIEW_SNOOZE_MS) return fail('snoozed');

    const firstUseTime = asTime(state.firstUseTime);
    if (state.now - firstUseTime < REVIEW_MIN_USE_MS) return fail('too soon');
    if (eventCount < REVIEW_MIN_EVENTS) return fail('not enough events');

    const lastClick = asTime(state.lastNotificationClick);
    const lastChecked = asTime(state.lastCheckedAt);
    const clickedSinceCheck = lastClick !== null && (lastChecked === null || lastClick > lastChecked);
    if (!clickedSinceCheck) return fail('no notification click since last check');

    return { show: true, reason: '', eventCount };
}

/**
 * @param {string} reason
 */
export function logReviewSkip(reason) {
    console.debug('[GitPing review] ' + reason);
}

/**
 * @param {string} extensionId chrome.runtime.id
 * @returns {string|null}
 */
export function webStoreReviewsUrl(extensionId) {
    if (!extensionId) return null;
    return `https://chromewebstore.google.com/detail/${extensionId}/reviews`;
}

/**
 * @param {number} now
 * @returns {object}
 */
export function reviewRatePatch(now) {
    return { [GP_REVIEW_CLICKED_AT]: now };
}

/**
 * @param {number} dismissCount
 * @param {number} now
 * @returns {object}
 */
export function reviewDismissPatch(dismissCount, now) {
    return {
        [GP_REVIEW_DISMISS_COUNT]: asCount(dismissCount) + 1,
        [GP_REVIEW_SNOOZED_AT]: now,
    };
}

/**
 * @param {'rate'|'not-now'|'report'} kind
 * @param {{ dismissCount?: number }} stored
 * @param {number} now
 * @param {string} [extensionId]
 * @returns {{ patch: object, url: string|null }}
 */
export function performReviewAction(kind, stored, now, extensionId) {
    if (kind === 'rate') {
        return { patch: reviewRatePatch(now), url: webStoreReviewsUrl(extensionId) };
    }
    if (kind === 'not-now') {
        return { patch: reviewDismissPatch(stored?.dismissCount, now), url: null };
    }
    if (kind === 'report') {
        return { patch: reviewDismissPatch(stored?.dismissCount, now), url: REVIEW_PROBLEM_URL };
    }
    throw new Error(`Unknown review action: ${kind}`);
}

function storageGet(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => resolve(result || {}));
    });
}

function storageSet(values) {
    return new Promise((resolve) => {
        chrome.storage.local.set(values, () => resolve());
    });
}

/**
 * @returns {Promise<{firstUseTime: number|null, clickedAt: number|null, dismissCount: number, snoozedAt: number|null, lastNotificationClick: number|null, lastCheckedAt: number|null, eventCount: number}>}
 */
export async function readReviewPromptStorage() {
    const result = await storageGet(REVIEW_STORAGE_KEYS);
    return {
        firstUseTime: asTime(result[GP_FIRST_USE_TIME]),
        clickedAt: asTime(result[GP_REVIEW_CLICKED_AT]),
        dismissCount: asCount(result[GP_REVIEW_DISMISS_COUNT]),
        snoozedAt: asTime(result[GP_REVIEW_SNOOZED_AT]),
        lastNotificationClick: asTime(result[GP_LAST_NOTIFICATION_CLICK]),
        lastCheckedAt: asTime(result[GP_REVIEW_LAST_CHECKED_AT]),
        eventCount: asCount(result[GP_PR_PING_COUNT]),
    };
}

/**
 * Store the first-use time once. Later calls keep the original timestamp.
 * @param {number} [now]
 * @returns {Promise<{ firstUseTime: number, created: boolean }>}
 */
export async function ensureFirstUseTime(now = Date.now()) {
    const existing = asTime((await storageGet([GP_FIRST_USE_TIME]))[GP_FIRST_USE_TIME]);
    if (existing !== null) return { firstUseTime: existing, created: false };
    await storageSet({ [GP_FIRST_USE_TIME]: now });
    return { firstUseTime: now, created: true };
}

/**
 * Remember that this popup open already considered the prompt,
 * so a notification click only counts as a good moment after this check.
 * @param {number} [now]
 */
export async function markReviewChecked(now = Date.now()) {
    await storageSet({ [GP_REVIEW_LAST_CHECKED_AT]: now });
    return now;
}

/**
 * Record that the user opened a GitPing notification.
 * Called from the background notifications.onClicked listener.
 * @param {number} [now]
 */
export async function recordNotificationClick(now = Date.now()) {
    await storageSet({ [GP_LAST_NOTIFICATION_CLICK]: now });
    return now;
}

/**
 * Add PR updates from a notification to the running total.
 * @param {number|string|null|undefined} count
 * @param {Object<string, Array<object>>|null|undefined} newItems
 * @returns {Promise<number>} the new total, or the unchanged total when nothing is added
 */
export async function recordPingedPullRequests(count, newItems) {
    const delta = countPingedPullRequests(count, newItems);
    if (delta <= 0) return asCount((await storageGet([GP_PR_PING_COUNT]))[GP_PR_PING_COUNT]);
    const next = asCount((await storageGet([GP_PR_PING_COUNT]))[GP_PR_PING_COUNT]) + delta;
    await storageSet({ [GP_PR_PING_COUNT]: next });
    return next;
}

/**
 * Write an action patch (rate or dismiss) to chrome.storage.local.
 * @param {object} patch
 */
export async function applyReviewPatch(patch) {
    await storageSet(patch);
    return patch;
}

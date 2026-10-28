/**
 * Pure helpers for de-duplicating pull requests / issues by id.
 * No chrome.* or network access, so they are unit-testable with node --test.
 */

/**
 * Keep one entry per item id. Items without an id are always kept.
 * When `pick` is provided and two entries share an id, `pick(existing, candidate)`
 * returns the one to keep; otherwise the first entry wins. Order of first appearance is preserved.
 * @param {Array<object>} items
 * @param {(existing: object, candidate: object) => object} [pick]
 * @returns {Array<object>}
 */
export function dedupeById(items, pick = null) {
    const byId = new Map();
    const out = [];
    for (const item of items || []) {
        const id = item && item.id;
        if (id === undefined || id === null) {
            out.push(item);
            continue;
        }
        if (!byId.has(id)) {
            byId.set(id, out.length);
            out.push(item);
        } else if (pick) {
            const idx = byId.get(id);
            out[idx] = pick(out[idx], item);
        }
    }
    return out;
}

/**
 * Remove items from later buckets when the same id already appears in an earlier bucket
 * (bucket order = the order of `priority`, then any remaining keys). Buckets are not mutated.
 * Used for the badge count and notifications so one PR is counted once across tabs.
 * @param {Object<string, Array<object>>} buckets
 * @param {string[]} [priority]
 * @returns {Object<string, Array<object>>}
 */
export function dedupeAcrossBuckets(buckets, priority = []) {
    const keys = [...priority.filter(k => k in buckets), ...Object.keys(buckets).filter(k => !priority.includes(k))];
    const seen = new Set();
    const result = {};
    for (const key of keys) {
        result[key] = (buckets[key] || []).filter((item) => {
            const id = item && item.id;
            if (id === undefined || id === null) return true;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }
    return result;
}

/**
 * Dedupe buckets across each other (see dedupeAcrossBuckets) and count what is left.
 * Used for the extension badge and notifications, so one PR is counted once.
 * @param {Object<string, Array<object>>} diffs
 * @param {string[]} [priority]
 * @returns {{uniqueDiffs: Object<string, Array<object>>, total: number}}
 */
export function countUniqueAcrossBuckets(diffs, priority = []) {
    const uniqueDiffs = dedupeAcrossBuckets(diffs || {}, priority);
    const total = Object.values(uniqueDiffs).reduce((acc, arr) => acc + arr.length, 0);
    return { uniqueDiffs, total };
}

/**
 * Bucket order used for the badge and notifications. 'copilot' is last because it is derived
 * from the other buckets, so a PR in any other bucket is counted there instead.
 */
export const BADGE_BUCKET_PRIORITY = ['personal', 'team', 'mine', 'mentions', 'issues', 'watched', 'copilot'];

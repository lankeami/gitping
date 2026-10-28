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

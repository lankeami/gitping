/**
 * Tests for the pure de-duplication helpers.
 * Run with: node --test tests/dedupe.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeById, dedupeAcrossBuckets, countUniqueAcrossBuckets, BADGE_BUCKET_PRIORITY } from '../src/shared/dedupe.js';

describe('dedupeById', () => {
    test('keeps the first entry per id and preserves order', () => {
        const out = dedupeById([{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'a', n: 3 }]);
        assert.deepEqual(out.map(x => x.n), [1, 2]);
    });

    test('uses pick to choose between duplicates, in the first occurrence position', () => {
        const out = dedupeById(
            [{ id: 'a', t: 1 }, { id: 'b', t: 5 }, { id: 'a', t: 9 }],
            (x, y) => (y.t > x.t ? y : x));
        assert.deepEqual(out, [{ id: 'a', t: 9 }, { id: 'b', t: 5 }]);
    });

    test('keeps items that have no id and tolerates empty input', () => {
        assert.equal(dedupeById([{ x: 1 }, { x: 2 }, { id: null }]).length, 3);
        assert.deepEqual(dedupeById(undefined), []);
        assert.deepEqual(dedupeById([]), []);
    });
});

describe('dedupeAcrossBuckets', () => {
    const buckets = () => ({
        copilot: [{ id: 'PR_1' }, { id: 'PR_2' }],
        mine: [{ id: 'PR_1' }, { id: 'PR_3' }],
        mentions: [{ id: 'PR_3' }, { id: 'PR_4' }],
    });

    test('counts each id once, in priority order', () => {
        const out = dedupeAcrossBuckets(buckets(), ['mine', 'mentions', 'copilot']);
        assert.deepEqual(out.mine.map(x => x.id), ['PR_1', 'PR_3']);
        assert.deepEqual(out.mentions.map(x => x.id), ['PR_4']);
        assert.deepEqual(out.copilot.map(x => x.id), ['PR_2']);
        const total = Object.values(out).reduce((n, a) => n + a.length, 0);
        assert.equal(total, 4);
    });

    test('does not mutate its input and keeps unlisted buckets', () => {
        const b = buckets();
        const out = dedupeAcrossBuckets(b, ['mine']);
        assert.equal(b.copilot.length, 2);
        assert.deepEqual(Object.keys(out).sort(), ['copilot', 'mentions', 'mine']);
    });

    test('keeps id-less items and handles empty/missing buckets', () => {
        const out = dedupeAcrossBuckets({ a: [{ x: 1 }], b: [{ x: 2 }], c: undefined });
        assert.equal(out.a.length + out.b.length, 2);
        assert.deepEqual(out.c, []);
    });
});

describe('countUniqueAcrossBuckets', () => {
    const pr = (id) => ({ id });

    test('BADGE_BUCKET_PRIORITY ends with copilot and has no repeats', () => {
        assert.equal(BADGE_BUCKET_PRIORITY[BADGE_BUCKET_PRIORITY.length - 1], 'copilot');
        assert.equal(new Set(BADGE_BUCKET_PRIORITY).size, BADGE_BUCKET_PRIORITY.length);
    });

    test('a PR in mine + mentions + copilot is counted once and kept in the highest-priority bucket', () => {
        const { uniqueDiffs, total } = countUniqueAcrossBuckets(
            { mine: [pr(1)], mentions: [pr(1)], copilot: [pr(1)] }, BADGE_BUCKET_PRIORITY);
        assert.equal(total, 1);
        assert.deepEqual(uniqueDiffs.mine, [pr(1)]);
        assert.deepEqual(uniqueDiffs.mentions, []);
        assert.deepEqual(uniqueDiffs.copilot, []);
    });

    test('copilot gives way to every other bucket, even when it is listed first', () => {
        const { uniqueDiffs, total } = countUniqueAcrossBuckets(
            { copilot: [pr(1), pr(2), pr(3)], watched: [pr(1)], personal: [pr(2)], issues: [pr(3)] }, BADGE_BUCKET_PRIORITY);
        assert.equal(total, 3);
        assert.deepEqual(uniqueDiffs.copilot, []);
        assert.deepEqual(uniqueDiffs.personal, [pr(2)]);
        assert.deepEqual(uniqueDiffs.issues, [pr(3)]);
        assert.deepEqual(uniqueDiffs.watched, [pr(1)]);
    });

    test('copilot-only PRs still count', () => {
        const { uniqueDiffs, total } = countUniqueAcrossBuckets(
            { mine: [pr(1)], copilot: [pr(1), pr(9)] }, BADGE_BUCKET_PRIORITY);
        assert.equal(total, 2);
        assert.deepEqual(uniqueDiffs.copilot, [pr(9)]);
    });

    test('empty, undefined and missing buckets are fine', () => {
        assert.deepEqual(countUniqueAcrossBuckets({}, BADGE_BUCKET_PRIORITY), { uniqueDiffs: {}, total: 0 });
        assert.deepEqual(countUniqueAcrossBuckets(undefined, BADGE_BUCKET_PRIORITY), { uniqueDiffs: {}, total: 0 });
        const { total } = countUniqueAcrossBuckets({ mine: [], team: undefined, copilot: [pr(5)] }, BADGE_BUCKET_PRIORITY);
        assert.equal(total, 1);
    });

    test('total equals the sum of the unique bucket lengths, and the input is not mutated', () => {
        const diffs = { personal: [pr(1), pr(2)], team: [pr(2), pr(3)], mine: [pr(3), pr(4)], copilot: [pr(4), pr(5)] };
        const before = JSON.stringify(diffs);
        const { uniqueDiffs, total } = countUniqueAcrossBuckets(diffs, BADGE_BUCKET_PRIORITY);
        assert.equal(total, Object.values(uniqueDiffs).reduce((a, b) => a + b.length, 0));
        assert.equal(total, 5);
        assert.equal(JSON.stringify(diffs), before);
    });

    test('items without an id are never collapsed', () => {
        const { total } = countUniqueAcrossBuckets({ mine: [{}, {}], copilot: [{}] }, BADGE_BUCKET_PRIORITY);
        assert.equal(total, 3);
    });
});

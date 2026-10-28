/**
 * Tests for the pure de-duplication helpers.
 * Run with: node --test tests/dedupe.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeById, dedupeAcrossBuckets } from '../src/shared/dedupe.js';

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

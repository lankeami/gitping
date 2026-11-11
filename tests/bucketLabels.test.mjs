/**
 * Tests for the friendly bucket labels used by badge/notification text.
 * Run with: node --test tests/bucketLabels.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BUCKET_LABELS, getBucketLabel } from '../src/shared/bucketLabels.js';
import { BADGE_BUCKET_PRIORITY } from '../src/shared/dedupe.js';

describe('bucket labels', () => {
    test('copilot has a friendly label, not the raw key', () => {
        assert.equal(getBucketLabel('copilot'), 'Copilot reviews');
    });

    test('existing labels are unchanged', () => {
        assert.deepEqual(
            ['personal', 'team', 'mentions', 'mine', 'issues', 'watched'].map(getBucketLabel),
            ['Review Requested', 'Team', 'Mentions', 'Your PRs', 'Issues', 'Watched']);
    });

    test('every bucket used for the badge has its own label (none falls back to the raw key)', () => {
        for (const key of BADGE_BUCKET_PRIORITY) {
            assert.ok(key in BUCKET_LABELS, `missing label for ${key}`);
            assert.notEqual(getBucketLabel(key), key, `${key} would show as a raw key`);
        }
    });

    test('unknown keys fall back to the key itself, and inherited object keys are not treated as labels', () => {
        assert.equal(getBucketLabel('something-new'), 'something-new');
        assert.equal(getBucketLabel('toString'), 'toString');
        assert.equal(getBucketLabel(undefined), undefined);
    });
});

describe('triggerPushNotification with a copilot bucket', () => {
    test('builds a notification for copilot items without throwing', async () => {
        const store = {};
        let created;
        globalThis.chrome = {
            notifications: { create(id, opts, cb) { created = { id, opts }; cb && cb(id); } },
            runtime: { lastError: null },
            storage: {
                local: {
                    get(keys, cb) {
                        const result = {};
                        for (const key of keys) if (key in store) result[key] = store[key];
                        cb(result);
                    },
                    set(values, cb) {
                        Object.assign(store, values);
                        if (cb) cb();
                    },
                },
            },
        };
        const { triggerPushNotification } = await import('../src/shared/storageUtils.js');
        triggerPushNotification(1, { copilot: [{ card: { title: 'Fix it', repo_name: 'acme/widgets', type: 'pulls' } }] });
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(created.id, 'newPullRequests');
        assert.match(created.opts.message, /PR • acme\/widgets: Fix it/);
        assert.equal(store.gp_pr_ping_count, 1);
        delete globalThis.chrome;
    });
});

/**
 * Tests for the storage plumbing used by the Copilot tab.
 * chrome.storage.local.get is stubbed per test and removed afterwards so it does not leak.
 * Run with: node --test tests/storageUtils.test.mjs
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getCopilotReviewRequests, getStoredPullRequests } from '../src/shared/storageUtils.js';

describe('storageUtils copilot plumbing', () => {
    let hadChrome;
    let originalChrome;
    let requestedKeys;
    let store;

    beforeEach(() => {
        hadChrome = Object.prototype.hasOwnProperty.call(globalThis, 'chrome');
        originalChrome = globalThis.chrome;
        requestedKeys = [];
        store = {};
        globalThis.chrome = {
            storage: {
                local: {
                    get(keys, cb) {
                        requestedKeys.push(keys);
                        const result = {};
                        for (const k of keys) if (k in store) result[k] = store[k];
                        cb(result);
                    }
                }
            }
        };
    });

    afterEach(() => {
        if (hadChrome) globalThis.chrome = originalChrome;
        else delete globalThis.chrome;
    });

    test('getCopilotReviewRequests requests exactly copilotPullRequests and returns its value', async () => {
        store.copilotPullRequests = [{ id: 7 }];
        const result = await getCopilotReviewRequests();
        assert.deepEqual(requestedKeys, [['copilotPullRequests']]);
        assert.deepEqual(result, [{ id: 7 }]);
    });

    test('getCopilotReviewRequests resolves undefined when nothing is stored', async () => {
        assert.equal(await getCopilotReviewRequests(), undefined);
    });

    test('getStoredPullRequests requests every bucket key, including copilotPullRequests', async () => {
        await getStoredPullRequests();
        assert.equal(requestedKeys.length, 1);
        assert.deepEqual([...requestedKeys[0]].sort(), [
            'copilotPullRequests', 'issuesPullRequests', 'mentionsPullRequests', 'minePullRequests',
            'personalPullRequests', 'teamPullRequests', 'watchedPullRequests'
        ]);
    });

    test('getStoredPullRequests maps each stored key to its bucket, with copilot returned', async () => {
        store = {
            personalPullRequests: [{ id: 1 }], teamPullRequests: [{ id: 2 }], mentionsPullRequests: [{ id: 3 }],
            minePullRequests: [{ id: 4 }], issuesPullRequests: [{ id: 5 }], watchedPullRequests: [{ id: 6 }],
            copilotPullRequests: [{ id: 7 }]
        };
        const result = await getStoredPullRequests();
        assert.deepEqual(result, {
            personal: [{ id: 1 }], team: [{ id: 2 }], mentions: [{ id: 3 }], mine: [{ id: 4 }],
            issues: [{ id: 5 }], watched: [{ id: 6 }], copilot: [{ id: 7 }]
        });
    });
});

test('chrome stub is removed after the suite (no leak)', () => {
    assert.equal(typeof globalThis.chrome, 'undefined');
});

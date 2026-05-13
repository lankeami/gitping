/**
 * Tests for githubApi.js data-gathering logic.
 *
 * Run with:
 *   node --test tests/githubApi.test.mjs
 *
 * No npm dependencies — uses Node.js built-in test runner.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Bootstrap a minimal chrome stub BEFORE importing the module under test.
// githubApi.js imports storageUtils.js which references chrome.storage at
// module evaluation time, so the stub must exist first.
// ---------------------------------------------------------------------------
globalThis.chrome = {
    storage: {
        local: {
            get: (keys, cb) => cb({}),
            set: (_obj, cb) => cb && cb(),
        },
    },
    runtime: { lastError: null },
};

// The module imports `fetch` from the global scope; stub it so imports
// don't fail when there's no network.
globalThis.fetch = async () => {
    throw new Error('fetch is not stubbed for this test');
};

const { aggregateCiStatus } = await import('../src/shared/githubApi.js');

// ---------------------------------------------------------------------------
// aggregateCiStatus — pure logic, no mocking needed
// ---------------------------------------------------------------------------

describe('aggregateCiStatus', () => {

    // --- null cases ---

    test('returns null for empty array', () => {
        assert.equal(aggregateCiStatus([]), null);
    });

    test('returns null for non-array input (null)', () => {
        assert.equal(aggregateCiStatus(null), null);
    });

    test('returns null for non-array input (undefined)', () => {
        assert.equal(aggregateCiStatus(undefined), null);
    });

    test('returns null when no runs match any known status', () => {
        // e.g. conclusion === 'skipped' and status === 'completed'
        const runs = [
            { status: 'completed', conclusion: 'skipped' },
            { status: 'completed', conclusion: 'neutral' },
        ];
        assert.equal(aggregateCiStatus(runs), null);
    });

    // --- success ---

    test('returns success when all runs have conclusion success', () => {
        const runs = [
            { status: 'completed', conclusion: 'success' },
            { status: 'completed', conclusion: 'success' },
        ];
        assert.equal(aggregateCiStatus(runs), 'success');
    });

    test('returns success for a single successful run', () => {
        assert.equal(
            aggregateCiStatus([{ status: 'completed', conclusion: 'success' }]),
            'success'
        );
    });

    // --- failure ---

    test('returns failure when any run has conclusion failure', () => {
        const runs = [
            { status: 'completed', conclusion: 'success' },
            { status: 'completed', conclusion: 'failure' },
        ];
        assert.equal(aggregateCiStatus(runs), 'failure');
    });

    test('returns failure when any run has conclusion timed_out', () => {
        const runs = [
            { status: 'completed', conclusion: 'success' },
            { status: 'completed', conclusion: 'timed_out' },
        ];
        assert.equal(aggregateCiStatus(runs), 'failure');
    });

    test('returns failure for a single timed_out run', () => {
        assert.equal(
            aggregateCiStatus([{ status: 'completed', conclusion: 'timed_out' }]),
            'failure'
        );
    });

    // --- running ---

    test('returns running when any run has status in_progress', () => {
        const runs = [
            { status: 'completed', conclusion: 'success' },
            { status: 'in_progress', conclusion: null },
        ];
        assert.equal(aggregateCiStatus(runs), 'running');
    });

    test('returns running when any run has status queued', () => {
        const runs = [
            { status: 'completed', conclusion: 'success' },
            { status: 'queued', conclusion: null },
        ];
        assert.equal(aggregateCiStatus(runs), 'running');
    });

    // --- priority: failure beats running ---

    test('failure takes priority over running (failure check comes first)', () => {
        const runs = [
            { status: 'in_progress', conclusion: null },
            { status: 'completed', conclusion: 'failure' },
        ];
        assert.equal(aggregateCiStatus(runs), 'failure');
    });

    test('failure takes priority over running (timed_out + in_progress)', () => {
        const runs = [
            { status: 'in_progress', conclusion: null },
            { status: 'completed', conclusion: 'timed_out' },
        ];
        assert.equal(aggregateCiStatus(runs), 'failure');
    });

    // --- mixed success + non-success does not return success ---

    test('does not return success when some runs are skipped/neutral', () => {
        const runs = [
            { status: 'completed', conclusion: 'success' },
            { status: 'completed', conclusion: 'skipped' },
        ];
        // 'skipped' is not 'success', so every() is false — should return null
        assert.equal(aggregateCiStatus(runs), null);
    });

    // --- realistic GitHub check-run payloads ---

    test('real-world: all checks pass', () => {
        const runs = [
            { name: 'lint', status: 'completed', conclusion: 'success' },
            { name: 'test', status: 'completed', conclusion: 'success' },
            { name: 'build', status: 'completed', conclusion: 'success' },
        ];
        assert.equal(aggregateCiStatus(runs), 'success');
    });

    test('real-world: one check fails, rest pass', () => {
        const runs = [
            { name: 'lint', status: 'completed', conclusion: 'success' },
            { name: 'test', status: 'completed', conclusion: 'failure' },
            { name: 'build', status: 'completed', conclusion: 'success' },
        ];
        assert.equal(aggregateCiStatus(runs), 'failure');
    });

    test('real-world: checks still running', () => {
        const runs = [
            { name: 'lint', status: 'completed', conclusion: 'success' },
            { name: 'test', status: 'in_progress', conclusion: null },
            { name: 'build', status: 'queued', conclusion: null },
        ];
        assert.equal(aggregateCiStatus(runs), 'running');
    });

    test('real-world: failure + still running = failure wins', () => {
        const runs = [
            { name: 'lint', status: 'completed', conclusion: 'failure' },
            { name: 'test', status: 'in_progress', conclusion: null },
        ];
        assert.equal(aggregateCiStatus(runs), 'failure');
    });
});

describe('aggregateCiStatus with GraphQL checkSuites nodes (normalised)', () => {

    test('handles uppercase COMPLETED/SUCCESS from GraphQL', () => {
        const suites = [
            { status: 'COMPLETED', conclusion: 'SUCCESS' },
            { status: 'COMPLETED', conclusion: 'SUCCESS' },
        ];
        const runs = suites.map(s => ({
            status: s.status.toLowerCase(),
            conclusion: s.conclusion?.toLowerCase() ?? null,
        }));
        assert.equal(aggregateCiStatus(runs), 'success');
    });

    test('handles IN_PROGRESS suite from GraphQL', () => {
        const suites = [{ status: 'IN_PROGRESS', conclusion: null }];
        const runs = suites.map(s => ({
            status: s.status.toLowerCase(),
            conclusion: s.conclusion?.toLowerCase() ?? null,
        }));
        assert.equal(aggregateCiStatus(runs), 'running');
    });

    test('handles QUEUED suite from GraphQL', () => {
        const suites = [{ status: 'QUEUED', conclusion: null }];
        const runs = suites.map(s => ({
            status: s.status.toLowerCase(),
            conclusion: s.conclusion?.toLowerCase() ?? null,
        }));
        assert.equal(aggregateCiStatus(runs), 'running');
    });

    test('handles FAILURE conclusion from GraphQL', () => {
        const suites = [
            { status: 'COMPLETED', conclusion: 'SUCCESS' },
            { status: 'COMPLETED', conclusion: 'FAILURE' },
        ];
        const runs = suites.map(s => ({
            status: s.status.toLowerCase(),
            conclusion: s.conclusion?.toLowerCase() ?? null,
        }));
        assert.equal(aggregateCiStatus(runs), 'failure');
    });

    test('handles TIMED_OUT conclusion from GraphQL', () => {
        const suites = [{ status: 'COMPLETED', conclusion: 'TIMED_OUT' }];
        const runs = suites.map(s => ({
            status: s.status.toLowerCase(),
            conclusion: s.conclusion?.toLowerCase() ?? null,
        }));
        assert.equal(aggregateCiStatus(runs), 'failure');
    });

    test('handles empty checkSuites array', () => {
        assert.equal(aggregateCiStatus([]), null);
    });
});

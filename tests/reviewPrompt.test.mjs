/**
 * Eligibility and actions for the popup "Rate it" prompt.
 * Run with: node --test tests/reviewPrompt.test.mjs
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    REVIEW_MIN_EVENTS,
    REVIEW_MIN_USE_MS,
    REVIEW_SNOOZE_MS,
    REVIEW_PROBLEM_URL,
    GP_FIRST_USE_TIME,
    GP_REVIEW_CLICKED_AT,
    GP_REVIEW_DISMISS_COUNT,
    GP_REVIEW_SNOOZED_AT,
    GP_LAST_NOTIFICATION_CLICK,
    GP_REVIEW_LAST_CHECKED_AT,
    GP_PR_PING_COUNT,
    evaluateReviewPrompt,
    logReviewSkip,
    webStoreReviewsUrl,
    performReviewAction,
    countPingedPullRequests,
    readReviewPromptStorage,
    ensureFirstUseTime,
    markReviewChecked,
    recordNotificationClick,
    recordPingedPullRequests,
    applyReviewPatch,
} from '../src/shared/reviewPrompt.js';
import { triggerPushNotification } from '../src/shared/storageUtils.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-11T12:00:00Z');

function eligible(overrides = {}) {
    return {
        now: NOW,
        firstUseTime: NOW - (8 * DAY),
        isFirstRun: false,
        eventCount: REVIEW_MIN_EVENTS,
        signedIn: true,
        hasError: false,
        hasRealContent: true,
        snoozedAt: null,
        clickedAt: null,
        dismissCount: 0,
        lastNotificationClick: NOW - 1000,
        lastCheckedAt: NOW - 60_000,
        alreadyShownThisOpen: false,
        ...overrides,
    };
}

describe('evaluateReviewPrompt', () => {
    test('shows when every rule passes', () => {
        const decision = evaluateReviewPrompt(eligible());
        assert.equal(decision.show, true);
        assert.equal(decision.reason, '');
        assert.equal(decision.eventCount, REVIEW_MIN_EVENTS);
    });

    test('never shows on first run when the first-use time was just created', () => {
        const decision = evaluateReviewPrompt(eligible({ isFirstRun: true }));
        assert.equal(decision.show, false);
        assert.equal(decision.reason, 'first run');
    });

    test('never shows on first run when no first-use time is stored', () => {
        const decision = evaluateReviewPrompt(eligible({ firstUseTime: null }));
        assert.equal(decision.show, false);
        assert.equal(decision.reason, 'first run');
    });

    test('requires 7 days since first use', () => {
        const tooSoon = evaluateReviewPrompt(eligible({ firstUseTime: NOW - REVIEW_MIN_USE_MS + 1 }));
        assert.equal(tooSoon.show, false);
        assert.equal(tooSoon.reason, 'too soon');

        const exactly = evaluateReviewPrompt(eligible({ firstUseTime: NOW - REVIEW_MIN_USE_MS }));
        assert.equal(exactly.show, true);
    });

    test('requires at least 20 counted PR pings', () => {
        const short = evaluateReviewPrompt(eligible({ eventCount: REVIEW_MIN_EVENTS - 1 }));
        assert.equal(short.show, false);
        assert.equal(short.reason, 'not enough events');

        const enough = evaluateReviewPrompt(eligible({ eventCount: REVIEW_MIN_EVENTS }));
        assert.equal(enough.show, true);
    });

    test('requires a notification click since the last check', () => {
        const missing = evaluateReviewPrompt(eligible({ lastNotificationClick: null }));
        assert.equal(missing.show, false);
        assert.equal(missing.reason, 'no notification click since last check');

        const stale = evaluateReviewPrompt(eligible({
            lastNotificationClick: NOW - 120_000,
            lastCheckedAt: NOW - 60_000,
        }));
        assert.equal(stale.show, false);
        assert.equal(stale.reason, 'no notification click since last check');

        const sameInstant = evaluateReviewPrompt(eligible({
            lastNotificationClick: NOW - 60_000,
            lastCheckedAt: NOW - 60_000,
        }));
        assert.equal(sameInstant.show, false);
        assert.equal(sameInstant.reason, 'no notification click since last check');

        const fresh = evaluateReviewPrompt(eligible({
            lastNotificationClick: NOW - 1000,
            lastCheckedAt: NOW - 60_000,
        }));
        assert.equal(fresh.show, true);

        const firstCheckAfterClick = evaluateReviewPrompt(eligible({
            lastNotificationClick: NOW - 1000,
            lastCheckedAt: null,
        }));
        assert.equal(firstCheckAfterClick.show, true);
    });

    test('never shows while signed out', () => {
        const decision = evaluateReviewPrompt(eligible({ signedIn: false }));
        assert.equal(decision.show, false);
        assert.equal(decision.reason, 'signed out');
    });

    test('never shows during an error', () => {
        const decision = evaluateReviewPrompt(eligible({ hasError: true, hasRealContent: true }));
        assert.equal(decision.show, false);
        assert.equal(decision.reason, 'error');
    });

    test('never shows without real popup content', () => {
        const decision = evaluateReviewPrompt(eligible({ hasRealContent: false }));
        assert.equal(decision.show, false);
        assert.equal(decision.reason, 'no content');
    });

    test('never shows after the user has rated', () => {
        const decision = evaluateReviewPrompt(eligible({ clickedAt: NOW - DAY }));
        assert.equal(decision.show, false);
        assert.equal(decision.reason, 'already rated');
    });

    test('snoozes for 30 days and returns after the snooze when one dismissal remains', () => {
        const snoozed = evaluateReviewPrompt(eligible({
            dismissCount: 1,
            snoozedAt: NOW - REVIEW_SNOOZE_MS + 1,
        }));
        assert.equal(snoozed.show, false);
        assert.equal(snoozed.reason, 'snoozed');

        const expired = evaluateReviewPrompt(eligible({
            dismissCount: 1,
            snoozedAt: NOW - REVIEW_SNOOZE_MS,
        }));
        assert.equal(expired.show, true);
    });

    test('the second dismissal is permanent', () => {
        const decision = evaluateReviewPrompt(eligible({
            dismissCount: 2,
            snoozedAt: NOW - (60 * DAY),
        }));
        assert.equal(decision.show, false);
        assert.equal(decision.reason, 'dismissed permanently');
    });

    test('shows at most once per popup open', () => {
        const decision = evaluateReviewPrompt(eligible({ alreadyShownThisOpen: true }));
        assert.equal(decision.show, false);
        assert.equal(decision.reason, 'already shown this open');
    });
});

describe('review prompt actions', () => {
    test('Rate it records the click and builds the Web Store reviews URL from the extension id', () => {
        const now = NOW;
        const action = performReviewAction('rate', { dismissCount: 0 }, now, 'abc123');
        assert.deepEqual(action.patch, { [GP_REVIEW_CLICKED_AT]: now });
        assert.equal(action.url, 'https://chromewebstore.google.com/detail/abc123/reviews');
        assert.equal(webStoreReviewsUrl(''), null);

        const after = evaluateReviewPrompt(eligible({ clickedAt: action.patch[GP_REVIEW_CLICKED_AT] }));
        assert.equal(after.show, false);
        assert.equal(after.reason, 'already rated');
    });

    test('Not now increments the dismiss count and snoozes for 30 days', () => {
        const action = performReviewAction('not-now', { dismissCount: 0 }, NOW, 'abc123');
        assert.deepEqual(action.patch, {
            [GP_REVIEW_DISMISS_COUNT]: 1,
            [GP_REVIEW_SNOOZED_AT]: NOW,
        });
        assert.equal(action.url, null);

        const during = evaluateReviewPrompt(eligible({
            dismissCount: action.patch[GP_REVIEW_DISMISS_COUNT],
            snoozedAt: action.patch[GP_REVIEW_SNOOZED_AT],
        }));
        assert.equal(during.reason, 'snoozed');
    });

    test('Report a problem dismisses the same way and opens the GitHub issues page', () => {
        const action = performReviewAction('report', { dismissCount: 1 }, NOW, 'abc123');
        assert.deepEqual(action.patch, {
            [GP_REVIEW_DISMISS_COUNT]: 2,
            [GP_REVIEW_SNOOZED_AT]: NOW,
        });
        assert.equal(action.url, REVIEW_PROBLEM_URL);
        assert.equal(REVIEW_PROBLEM_URL, 'https://github.com/lankeami/gitping/issues');

        const after = evaluateReviewPrompt(eligible({
            dismissCount: action.patch[GP_REVIEW_DISMISS_COUNT],
            snoozedAt: NOW - (60 * DAY),
        }));
        assert.equal(after.show, false);
        assert.equal(after.reason, 'dismissed permanently');
    });

    test('skip reasons are logged with the GitPing review prefix', () => {
        const calls = [];
        const original = console.debug;
        console.debug = (message) => calls.push(message);
        try {
            logReviewSkip('signed out');
        } finally {
            console.debug = original;
        }
        assert.deepEqual(calls, ['[GitPing review] signed out']);
    });
});

describe('PR ping count', () => {
    test('counts pull-request updates and ignores issues and non-numeric notices', () => {
        const items = {
            personal: [{ card: { type: 'pulls' } }, { card: { type: 'pulls' } }],
            issues: [{ card: { type: 'issues' } }],
            mentions: [{ type: 'pulls' }, { type: 'issues' }],
        };
        assert.equal(countPingedPullRequests(9, items), 3);
        assert.equal(countPingedPullRequests(4, null), 4);
        assert.equal(countPingedPullRequests('Log in to GitPing', null), 0);
        assert.equal(countPingedPullRequests(0, null), 0);
    });
});

describe('review prompt storage', () => {
    let hadChrome;
    let originalChrome;
    let store;

    beforeEach(() => {
        hadChrome = Object.prototype.hasOwnProperty.call(globalThis, 'chrome');
        originalChrome = globalThis.chrome;
        store = {};
        globalThis.chrome = {
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
                        cb();
                    },
                },
            },
            notifications: {
                create(_id, _options, cb) {
                    cb('newPullRequests');
                },
            },
        };
    });

    afterEach(() => {
        if (hadChrome) globalThis.chrome = originalChrome;
        else delete globalThis.chrome;
    });

    test('ensureFirstUseTime stores gp_first_use_time once', async () => {
        const created = await ensureFirstUseTime(NOW - (10 * DAY));
        assert.equal(created.created, true);
        assert.equal(store[GP_FIRST_USE_TIME], NOW - (10 * DAY));

        const again = await ensureFirstUseTime(NOW);
        assert.equal(again.created, false);
        assert.equal(again.firstUseTime, NOW - (10 * DAY));
        assert.equal(store[GP_FIRST_USE_TIME], NOW - (10 * DAY));
    });

    test('a notification click is stored for the good-moment check', async () => {
        await recordNotificationClick(NOW - 5000);
        await markReviewChecked(NOW - 60_000);
        const stored = await readReviewPromptStorage();
        assert.equal(stored.lastNotificationClick, NOW - 5000);
        assert.equal(stored.lastCheckedAt, NOW - 60_000);
        assert.equal(store[GP_LAST_NOTIFICATION_CLICK], NOW - 5000);
        assert.equal(store[GP_REVIEW_LAST_CHECKED_AT], NOW - 60_000);
    });

    test('Rate it, Not now, and Report a problem persist the action patches', async () => {
        await applyReviewPatch(performReviewAction('not-now', { dismissCount: 0 }, NOW).patch);
        let stored = await readReviewPromptStorage();
        assert.equal(stored.dismissCount, 1);
        assert.equal(stored.snoozedAt, NOW);

        await applyReviewPatch(performReviewAction('report', stored, NOW + 10).patch);
        stored = await readReviewPromptStorage();
        assert.equal(stored.dismissCount, 2);
        assert.equal(stored.snoozedAt, NOW + 10);

        await applyReviewPatch(performReviewAction('rate', stored, NOW + 20, 'extid').patch);
        stored = await readReviewPromptStorage();
        assert.equal(stored.clickedAt, NOW + 20);
        assert.equal(store[GP_REVIEW_CLICKED_AT], NOW + 20);
        assert.equal(store[GP_REVIEW_DISMISS_COUNT], 2);
    });

    test('notifications add only PR updates to gp_pr_ping_count', async () => {
        const first = await recordPingedPullRequests(3, {
            personal: [{ card: { type: 'pulls' } }, { card: { type: 'pulls' } }],
            issues: [{ card: { type: 'issues' } }],
        });
        assert.equal(first, 2);

        triggerPushNotification(5, {
            mine: [{ card: { type: 'pulls' } }],
            issues: [{ card: { type: 'issues' } }, { card: { type: 'issues' } }],
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        const stored = await readReviewPromptStorage();
        assert.equal(stored.eventCount, 3);
        assert.equal(store[GP_PR_PING_COUNT], 3);

        triggerPushNotification('Log in to GitPing to become a more efficient developer.');
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal((await readReviewPromptStorage()).eventCount, 3);
    });
});

/**
 * Polling interval: base-10 minutes, default, clamp, and checkForUpdates alarm recreation.
 * Run with: node --test tests/pollingInterval.test.mjs
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePollingInterval, getPollingInterval } from '../src/shared/storageUtils.js';

describe('normalizePollingInterval', () => {
    test('parses decimal strings and numbers as whole minutes', () => {
        assert.equal(normalizePollingInterval('10'), 10);
        assert.equal(normalizePollingInterval('101'), 101);
        assert.equal(normalizePollingInterval(10), 10);
        assert.equal(normalizePollingInterval(101), 101);
        assert.equal(normalizePollingInterval('10.9'), 10);
        assert.equal(normalizePollingInterval(10.9), 10);
        assert.equal(normalizePollingInterval('  7 '), 7);
    });

    test('defaults to 5 when the value is missing or invalid', () => {
        for (const value of [undefined, null, '', '   ', 'nope', NaN, Infinity, true, false, {}]) {
            assert.equal(normalizePollingInterval(value), 5, `value ${String(value)}`);
        }
    });

    test('clamps values below 1 minute up to 1', () => {
        for (const value of [0, '0', -4, '-4', 0.2, '0.2', -0.5]) {
            assert.equal(normalizePollingInterval(value), 1, `value ${String(value)}`);
        }
        assert.equal(normalizePollingInterval(1), 1);
        assert.equal(normalizePollingInterval('1'), 1);
    });
});

describe('getPollingInterval', () => {
    let hadChrome;
    let originalChrome;
    let store;

    test('reads pollingInterval from local storage and normalizes it', async () => {
        hadChrome = Object.prototype.hasOwnProperty.call(globalThis, 'chrome');
        originalChrome = globalThis.chrome;
        store = {};
        globalThis.chrome = {
            storage: {
                local: {
                    get(keys, cb) {
                        const result = {};
                        for (const key of keys) {
                            if (Object.prototype.hasOwnProperty.call(store, key)) {
                                result[key] = store[key];
                            }
                        }
                        cb(result);
                    }
                }
            }
        };

        assert.equal(await getPollingInterval(), 5);

        store.pollingInterval = '10';
        assert.equal(await getPollingInterval(), 10);

        store.pollingInterval = '101';
        assert.equal(await getPollingInterval(), 101);

        store.pollingInterval = 0;
        assert.equal(await getPollingInterval(), 1);

        store.pollingInterval = 'nope';
        assert.equal(await getPollingInterval(), 5);

        if (hadChrome) globalThis.chrome = originalChrome;
        else delete globalThis.chrome;
    });
});

describe('options page polling interval', () => {
    test('shows 5 when nothing is stored and saves a normalized number', async () => {
        const store = {};
        const sets = [];
        const domReady = [];
        let submitHandler;

        function field(initial = '') {
            let value = initial;
            return {
                get value() { return value; },
                set value(next) { value = next == null ? '' : String(next); }
            };
        }

        const elements = {
            username: field(),
            token: field(),
            'api-base-url': field(),
            'polling-interval': field(''),
            'staleness-threshold': field('3'),
            'critical-threshold': field('6'),
            'options-form': {
                addEventListener(type, cb) {
                    if (type === 'submit') submitHandler = cb;
                }
            },
            toast: {
                classList: {
                    add() {},
                    remove() {}
                }
            }
        };

        globalThis.alert = (message) => {
            throw new Error(`unexpected alert: ${message}`);
        };
        globalThis.document = {
            addEventListener(type, cb) {
                if (type === 'DOMContentLoaded') domReady.push(cb);
            },
            getElementById(id) {
                return elements[id];
            }
        };
        globalThis.chrome = {
            storage: {
                local: {
                    get(keys, cb) {
                        const result = {};
                        for (const key of keys) {
                            if (Object.prototype.hasOwnProperty.call(store, key)) {
                                result[key] = store[key];
                            }
                        }
                        cb(result);
                    },
                    set(items, cb) {
                        sets.push(items);
                        Object.assign(store, items);
                        cb();
                    }
                }
            }
        };

        await import('../src/options/options.js');
        assert.equal(domReady.length, 1);

        domReady[0]();
        assert.equal(elements['polling-interval'].value, '5');

        store.pollingInterval = '10';
        domReady[0]();
        assert.equal(elements['polling-interval'].value, '10');

        store.pollingInterval = 0;
        domReady[0]();
        assert.equal(elements['polling-interval'].value, '1');

        elements.username.value = 'octocat';
        elements.token.value = 'ghp_test';
        elements['api-base-url'].value = 'https://api.github.com';

        elements['polling-interval'].value = '2.8';
        submitHandler({ preventDefault() {} });
        assert.equal(sets.at(-1).pollingInterval, 2);
        assert.equal(typeof sets.at(-1).pollingInterval, 'number');
        assert.equal(elements['polling-interval'].value, '2');

        elements['polling-interval'].value = '0';
        submitHandler({ preventDefault() {} });
        assert.equal(sets.at(-1).pollingInterval, 1);

        elements['polling-interval'].value = 'abc';
        submitHandler({ preventDefault() {} });
        assert.equal(sets.at(-1).pollingInterval, 5);

        elements['polling-interval'].value = '';
        submitHandler({ preventDefault() {} });
        assert.equal(sets.at(-1).pollingInterval, 5);
        assert.equal(sets.at(-1).githubUsername, 'octocat');
        assert.deepEqual(sets.at(-1).stalenessThresholds, { staleThreshold: 3, criticalThreshold: 6 });

        delete globalThis.document;
        delete globalThis.alert;
        delete globalThis.chrome;
    });
});

describe('checkForUpdates alarm', () => {
    test('startup and install use the stored interval, and a change recreates only that alarm', async () => {
        const store = { pollingInterval: '101' };
        const created = [];
        const listeners = { onChanged: [], onInstalled: [], onAlarm: [], onClicked: [] };

        globalThis.chrome = {
            storage: {
                local: {
                    get(keys, cb) {
                        const result = {};
                        for (const key of keys) {
                            if (Object.prototype.hasOwnProperty.call(store, key)) {
                                result[key] = store[key];
                            }
                        }
                        cb(result);
                    }
                },
                onChanged: {
                    addListener(fn) { listeners.onChanged.push(fn); }
                }
            },
            alarms: {
                create(name, info) { created.push({ name, info: { ...info } }); },
                onAlarm: { addListener(fn) { listeners.onAlarm.push(fn); } }
            },
            notifications: {
                onClicked: { addListener(fn) { listeners.onClicked.push(fn); } }
            },
            runtime: {
                onInstalled: { addListener(fn) { listeners.onInstalled.push(fn); } },
                getManifest() { return { version: '1.12.0' }; }
            }
        };

        const background = await import('../src/background/background.js');
        await new Promise((resolve) => setImmediate(resolve));

        const checkAlarms = () => created.filter((alarm) => alarm.name === 'checkForUpdates');
        const otherAlarms = () => created.filter((alarm) => alarm.name !== 'checkForUpdates');

        assert.equal(listeners.onChanged.length, 1);
        assert.equal(listeners.onChanged[0], background.handlePollingIntervalStorageChange);
        assert.equal(listeners.onInstalled.length, 1);
        assert.deepEqual(checkAlarms().map((alarm) => alarm.info), [
            { periodInMinutes: 101, delayInMinutes: 0 }
        ]);
        assert.deepEqual(otherAlarms().map((alarm) => ({ name: alarm.name, period: alarm.info.periodInMinutes })), [
            { name: 'dailyLoginNotification', period: 1440 },
            { name: 'pruneLocalStorage', period: 1440 }
        ]);

        const afterStartup = created.length;
        await listeners.onChanged[0]({ githubToken: { newValue: 'x' } }, 'local');
        await listeners.onChanged[0]({ pollingInterval: { oldValue: '101', newValue: 3 } }, 'sync');
        await listeners.onChanged[0]({}, 'local');
        assert.equal(created.length, afterStartup);

        store.pollingInterval = 0;
        await listeners.onChanged[0]({ pollingInterval: { oldValue: '101', newValue: 0 } }, 'local');
        assert.equal(checkAlarms().at(-1).info.periodInMinutes, 1);
        assert.equal(checkAlarms().at(-1).info.delayInMinutes, 0);
        assert.equal(otherAlarms().length, 2);

        store.pollingInterval = 'nope';
        await listeners.onChanged[0]({ pollingInterval: { oldValue: 0, newValue: 'nope' } }, 'local');
        assert.equal(checkAlarms().at(-1).info.periodInMinutes, 5);

        delete store.pollingInterval;
        await listeners.onChanged[0]({ pollingInterval: { oldValue: 'nope' } }, 'local');
        assert.equal(checkAlarms().at(-1).info.periodInMinutes, 5);

        store.pollingInterval = '10';
        await listeners.onChanged[0]({ pollingInterval: { oldValue: undefined, newValue: '10' } }, 'local');
        assert.equal(checkAlarms().at(-1).info.periodInMinutes, 10);

        const othersBeforeInstall = otherAlarms().length;
        store.pollingInterval = 12;
        await listeners.onInstalled[0]({ reason: 'install' });
        assert.equal(checkAlarms().at(-1).info.periodInMinutes, 12);
        assert.equal(otherAlarms().length, othersBeforeInstall);
        assert.deepEqual(
            otherAlarms().map((alarm) => alarm.name),
            ['dailyLoginNotification', 'pruneLocalStorage']
        );
    });
});

after(() => {
    delete globalThis.document;
    delete globalThis.alert;
    delete globalThis.chrome;
});

/**
 * Static checks for the popup's default tab and tab order.
 * Reads popup.html / popup.js as text (no DOM, no dependencies).
 * Run with: node --test tests/popupDefaults.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const popupDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'popup');
const html = readFileSync(path.join(popupDir, 'popup.html'), 'utf8');
const js = readFileSync(path.join(popupDir, 'popup.js'), 'utf8');

// <button id="x-tab" class="tab ...">  (tab bar buttons, in document order)
const tabs = [...html.matchAll(/<button\b[^>]*\bid="([\w-]+)-tab"[^>]*\bclass="([^"]*)"[^>]*>/g)]
    .map(m => ({ name: m[1], classes: m[2].split(/\s+/) }))
    .filter(t => t.classes.includes('tab') && !t.classes.includes('tab-action'));
// <div id="x-content" class="tab-content ...">
const contents = [...html.matchAll(/<div\b[^>]*\bid="([\w-]+)-content"[^>]*\bclass="([^"]*)"[^>]*>/g)]
    .map(m => ({ name: m[1], classes: m[2].split(/\s+/) }))
    .filter(c => c.classes.includes('tab-content'));

describe('popup defaults', () => {
    test('the tab bar and the content panes were parsed', () => {
        assert.ok(tabs.length >= 3, 'expected at least 3 tab buttons');
        assert.ok(contents.length >= 3, 'expected at least 3 content panes');
    });

    test('exactly one tab button is active, and it is personal', () => {
        const active = tabs.filter(t => t.classes.includes('active')).map(t => t.name);
        assert.deepEqual(active, ['personal']);
    });

    test('exactly one tab content is active, and it is personal', () => {
        const active = contents.filter(c => c.classes.includes('active')).map(c => c.name);
        assert.deepEqual(active, ['personal']);
    });

    test('tab order is personal, mine, copilot (copilot third, right after mine)', () => {
        const names = tabs.map(t => t.name);
        assert.deepEqual(names.slice(0, 3), ['personal', 'mine', 'copilot']);
    });

    test('copilot is not the default and has no active class', () => {
        assert.ok(!tabs.find(t => t.name === 'copilot').classes.includes('active'));
        assert.ok(!contents.find(c => c.name === 'copilot').classes.includes('active'));
    });

    test("popup.js opens the popup with switchTab('personal')", () => {
        assert.match(js, /switchTab\(\s*'personal'\s*\)\s*;\s*\/\/\s*Set the default tab/);
        assert.ok(!/switchTab\(\s*'copilot'\s*\)\s*;\s*\/\/\s*Set the default/.test(js));
    });
});

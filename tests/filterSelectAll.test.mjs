/**
 * "Select all" buttons for the popup's multi-select filter sections.
 * Run with: node --test tests/filterSelectAll.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { selectAllOptions } from '../src/shared/filterSelection.js';

const popupDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'popup');
const html = readFileSync(path.join(popupDir, 'popup.html'), 'utf8');
const js = readFileSync(path.join(popupDir, 'popup.js'), 'utf8');

describe('selectAllOptions', () => {
    test('selects every option from an empty selection', () => {
        assert.deepEqual(selectAllOptions(['a', 'b', 'c']), ['a', 'b', 'c']);
    });
    test('does not duplicate already-selected values', () => {
        assert.deepEqual(selectAllOptions(['a', 'b'], ['b']), ['a', 'b']);
    });
    test('keeps persisted values that are not currently listed', () => {
        assert.deepEqual(selectAllOptions(['a'], ['zzz']), ['a', 'zzz']);
    });
    test('does not mutate its inputs', () => {
        const opts = ['a']; const sel = ['b'];
        selectAllOptions(opts, sel);
        assert.deepEqual(opts, ['a']); assert.deepEqual(sel, ['b']);
    });
    test('empty options returns the existing selection', () => {
        assert.deepEqual(selectAllOptions([], []), []);
    });
});

describe('popup select-all buttons', () => {
    const multiselects = [...html.matchAll(/class="custom-multiselect" id="([\w-]+)"/g)].map(m => m[1]);
    test('every multiselect section has a Select all button beside Clear', () => {
        assert.ok(multiselects.length > 0);
        for (const id of multiselects) {
            assert.match(html, new RegExp(`<button type="button" class="select-all-filter-btn" data-filter="${id}">Select all</button>\\s*<button type="button" class="clear-filter-btn" data-filter="${id}">Clear</button>`), id);
        }
    });
    test('date sections get no Select all button', () => {
        assert.doesNotMatch(html, /select-all-filter-btn" data-filter="[\w-]+-date-filter"/);
    });
    test('Select all buttons are real <button>s (keyboard accessible)', () => {
        const n = (html.match(/select-all-filter-btn/g) || []).length;
        assert.equal(n, multiselects.length);
    });
    test('both filter setups wire Select all for orgs, authors, labels and repos', () => {
        for (const d of ['org', 'author', 'label', 'repo']) {
            const wired = js.match(new RegExp(`${d}Div\\.parentElement\\.querySelector\\('\\.select-all-filter-btn'\\)\\.onclick`, 'g')) || [];
            assert.equal(wired.length, 2, d);
        }
    });
});

/**
 * Helpers for the popup's multi-select filter sections.
 */

/**
 * Returns a new selection containing every option in a section, keeping any
 * already-selected values (even ones no longer listed) so nothing persisted is lost.
 * @param {string[]} options - All options shown in the section.
 * @param {string[]} [selected=[]] - Currently selected values.
 * @returns {string[]} New selection with every option selected.
 */
export function selectAllOptions(options, selected = []) {
    const extras = selected.filter(v => !options.includes(v));
    return [...new Set([...options, ...extras])];
}

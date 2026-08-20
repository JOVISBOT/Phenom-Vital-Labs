/**
 * Local persistence for the planner.
 *
 * This is the only feature on the site that remembers anything about a
 * visitor, and what it remembers is the most sensitive thing here: a named
 * compound, a dose, and the dates someone is injecting it. So it is stored in
 * this browser and nowhere else. It is never sent to analytics, never posted
 * to an endpoint, never put in the URL, and a test in test/planner.test.mjs
 * fails the build if the storage key ever reaches the analytics module.
 *
 * Storage can throw rather than return null - Safari private browsing, a
 * blocked third-party context, a full quota - so every call is wrapped. A
 * planner that cannot save is a planner that still calculates; a planner that
 * throws on load is a blank page.
 *
 * @module planStore
 */

export const STORAGE_KEY = 'pvl-plan';

/** Bump when the shape changes. An older payload is discarded, not migrated. */
export const SCHEMA_VERSION = 1;

/**
 * Whether this browser will actually keep what we write.
 *
 * `typeof localStorage` is not enough: it exists and throws on access in a
 * blocked context. The only reliable test is a round trip.
 * @returns {boolean}
 */
export function isAvailable() {
    try {
        const probe = `${STORAGE_KEY}-probe`;
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return true;
    } catch {
        return false;
    }
}

/**
 * The saved plan, or null.
 *
 * Anything unparseable, from a different schema, or not an object is treated
 * as absent. A half-read plan would render a page of confident wrong dates.
 * @returns {Object|null}
 */
export function load() {
    let raw;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
    if (!raw) return null;

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== SCHEMA_VERSION) return null;
    return parsed;
}

/**
 * Persist a plan.
 * @param {Object} state
 * @returns {boolean} whether it was actually written
 */
export function save(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: SCHEMA_VERSION }));
        return true;
    } catch {
        return false;
    }
}

/** Forget everything. Offered on the page, because this is shared-computer data. */
export function clear() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch {
        return false;
    }
}

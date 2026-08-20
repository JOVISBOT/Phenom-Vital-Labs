/**
 * Light/dark theme.
 *
 * The initial value is set by an inline script in <head> (see THEME_BOOT below,
 * which is what gets inlined) so the first paint is already the right colour --
 * doing it here would flash white first. This module only owns the toggle and
 * the stored preference.
 *
 * @module theme
 */

export const STORAGE_KEY = 'pvl-theme';

/**
 * The snippet inlined into every page's <head>.
 *
 * Kept here as a string, and written into the HTML by tools/build-pages.js, so
 * the boot logic and the toggle logic cannot drift apart -- a stored 'dark'
 * that the toggle writes and the boot script does not read would flash the
 * wrong theme on every navigation.
 */
export const THEME_BOOT = `(function(){try{var s=localStorage.getItem('pvl-theme');`
    + `var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;`
    + `document.documentElement.setAttribute('data-theme',d?'dark':'light');}`
    + `catch(e){}})();`;

/** @returns {'light'|'dark'} */
export function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * Apply a theme and remember it.
 * @param {'light'|'dark'} theme
 */
export function setTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }

    const btn = document.querySelector('.theme-toggle');
    if (btn) {
        btn.setAttribute('aria-pressed', String(next === 'dark'));
        btn.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    return next;
}

/**
 * Wire the header toggle. Safe to call on a page that has no toggle.
 * @param {(theme: string) => void} [onChange]
 */
export function initThemeToggle(onChange) {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;

    setTheme(currentTheme());
    btn.addEventListener('click', () => {
        const next = setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
        if (onChange) onChange(next);
    });

    // Follow the OS while the visitor has never chosen for themselves. Once
    // they touch the toggle, their choice wins and this stops applying.
    if (window.matchMedia) {
        let stored = null;
        try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
        if (!stored) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            });
        }
    }
}

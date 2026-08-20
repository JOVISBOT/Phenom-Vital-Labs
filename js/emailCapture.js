/**
 * Email capture on the PDF export.
 *
 * The protocol sheet is the one thing on this site a visitor wants to keep, so
 * it is the natural and only honest place to ask for an address - the ask is
 * attached to something being given, not bolted onto a page load as a popup.
 *
 * Three rules this module will not break:
 *   1. If no provider is configured, the visitor is never asked. There is
 *      nowhere to store an address, so asking would be theatre.
 *   2. In the default 'soft' mode the download always proceeds. A failed
 *      network call, a blocked endpoint or a "no thanks" all still get the PDF.
 *   3. Asked once. A declined or completed ask is remembered locally and never
 *      repeated.
 *
 * @module emailCapture
 */

import { SITE } from './config.js';
import { track } from './analytics.js';

const cfg = SITE.emailCapture || { provider: 'none' };

const STORE_EMAIL = 'pvl.email';
const STORE_DECLINED = 'pvl.email.declined';

/* localStorage throws in private mode on some browsers, and a storage error
   must not cost the visitor their download. */
function readStore(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}

/** True when an address could actually be delivered somewhere. */
export function configured() {
    return cfg.provider !== 'none' && !!cfg.endpoint;
}

/** True when this visitor should not be asked again. */
export function alreadyAnswered() {
    return !!readStore(STORE_EMAIL) || readStore(STORE_DECLINED) === '1';
}

/**
 * The address on file for this browser, if any.
 * @returns {string|null}
 */
export function knownEmail() {
    return readStore(STORE_EMAIL);
}

/**
 * Deliver an address to the configured endpoint.
 * @param {string} email
 * @param {Object} context - {source, peptide}
 * @returns {Promise<boolean>} true when the endpoint accepted it
 */
async function deliver(email, context) {
    const body = {
        email,
        source: context.source || 'pdf',
        peptide: context.peptide || '',
        page: typeof location !== 'undefined' ? location.pathname : ''
    };

    const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
    });

    return res.ok;
}

/** Cheap structural check. Real validation is the endpoint's job. */
export function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
}

/**
 * Ask for an address, if it is appropriate to ask.
 *
 * @param {Object} context - {source, peptide}
 * @returns {Promise<{proceed: boolean, email: string|null}>}
 */
export function requestEmail(context = {}) {
    if (!configured() || alreadyAnswered()) {
        return Promise.resolve({ proceed: true, email: knownEmail() });
    }
    return showModal(context);
}

/**
 * Build and show the dialog. Resolves when the visitor decides.
 * @param {Object} context
 * @returns {Promise<{proceed: boolean, email: string|null}>}
 */
function showModal(context) {
    return new Promise(resolve => {
        const hard = cfg.mode === 'hard';
        const previous = document.activeElement;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ecTitle" aria-describedby="ecBody">
                <h2 id="ecTitle">Want this sheet emailed to you?</h2>
                <p id="ecBody">
                    We will send this protocol sheet as a PDF, and occasional updates when a dose
                    figure on this site changes. No sharing, no selling, one-click unsubscribe.
                </p>
                <form class="modal-form" novalidate>
                    <label class="modal-label" for="ecEmail">Email address</label>
                    <input id="ecEmail" type="email" inputmode="email" autocomplete="email"
                           placeholder="you@example.com" required>
                    <p class="modal-error" id="ecError" role="alert" hidden></p>
                    <button class="btn" type="submit" id="ecSubmit">Email me the sheet</button>
                    ${hard ? '' : '<button class="modal-skip" type="button" id="ecSkip">No thanks, just download it</button>'}
                </form>
            </div>`;

        const close = outcome => {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            if (previous && previous.focus) previous.focus();
            resolve(outcome);
        };

        const onKey = e => {
            if (e.key === 'Escape' && !hard) {
                writeStore(STORE_DECLINED, '1');
                track('email_declined', { via: 'escape' });
                close({ proceed: true, email: null });
            }
            if (e.key === 'Tab') trapFocus(e, overlay);
        };

        document.body.appendChild(overlay);
        document.addEventListener('keydown', onKey);
        overlay.querySelector('#ecEmail').focus();

        overlay.addEventListener('mousedown', e => {
            if (e.target === overlay && !hard) {
                writeStore(STORE_DECLINED, '1');
                track('email_declined', { via: 'backdrop' });
                close({ proceed: true, email: null });
            }
        });

        const skip = overlay.querySelector('#ecSkip');
        if (skip) {
            skip.addEventListener('click', () => {
                writeStore(STORE_DECLINED, '1');
                track('email_declined', { via: 'skip' });
                close({ proceed: true, email: null });
            });
        }

        overlay.querySelector('.modal-form').addEventListener('submit', async e => {
            e.preventDefault();
            const input = overlay.querySelector('#ecEmail');
            const error = overlay.querySelector('#ecError');
            const submit = overlay.querySelector('#ecSubmit');
            const email = input.value.trim();

            const fail = message => {
                error.textContent = message;
                error.hidden = false;
                submit.disabled = false;
                submit.textContent = 'Email me the sheet';
            };

            if (!looksLikeEmail(email)) {
                fail('That does not look like an email address.');
                input.focus();
                return;
            }

            error.hidden = true;
            submit.disabled = true;
            submit.textContent = 'Sending...';

            let accepted = false;
            try {
                accepted = await deliver(email, context);
            } catch {
                accepted = false;
            }

            if (accepted) {
                writeStore(STORE_EMAIL, email);
                track('email_captured', { source: context.source || 'pdf' });
                close({ proceed: true, email });
                return;
            }

            track('email_failed', { source: context.source || 'pdf' });

            // Soft mode: the download is not held hostage to our mailing list.
            if (cfg.mode !== 'hard') {
                close({ proceed: true, email: null });
                return;
            }
            fail('Could not reach the mailing list. Try again in a moment.');
        });
    });
}

/** Keep keyboard focus inside the dialog while it is open. */
function trapFocus(e, root) {
    const focusable = root.querySelectorAll('input, button, [href], select, textarea');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

/**
 * Analytics - a thin, provider-agnostic event layer.
 *
 * The site had no measurement at all, so there was no way to answer the only
 * questions that matter: which peptide people come for, whether they get as far
 * as a result, and whether anyone takes the PDF. This module answers those
 * without cookies, without a consent banner and without a vendor lock-in.
 *
 * Design rules, in order of importance:
 *   1. Never send anything identifying. Body weight, age and email addresses
 *      are health data about a named person; they are never passed here. The
 *      peptide id and the tier are not - they are catalogue facts.
 *   2. Never break the page. Every call is wrapped; a blocked or failed beacon
 *      must not stop a calculation or a download.
 *   3. Honour Do Not Track and Global Privacy Control.
 *
 * @module analytics
 */

import { SITE } from './config.js';

const cfg = SITE.analytics || { provider: 'none' };

/** Events fired before the provider script finished loading. */
const queue = [];
let ready = false;
let loading = false;

/**
 * True when the visitor has asked not to be tracked.
 * @returns {boolean}
 */
function optedOut() {
    if (typeof navigator === 'undefined') return true;
    return navigator.doNotTrack === '1'
        || window.doNotTrack === '1'
        || navigator.msDoNotTrack === '1'
        || navigator.globalPrivacyControl === true;
}

/** True when a provider is configured with the id it actually needs. */
export function enabled() {
    switch (cfg.provider) {
        case 'plausible':   return !!cfg.domain;
        case 'goatcounter': return !!cfg.site;
        case 'cloudflare':  return !!cfg.token;
        case 'umami':       return !!cfg.token && !!cfg.host;
        default:            return false;
    }
}

/**
 * Inject the provider's own script tag. Called once, lazily.
 */
function loadProvider() {
    if (loading || ready || !enabled() || optedOut()) return;
    loading = true;

    const s = document.createElement('script');
    s.defer = true;

    switch (cfg.provider) {
        case 'plausible':
            s.src = 'https://plausible.io/js/script.js';
            s.setAttribute('data-domain', cfg.domain);
            break;
        case 'goatcounter':
            s.src = 'https://gc.zgo.at/count.js';
            s.setAttribute('data-goatcounter', `https://${cfg.site}.goatcounter.com/count`);
            break;
        case 'cloudflare':
            s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
            s.setAttribute('data-cf-beacon', JSON.stringify({ token: cfg.token }));
            break;
        case 'umami':
            s.src = `${cfg.host.replace(/\/$/, '')}/script.js`;
            s.setAttribute('data-website-id', cfg.token);
            break;
        default:
            loading = false;
            return;
    }

    s.crossOrigin = 'anonymous';
    s.onload = () => { ready = true; flush(); };
    s.onerror = () => { loading = false; };   // ad blocker, offline - stay silent
    document.head.appendChild(s);
}

/** Send everything that queued while the provider script was in flight. */
function flush() {
    while (queue.length) {
        const [name, props] = queue.shift();
        send(name, props);
    }
}

/**
 * Hand one event to whichever provider is configured.
 * @param {string} name
 * @param {Object} props
 */
function send(name, props) {
    try {
        switch (cfg.provider) {
            case 'plausible':
                if (window.plausible) window.plausible(name, { props });
                break;
            case 'goatcounter':
                if (window.goatcounter && window.goatcounter.count) {
                    window.goatcounter.count({
                        path: `event/${name}${props.peptide ? `/${props.peptide}` : ''}`,
                        title: name,
                        event: true
                    });
                }
                break;
            case 'umami':
                if (window.umami) window.umami.track(name, props);
                break;
            // Cloudflare Web Analytics has no custom event API - page views only.
            default:
                break;
        }
    } catch {
        /* measurement must never break the page */
    }
}

/**
 * Record a named event.
 *
 * @param {string} name  - short, stable event name (e.g. 'calculate')
 * @param {Object} [props] - flat, non-identifying string/number properties
 */
export function track(name, props = {}) {
    try {
        if (cfg.debug) console.info('[analytics]', name, props);
        if (!enabled() || optedOut()) return;

        loadProvider();
        if (ready) send(name, props);
        else queue.push([name, props]);
    } catch {
        /* never throw from a measurement call */
    }
}

/**
 * Record the page view. Plausible, GoatCounter and Cloudflare all count the
 * view themselves on script load, so this only has to make sure the script is
 * on the page.
 */
export function pageview() {
    try {
        if (!enabled() || optedOut()) return;
        loadProvider();
    } catch {
        /* ignore */
    }
}

// Every page that includes this module counts as a view. Event calls are opt-in
// from the page's own code.
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', pageview);
    } else {
        pageview();
    }
}

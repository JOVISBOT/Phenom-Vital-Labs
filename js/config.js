/**
 * Site configuration - the only file that needs editing to switch the growth
 * features on.
 *
 * Everything here ships disabled. Nothing phones home, nothing is collected and
 * nothing is asked of a visitor until a real account id is pasted in below. A
 * half-wired analytics call that silently fails is worse than none: it looks
 * like measurement while measuring nothing.
 *
 * @module config
 */

export const SITE = {
    /** Canonical origin + base path. Used to build absolute URLs for meta tags. */
    origin: 'https://jovisbot.github.io',
    basePath: '/Phenom-Vital-Labs/',

    name: 'Phenom Vital Labs',

    /**
     * Analytics.
     *
     * provider: 'none' | 'plausible' | 'goatcounter' | 'cloudflare' | 'umami'
     *
     * All four are cookie-free and need no consent banner in the EU, which is
     * why Google Analytics is not on the list - it would put a cookie banner in
     * front of a calculator.
     *
     *   plausible   -> set `domain` to the domain registered in Plausible
     *   goatcounter -> set `site` to the goatcounter subdomain (e.g. 'phenom')
     *   cloudflare  -> set `token` to the Web Analytics beacon token
     *   umami       -> set `token` (website id) and `host` (script origin)
     *
     * Custom events (which peptide, which tier, PDF downloads) work on
     * plausible, goatcounter and umami. Cloudflare Web Analytics is page views
     * only - it has no custom event API - so it will record traffic but not
     * behaviour.
     */
    analytics: {
        provider: 'none',
        domain: '',
        site: '',
        token: '',
        host: '',
        /** Log every event to the console instead of sending it. For local checks. */
        debug: false
    },

    /**
     * Email capture on the PDF export.
     *
     * provider: 'none' | 'formspree' | 'custom'
     *   formspree -> endpoint is the form URL, e.g. https://formspree.io/f/abcdwxyz
     *   custom    -> any endpoint that accepts a JSON POST of {email, source, peptide}
     *
     * With provider 'none' the visitor is never asked for an email, because
     * there is nowhere to put one. The PDF downloads exactly as it does today.
     *
     * mode: 'soft' - ask, but always allow the download (recommended)
     *       'hard' - require an address before the first download
     */
    emailCapture: {
        provider: 'none',
        endpoint: '',
        mode: 'soft'
    }
};

/** Absolute URL for a site-relative path. */
export function siteUrl(path = '') {
    return `${SITE.origin}${SITE.basePath}${String(path).replace(/^\//, '')}`;
}

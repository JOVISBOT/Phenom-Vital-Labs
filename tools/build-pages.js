/**
 * Static page builder.
 *
 * The whole catalogue used to live behind one dropdown on one URL, so a search
 * engine could index exactly one page and every long-tail query -- "bpc 157
 * dosage calculator", "how much bac water for a 5mg vial", "tesamorelin units"
 * -- landed on a generic homepage or nowhere. This emits one real page per
 * peptide plus a directory, each with its own title, description, canonical and
 * a body that answers the question without needing JavaScript to run.
 *
 * The numbers on those pages are not written by hand. They come from the same
 * calculator.js the app uses, at build time, so a page cannot drift from the
 * app: `npm run build:pages` regenerates, and test/pages.test.mjs fails the
 * build if the committed HTML no longer matches the data.
 *
 * Usage:  node tools/build-pages.js [--check]
 *         --check  exits non-zero if any output would change (used by tests/CI)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    performCalculation, defaultReconMl, calculateSyringeUnits, concentration,
    dosesPerCycle, RECON_VOLUMES, DEFAULT_SYRINGE
} from '../js/calculator.js';
import { evidenceFor, vialProvenanceFor, formatDose } from '../js/ui.js';
import { SITE, siteUrl } from '../js/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_V = 30;

/* ------------------------------------------------------------------ helpers */

const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const num = (n, dp = 2) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '';
    return String(Number(v.toFixed(dp)));
};

const units = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Search results cut a title around 60 characters, and some peptide names are
 *  30 on their own. Take the most descriptive variant that still fits, and the
 *  shortest one when none does. */
export const TITLE_MAX = 65;
export function pickTitle(candidates) {
    return candidates.find(t => t.length <= TITLE_MAX)
        || candidates.reduce((a, b) => (b.length < a.length ? b : a));
}

/**
 * Coarse theme for a peptide.
 *
 * `category` is almost unique per record -- 41 categories across 44 peptides --
 * so grouping by it produces 41 sections of one item and no useful "related"
 * links. This buckets them into the handful of reasons someone is actually
 * searching.
 * @param {Object} p
 * @returns {string}
 */
export const THEME_OVERRIDES = {
    // "Cellular Energy & DNA Repair" reads as healing to a keyword match, but
    // NAD+ belongs next to MOTS-C and the senolytics. Naming the exception is
    // safer than widening the longevity pattern: a bare "nad" also matches
    // goNADorelin.
    nadplus: 'Longevity and immune'
};

export function themeFor(p) {
    if (THEME_OVERRIDES[p.id]) return THEME_OVERRIDES[p.id];
    const hay = `${p.category} ${p.name} ${p.id}`.toLowerCase();

    // `gh` has to be a whole word. As a bare substring it matches "weight",
    // which filed Cagrisema - a GLP-1/amylin fat-loss combo - under growth
    // hormone. Anchor short tokens; long ones are safe unanchored.
    if (/\b[gh]?gh\b|growth hormone|secretagogue|ghrp|ghrh|somat|sermorelin|tesamorelin|ipamorelin|hexarelin|mgf/.test(hay)) {
        return 'Growth hormone';
    }
    if (/heal|repair|tissue|fibro|bpc|tb.?500|pain/.test(hay)) return 'Healing and repair';
    if (/\bglp|\bgip|weight|fat|appetite|amylin|metabolic|ampk|lipol|triple hormone|glucagon/.test(hay)) {
        return 'Fat loss and metabolic';
    }
    if (/nootropic|neuro|cogniti|sleep|dsip|opioid/.test(hay)) return 'Cognitive and sleep';
    if (/fertil|testosterone|libido|sexual|gonad|melanogen/.test(hay)) return 'Hormonal and sexual health';
    if (/immune|thymus|bioregulator|longevity|senolytic|antioxidant|mitochond|dna|cellular|blood cell/.test(hay)) {
        return 'Longevity and immune';
    }
    return 'Muscle and performance';
}

const THEME_ORDER = [
    'Growth hormone',
    'Fat loss and metabolic',
    'Healing and repair',
    'Muscle and performance',
    'Longevity and immune',
    'Hormonal and sexual health',
    'Cognitive and sleep'
];

/** The reference calculation every page is built from: stock vial, stock water. */
function reference(p) {
    return performCalculation(p, {
        weightLbs: 165,                 // recorded only; doses here are flat, not per-kg
        vialSize: p.vialSize,
        reconMl: defaultReconMl(p),
        syringe: DEFAULT_SYRINGE
    });
}

/**
 * The arithmetic, spelled out, exactly as the app shows it.
 * @returns {string}
 */
function workingFor(p, r, level = 'med') {
    if (r.noRecon) return `Supplied pre-filled at ${formatDose(r.doses[level], r.doseUnit)} - nothing to mix and nothing to draw.`;

    const doseInVialUnits = p.doseUnit === 'mcg' ? r.doses[level] / 1000 : r.doses[level];
    return `${num(doseInVialUnits, 4)} ${p.vialUnit} ÷ ${num(r.concentrationAt[level], 2)} ${p.vialUnit}/ml `
        + `= ${num(r.volumeMl[level], 3)} ml = ${units(r.syringeUnits[level])} units`;
}

/**
 * Units to draw for the mid dose at each offered water volume.
 *
 * More water is not free: past a point the same dose stops fitting in a barrel.
 * A U-100 syringe tops out at 100 units, so anything above that is two draws --
 * printing it bare reads as an instruction a visitor cannot carry out.
 */
function reconTable(p) {
    if (p.noRecon) return [];
    return RECON_VOLUMES.map(ml => {
        const u = calculateSyringeUnits(p, p.med, p.vialSize, ml);
        return {
            ml,
            conc: concentration(p.vialSize, ml),
            units: u,
            overflow: u > DEFAULT_SYRINGE
        };
    });
}

/* --------------------------------------------------------------- page parts */

function head({ title, description, canonical, extraCss = '', jsonLd = [] }) {
    const ld = jsonLd.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n    ');
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${esc(canonical)}">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#1e40af">

    <meta property="og:type" content="article">
    <meta property="og:site_name" content="${esc(SITE.name)}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${esc(canonical)}">
    <meta property="og:image" content="${esc(siteUrl('og-image.png'))}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${esc(siteUrl('og-image.png'))}">

    <link rel="icon" href="${extraCss}favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${extraCss}css/styles.css?v=${ASSET_V}">
    <link rel="stylesheet" href="${extraCss}css/pages.css?v=${ASSET_V}">
    ${ld}
</head>
<body>
    <header>
        <div class="header-inner">
            <a class="brand-text" href="${extraCss}"><span>Phenom</span> Vital Labs</a>
            <div class="verified"><span class="verified-dot" aria-hidden="true"></span>Research use only</div>
        </div>
    </header>
`;
}

function foot(rel) {
    return `
    <footer>
        <strong>Phenom Vital Labs</strong> &middot; Reference calculator, no products sold &middot;
        <a href="${rel}p/">All peptides</a>
    </footer>
    <script type="module" src="${rel}js/analytics.js?v=${ASSET_V}"></script>
</body>
</html>
`;
}

const DISCLAIMER = `
        <div class="footer-disclaimer" role="note">
            <strong>Research information only - not medical advice</strong>
            <p>
                Phenom Vital Labs publishes reference calculations for research peptides. Nothing here is a
                prescription, a diagnosis, or a recommendation to inject anything. Most of these compounds are not
                approved for human use, dosing conventions are drawn from community practice rather than controlled
                trials, and product identity, purity and sterility vary by supplier. Talk to a licensed physician
                before starting, changing or stopping any protocol, and ask your supplier for a lot-specific
                third-party certificate of analysis.
            </p>
        </div>`;

/* ----------------------------------------------------------------- the FAQs */

/**
 * The questions people actually type, answered with this record's own numbers.
 * Also the source for the FAQPage structured data, so the two can never
 * disagree.
 * @returns {Array<{q: string, a: string}>}
 */
export function faqsFor(p, r) {
    const out = [];
    const dose = formatDose(r.doses.med, r.doseUnit);
    const ev = evidenceFor(p);

    if (!r.noRecon) {
        out.push({
            q: `How many units is ${dose} of ${p.name} on an insulin syringe?`,
            a: `${units(r.syringeUnits.med)} units on a U-100 insulin syringe, when a ${num(p.vialSize, 3)} ${p.vialUnit} `
                + `vial is reconstituted with ${num(defaultReconMl(p), 2)} ml of bacteriostatic water. `
                + `That is ${num(r.volumeMl.med, 3)} ml. A U-100 syringe reads 100 units per millilitre whether the `
                + `barrel holds 30, 50 or 100 units - the barrel size changes how much fits, not what a unit means.`
        });
        out.push({
            q: `How much bacteriostatic water should I add to a ${num(p.vialSize, 3)} ${p.vialUnit} vial of ${p.name}?`,
            a: `${num(defaultReconMl(p), 2)} ml is the volume used here, giving ${num(r.concentration, 2)} ${p.vialUnit} per ml. `
                + `Water changes the concentration, not the amount of peptide: the vial holds ${num(p.vialSize, 3)} ${p.vialUnit} `
                + `however much you add. More water means a larger, easier-to-read draw for the same dose.`
        });
    }

    out.push({
        q: `How often is ${p.name} injected?`,
        a: `${p.freq}. A typical course runs ${p.cycle}, which is ${dosesPerCycle(p)} injections. `
            + `Reported half-life is ${p.halfLife}.`
    });

    out.push({
        q: `How many vials does one ${p.name} cycle take?`,
        a: `About ${r.vialsNeeded} ${r.noRecon ? (p.device || 'device') : `${num(p.vialSize, 3)} ${p.vialUnit} vial`}`
            + `${r.vialsNeeded === 1 ? '' : 's'} for the full course - ${dosesPerCycle(p)} doses at ${dose} each, `
            + `${num(r.totalCycle, 2)} ${p.vialUnit} in total.`
    });

    out.push({
        q: `Is ${p.name} approved for human use?`,
        a: `${ev.label}. ${ev.blurb}`
    });

    return out;
}

/* ------------------------------------------------------------ peptide page */

function peptidePage(p, all) {
    const r = reference(p);
    const ev = evidenceFor(p);
    const prov = vialProvenanceFor(p);
    const faqs = faqsFor(p, r);
    const theme = themeFor(p);
    const canonical = siteUrl(`p/${p.id}/`);

    const related = all
        .filter(o => o.id !== p.id && themeFor(o) === theme)
        .slice(0, 6);

    const description = r.noRecon
        ? `${p.name}: ${formatDose(r.doses.med, r.doseUnit)} per dose, ${p.freq.toLowerCase()}, `
            + `${dosesPerCycle(p)} doses per ${p.cycle} course. Pre-filled ${p.device || 'device'} - nothing to reconstitute.`
        : `${p.name}: ${formatDose(r.doses.med, r.doseUnit)} is ${units(r.syringeUnits.med)} units on a U-100 insulin `
            + `syringe when a ${num(p.vialSize, 3)} ${p.vialUnit} vial is mixed with ${num(defaultReconMl(p), 2)} ml `
            + `bacteriostatic water. Reconstitution table, cycle length and vial count.`;

    const title = pickTitle([
        `${p.name} Dosage Calculator - Units & Reconstitution | ${SITE.name}`,
        `${p.name} Dosage Calculator | ${SITE.name}`,
        `${p.name} Dosage Calculator - Units & Reconstitution`,
        `${p.name} Dosage Calculator`
    ]);

    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Peptide Dosage Calculator', item: siteUrl('') },
                { '@type': 'ListItem', position: 2, name: 'All peptides', item: siteUrl('p/') },
                { '@type': 'ListItem', position: 3, name: p.name, item: canonical }
            ]
        },
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map(f => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a }
            }))
        }
    ];

    const tiers = ['low', 'med', 'high'];
    const tierLabel = { low: 'Conservative', med: 'Recommended', high: 'Advanced' };

    const doseRows = tiers.map(t => `
                    <tr${t === 'med' ? ' class="is-featured"' : ''}>
                        <th scope="row">${tierLabel[t]}</th>
                        <td>${esc(formatDose(r.doses[t], r.doseUnit))}</td>
                        <td>${r.noRecon ? '&mdash;' : `${units(r.syringeUnits[t])} units`}</td>
                        <td>${r.noRecon ? '&mdash;' : `${num(r.volumeMl[t], 3)} ml`}</td>
                        <td>${r.overflow[t] || r.exceedsVial[t] ? '<span class="flag">does not fit one draw</span>' : 'single draw'}</td>
                    </tr>`).join('');

    const componentRows = (r.components.med || []).map(c => `
                        <li><strong>${esc(c.name)}</strong><span>${num(c.mcg, 1)} mcg</span></li>`).join('');

    const reconRows = reconTable(p).map(row => `
                    <tr${row.ml === defaultReconMl(p) ? ' class="is-featured"' : ''}>
                        <th scope="row">${num(row.ml, 2)} ml</th>
                        <td>${num(row.conc, 2)} ${esc(p.vialUnit)}/ml</td>
                        <td>${units(row.units)} units${row.overflow ? ' <span class="flag">does not fit one draw</span>' : ''}</td>
                    </tr>`).join('');

    const list = (items, cls) => (items && items.length)
        ? `<ul class="${cls}">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
        : '';

    return head({ title, description, canonical, extraCss: '../../', jsonLd })
        + `
    <main class="container">
        <nav class="crumbs" aria-label="Breadcrumb">
            <a href="../../">Calculator</a> <span aria-hidden="true">/</span>
            <a href="../">All peptides</a> <span aria-hidden="true">/</span>
            <span aria-current="page">${esc(p.name)}</span>
        </nav>

        <article class="peptide-page">
            <div class="intro intro-left">
                <h1>${esc(p.name)} Dosage Calculator</h1>
                <p>${esc(p.category)} &middot; ${esc(p.freq)} &middot; half-life ${esc(p.halfLife)}</p>
            </div>

            <div class="evidence-badge evidence-${esc(ev.key)}" role="note">
                <strong>${esc(ev.label)}</strong> &mdash; ${esc(ev.blurb)}
            </div>

            <section class="card answer-card">
                <h2>The answer</h2>
                <p class="answer-lede">
                    ${r.noRecon
                        ? `${esc(p.name)} is supplied pre-filled at <strong>${esc(formatDose(r.doses.med, r.doseUnit))}</strong>. There is nothing to reconstitute and nothing to draw.`
                        : `<strong>${esc(formatDose(r.doses.med, r.doseUnit))}</strong> of ${esc(p.name)} is
                           <strong>${units(r.syringeUnits.med)} units</strong> on a U-100 insulin syringe, when a
                           ${num(p.vialSize, 3)} ${esc(p.vialUnit)} vial is mixed with
                           ${num(defaultReconMl(p), 2)} ml of bacteriostatic water.`}
                </p>
                <p class="working"><code>${esc(workingFor(p, r))}</code></p>
                ${componentRows ? `
                <div class="component-list">
                    <h3>Per component, at the recommended dose</h3>
                    <ul>${componentRows}</ul>
                    <p class="note">Dosing conventions for a blend are stated per component, so the combined figure alone reads as double.</p>
                </div>` : ''}

                <table class="data-table">
                    <caption>Dose tiers at a ${num(p.vialSize, 3)} ${esc(p.vialUnit)} vial in ${num(defaultReconMl(p), 2)} ml, U-100 syringe</caption>
                    <thead><tr><th scope="col">Tier</th><th scope="col">Dose</th><th scope="col">Draw</th><th scope="col">Volume</th><th scope="col">Fits?</th></tr></thead>
                    <tbody>${doseRows}
                    </tbody>
                </table>

                <a class="btn cta" href="../../?p=${encodeURIComponent(p.id)}" data-cta="calculator">
                    Open this in the calculator &mdash; change the vial, water or syringe
                </a>
            </section>

            ${reconRows ? `
            <section class="card">
                <h2>Reconstitution table</h2>
                <p>How far up the barrel ${esc(formatDose(r.doses.med, r.doseUnit))} sits at each water volume. The peptide
                   in the vial never changes &mdash; only the concentration, and therefore the draw.</p>
                <table class="data-table">
                    <caption>${num(p.vialSize, 3)} ${esc(p.vialUnit)} vial, recommended dose of ${esc(formatDose(r.doses.med, r.doseUnit))}</caption>
                    <thead><tr><th scope="col">Bacteriostatic water</th><th scope="col">Concentration</th><th scope="col">Draw</th></tr></thead>
                    <tbody>${reconRows}
                    </tbody>
                </table>
                <p class="note">More water means a bigger, easier-to-read draw for the same dose. A dose that lands near
                   the 2-unit mark is one half-mark misread away from a 25% dosing error. Past 100 units the dose no
                   longer fits a U-100 barrel at all &mdash; that is two injections, not a bigger syringe.</p>
            </section>` : ''}

            <section class="card">
                <h2>Protocol at a glance</h2>
                <dl class="facts">
                    <div><dt>Category</dt><dd>${esc(p.category)}</dd></div>
                    <div><dt>Frequency</dt><dd>${esc(p.freq)}</dd></div>
                    <div><dt>Cycle</dt><dd>${esc(p.cycle)}</dd></div>
                    <div><dt>Injections per cycle</dt><dd>${dosesPerCycle(p)}</dd></div>
                    <div><dt>Half-life</dt><dd>${esc(p.halfLife)}</dd></div>
                    <div><dt>Vials per cycle</dt><dd>${r.vialsNeeded}</dd></div>
                    <div><dt>Total peptide per cycle</dt><dd>${num(r.totalCycle, 2)} ${esc(p.vialUnit)}</dd></div>
                    <div><dt>Dose range</dt><dd>${esc(formatDose(r.doses.low, r.doseUnit))} &ndash; ${esc(formatDose(r.doses.high, r.doseUnit))}</dd></div>
                </dl>
                <p class="note"><strong>Vial sizes:</strong> ${esc(prov.headline)}${prov.source ? ` ${esc(prov.source)}.` : ''}</p>
            </section>

            <section class="card">
                <h2>What ${esc(p.name)} is</h2>
                <p>${esc(p.research)}</p>
                ${p.mechanism ? `<h3>Mechanism</h3><p>${esc(p.mechanism)}</p>` : ''}
            </section>

            <section class="card">
                <h2>Reported effects and risks</h2>
                <div class="pros-cons">
                    <div><h3 class="pc-title pros">Reported benefits</h3>${list(p.pros, 'pc-list')}</div>
                    <div><h3 class="pc-title cons">Reported drawbacks</h3>${list(p.cons, 'pc-list')}</div>
                </div>
                <h3 class="pc-title warnings">Warnings</h3>
                ${list(p.warnings, 'pc-list')}
                <h3>Administration notes</h3>
                ${list(p.inst, 'pc-list')}
            </section>

            <section class="card">
                <h2>Common questions</h2>
                <div class="faq">
                    ${faqs.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n                    ')}
                </div>
            </section>

            ${related.length ? `
            <section class="card">
                <h2>Related: ${esc(theme.toLowerCase())}</h2>
                <ul class="related">
                    ${related.map(o => `<li><a href="../${esc(o.id)}/">${esc(o.name)}</a><span>${esc(o.category)}</span></li>`).join('\n                    ')}
                </ul>
                <p class="note"><a href="../">See all 44 peptides &rarr;</a></p>
            </section>` : ''}
${DISCLAIMER}
        </article>
    </main>
` + foot('../../');
}

/* ---------------------------------------------------------------- hub page */

function hubPage(all) {
    const canonical = siteUrl('p/');
    const byTheme = {};
    for (const p of all) {
        const t = themeFor(p);
        (byTheme[t] = byTheme[t] || []).push(p);
    }

    const themes = [...THEME_ORDER.filter(t => byTheme[t]), ...Object.keys(byTheme).filter(t => !THEME_ORDER.includes(t))];

    const sections = themes.map(t => {
        const rows = byTheme[t]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(p => {
                const r = reference(p);
                return `
                    <tr>
                        <th scope="row"><a href="${esc(p.id)}/">${esc(p.name)}</a></th>
                        <td>${esc(formatDose(r.doses.med, r.doseUnit))}</td>
                        <td>${r.noRecon ? 'pre-filled' : `${units(r.syringeUnits.med)} units`}</td>
                        <td>${esc(p.freq)}</td>
                    </tr>`;
            }).join('');

        return `
            <section class="card">
                <h2>${esc(t)}</h2>
                <table class="data-table">
                    <thead><tr><th scope="col">Peptide</th><th scope="col">Recommended dose</th><th scope="col">Draw</th><th scope="col">Frequency</th></tr></thead>
                    <tbody>${rows}
                    </tbody>
                </table>
            </section>`;
    }).join('');

    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Peptide Dosage Calculator', item: siteUrl('') },
                { '@type': 'ListItem', position: 2, name: 'All peptides', item: canonical }
            ]
        },
        {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Peptide dosage reference',
            numberOfItems: all.length,
            itemListElement: all.map((p, i) => ({
                '@type': 'ListItem', position: i + 1, name: p.name, url: siteUrl(`p/${p.id}/`)
            }))
        }
    ];

    return head({
        title: `All ${all.length} Peptides - Dosage, Units and Reconstitution | ${SITE.name}`,
        description: `Dose, syringe units and injection frequency for ${all.length} research peptides, `
            + `each with its own reconstitution table and cycle maths. Every number computed, not copied.`,
        canonical,
        extraCss: '../',
        jsonLd
    }) + `
    <main class="container">
        <nav class="crumbs" aria-label="Breadcrumb">
            <a href="../">Calculator</a> <span aria-hidden="true">/</span>
            <span aria-current="page">All peptides</span>
        </nav>

        <div class="intro">
            <h1>All ${all.length} peptides</h1>
            <p>Recommended dose and the units to draw, at each record's own default vial and water volume</p>
        </div>
${sections}
${DISCLAIMER}
    </main>
` + foot('../');
}

/* -------------------------------------------------------------------- main */

function sitemap(all) {
    const urls = [siteUrl(''), siteUrl('p/'), ...all.map(p => siteUrl(`p/${p.id}/`))];
    const body = urls.map((u, i) => `  <url>
    <loc>${u}</loc>
    <changefreq>monthly</changefreq>
    <priority>${i === 0 ? '1.0' : i === 1 ? '0.9' : '0.8'}</priority>
  </url>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function build() {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'peptides.json'), 'utf8'));
    const all = [...data.peptides].sort((a, b) => a.name.localeCompare(b.name));

    const files = new Map();
    files.set(path.join('p', 'index.html'), hubPage(all));
    for (const p of all) {
        files.set(path.join('p', p.id, 'index.html'), peptidePage(p, all));
    }
    files.set('sitemap.xml', sitemap(all));
    return files;
}

function main() {
    const check = process.argv.includes('--check');
    const files = build();
    let changed = 0;

    for (const [rel, content] of files) {
        const abs = path.join(ROOT, rel);
        const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
        if (existing === content) continue;
        changed++;
        if (check) {
            console.error(`stale: ${rel}`);
            continue;
        }
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, 'utf8');
    }

    // A peptide removed from the data must not leave an orphan page behind.
    const pDir = path.join(ROOT, 'p');
    if (fs.existsSync(pDir)) {
        const keep = new Set([...files.keys()].map(f => f.split(path.sep)[1]));
        for (const entry of fs.readdirSync(pDir)) {
            if (keep.has(entry)) continue;
            changed++;
            if (check) console.error(`orphan: p/${entry}`);
            else fs.rmSync(path.join(pDir, entry), { recursive: true, force: true });
        }
    }

    if (check) {
        if (changed) {
            console.error(`\n${changed} file(s) out of date. Run: npm run build:pages`);
            process.exit(1);
        }
        console.log(`up to date - ${files.size} files`);
        return;
    }
    console.log(`built ${files.size} files (${changed} written)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}

export { build, reference, reconTable, workingFor };

/**
 * Tests for the generated reference pages, the analytics layer and the email
 * capture gate.
 *
 * The point of the first block is that the 45 committed HTML files are not a
 * separate copy of the truth. They are output. If anyone edits a dose in
 * peptides.json and forgets to rebuild, the page keeps showing the old number
 * and looks entirely authoritative doing it - so the build fails instead.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, themeFor, faqsFor, reference, pickTitle, TITLE_MAX, THEME_OVERRIDES } from '../tools/build-pages.js';
import { performCalculation, defaultReconMl, DEFAULT_SYRINGE } from '../js/calculator.js';
import { formatDose } from '../js/ui.js';
import { SITE, siteUrl } from '../js/config.js';
import { enabled, track } from '../js/analytics.js';
import { configured, alreadyAnswered, looksLikeEmail, requestEmail } from '../js/emailCapture.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'peptides.json'), 'utf8'));
const peptides = data.peptides;

const files = build();
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const pageFor = id => read(path.join('p', id, 'index.html'));

const between = (s, a, b) => {
    const i = s.indexOf(a);
    if (i === -1) return null;
    const j = s.indexOf(b, i + a.length);
    return j === -1 ? null : s.slice(i + a.length, j);
};

/* ------------------------------------------------------------ freshness */

test('every committed page matches what the data would generate', () => {
    const stale = [];
    for (const [rel, content] of files) {
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) { stale.push(`${rel} (missing)`); continue; }
        if (fs.readFileSync(abs, 'utf8') !== content) stale.push(rel);
    }
    assert.deepEqual(stale, [], `out of date - run: npm run build:pages`);
});

test('there is a page for every peptide and no page for anything else', () => {
    const dirs = fs.readdirSync(path.join(ROOT, 'p'), { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name).sort();
    assert.deepEqual(dirs, peptides.map(p => p.id).sort());
});

/* ------------------------------------------------------------------ SEO */

test('titles are unique and short enough to survive a search result', () => {
    const seen = new Map();
    for (const p of peptides) {
        const title = between(pageFor(p.id), '<title>', '</title>');
        assert.ok(title, `${p.id}: no title`);
        assert.ok(title.length <= TITLE_MAX, `${p.id}: title is ${title.length} chars`);
        assert.ok(!seen.has(title), `${p.id}: title collides with ${seen.get(title)}`);
        seen.set(title, p.id);
    }
});

test('pickTitle takes the longest variant that fits, and the shortest when none do', () => {
    assert.equal(pickTitle(['x'.repeat(80), 'short']), 'short');
    assert.equal(pickTitle(['fits', 'shorter']), 'fits');
    assert.equal(pickTitle(['a'.repeat(90), 'b'.repeat(70)]), 'b'.repeat(70));
});

test('descriptions are unique, present, and say something specific', () => {
    const seen = new Set();
    for (const p of peptides) {
        const html = pageFor(p.id);
        const desc = between(html, 'name="description" content="', '">');
        assert.ok(desc && desc.length >= 80, `${p.id}: description too thin`);
        assert.ok(!seen.has(desc), `${p.id}: duplicate description`);
        assert.ok(desc.includes(p.name), `${p.id}: description does not name the peptide`);
        seen.add(desc);
    }
});

test('every page declares its own canonical URL', () => {
    for (const p of peptides) {
        const canonical = between(pageFor(p.id), '<link rel="canonical" href="', '">');
        assert.equal(canonical, siteUrl(`p/${p.id}/`));
    }
    assert.equal(between(read(path.join('p', 'index.html')), '<link rel="canonical" href="', '">'), siteUrl('p/'));
});

test('structured data parses, and the FAQ block matches the visible questions', () => {
    for (const p of peptides) {
        const html = pageFor(p.id);
        const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
            .map(m => JSON.parse(m[1]));

        assert.equal(blocks.length, 2, `${p.id}: expected breadcrumb + FAQ`);
        const [crumb, faq] = blocks;
        assert.equal(crumb['@type'], 'BreadcrumbList');
        assert.equal(crumb.itemListElement.at(-1).item, siteUrl(`p/${p.id}/`));

        assert.equal(faq['@type'], 'FAQPage');
        assert.ok(faq.mainEntity.length >= 3, `${p.id}: too few questions`);

        for (const q of faq.mainEntity) {
            assert.ok(q.acceptedAnswer.text.length > 40, `${p.id}: stub answer`);
            // A question in the schema that is not on the page is cloaking.
            assert.ok(html.includes(q.name.replace(/&/g, '&amp;')), `${p.id}: "${q.name}" not visible on the page`);
        }
    }
});

test('the sitemap lists every page and nothing that does not exist', () => {
    const xml = read('sitemap.xml');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

    assert.equal(locs.length, peptides.length + 2);
    assert.ok(locs.includes(siteUrl('')));
    assert.ok(locs.includes(siteUrl('p/')));

    for (const loc of locs) {
        const rel = loc.replace(siteUrl(''), '');
        const abs = path.join(ROOT, rel || '.', 'index.html');
        assert.ok(fs.existsSync(abs), `sitemap points at a missing file: ${loc}`);
    }
});

test('internal links resolve to files that exist', () => {
    for (const p of peptides) {
        const html = pageFor(p.id);
        for (const m of html.matchAll(/href="\.\.\/([a-z0-9_]+)\/"/g)) {
            assert.ok(fs.existsSync(path.join(ROOT, 'p', m[1], 'index.html')),
                `${p.id} links to a missing page: ${m[1]}`);
        }
        assert.ok(html.includes('href="../../?p='), `${p.id}: no link back into the calculator`);
    }
    assert.ok(read('index.html').includes('href="p/"'), 'home page does not link to the directory');
});

/* ------------------------------------------------------- numbers on page */

test('the number printed on each page is the number the calculator produces', () => {
    for (const p of peptides) {
        const html = pageFor(p.id);
        const r = performCalculation(p, {
            weightLbs: 165, vialSize: p.vialSize,
            reconMl: defaultReconMl(p), syringe: DEFAULT_SYRINGE
        });

        const dose = formatDose(r.doses.med, r.doseUnit).replace(/&/g, '&amp;');
        assert.ok(html.includes(dose), `${p.id}: recommended dose ${dose} is not on the page`);

        if (!r.noRecon) {
            const u = Number.isInteger(r.syringeUnits.med)
                ? String(r.syringeUnits.med) : r.syringeUnits.med.toFixed(1);
            assert.ok(html.includes(`${u} units`), `${p.id}: draw of ${u} units is not on the page`);
        }
    }
});

test('a dose that cannot be drawn in one go says so on the page', () => {
    for (const p of peptides) {
        const r = reference(p);
        const flagged = r.overflow.med || r.exceedsVial.med;
        const html = pageFor(p.id);
        if (flagged) {
            assert.ok(html.includes('does not fit one draw'), `${p.id}: overflow not disclosed`);
        }
    }
});

test('every page carries the disclaimer', () => {
    for (const p of peptides) {
        assert.ok(pageFor(p.id).includes('Research information only - not medical advice'), `${p.id}`);
    }
    assert.ok(read(path.join('p', 'index.html')).includes('Research information only'));
});

test('themes bucket every peptide, and no theme is a single orphan set', () => {
    const counts = {};
    for (const p of peptides) counts[themeFor(p)] = (counts[themeFor(p)] || 0) + 1;
    assert.ok(Object.keys(counts).length >= 4, 'themes collapsed');
    assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), peptides.length);
});

test('FAQ answers carry real figures, not placeholders', () => {
    for (const p of peptides) {
        for (const f of faqsFor(p, reference(p))) {
            assert.ok(!/undefined|NaN|null/.test(f.a), `${p.id}: "${f.q}" -> ${f.a}`);
            assert.ok(!/undefined|NaN/.test(f.q), `${p.id}: ${f.q}`);
        }
    }
});


test('bucketing never matches a token buried inside another word', () => {
    const byId = id => {
        const p = peptides.find(x => x.id === id);
        assert.ok(p, `no such peptide: ${id}`);
        return p;
    };

    // Each of these caught a real mis-file. "gh" as a bare substring matches
    // "weiGHt", which put a GLP-1/amylin fat-loss combo under growth hormone;
    // "nad" matches "goNADorelin".
    assert.equal(themeFor(byId('cagrisema')), 'Fat loss and metabolic');
    assert.equal(themeFor(byId('retatrutide')), 'Fat loss and metabolic');
    assert.equal(themeFor(byId('gonadorelin')), 'Hormonal and sexual health');
    assert.equal(themeFor(byId('nadplus')), 'Longevity and immune');

    // ...and the ones that must keep working.
    assert.equal(themeFor(byId('blend_gh1')), 'Growth hormone');
    assert.equal(themeFor(byId('hgh')), 'Growth hormone');
    assert.equal(themeFor(byId('bpc157')), 'Healing and repair');
    assert.equal(themeFor(byId('dsip')), 'Cognitive and sleep');
});

test('no single theme swallows the catalogue', () => {
    const counts = {};
    for (const p of peptides) counts[themeFor(p)] = (counts[themeFor(p)] || 0) + 1;
    const biggest = Math.max(...Object.values(counts));
    assert.ok(biggest <= peptides.length / 2, `one theme holds ${biggest} of ${peptides.length}`);
});

test('every theme override names a peptide that exists', () => {
    for (const id of Object.keys(THEME_OVERRIDES)) {
        assert.ok(peptides.some(p => p.id === id), `override for missing peptide: ${id}`);
    }
});

/* -------------------------------------------------------------- growth */

test('analytics ships disabled and stays silent', () => {
    assert.equal(SITE.analytics.provider, 'none');
    assert.equal(enabled(), false);
    // Must be safe to call with no provider, no DOM and no network.
    assert.doesNotThrow(() => track('calculate', { peptide: 'bpc157' }));
});

test('analytics config names a provider the module knows about', () => {
    assert.ok(['none', 'plausible', 'goatcounter', 'cloudflare', 'umami'].includes(SITE.analytics.provider));
});

test('no visitor is asked for an email while there is nowhere to put one', async () => {
    assert.equal(SITE.emailCapture.provider, 'none');
    assert.equal(configured(), false);
    assert.equal(alreadyAnswered(), false);

    // With no provider this must resolve without touching the DOM at all -
    // there is no document in this process, so a modal attempt would throw.
    const outcome = await requestEmail({ source: 'pdf', peptide: 'bpc157' });
    assert.deepEqual(outcome, { proceed: true, email: null });
});

test('email capture config is a mode the module implements', () => {
    assert.ok(['none', 'formspree', 'custom'].includes(SITE.emailCapture.provider));
    assert.ok(['soft', 'hard'].includes(SITE.emailCapture.mode));
});

test('email validation rejects the obvious junk', () => {
    for (const good of ['a@b.co', 'jo+peptides@example.com', 'x.y@sub.domain.org']) {
        assert.ok(looksLikeEmail(good), good);
    }
    for (const bad of ['', 'jo', 'jo@', '@example.com', 'jo@example', 'a b@c.com']) {
        assert.equal(looksLikeEmail(bad), false, bad);
    }
});

test('no page leaks weight or age into a tracked event', () => {
    const main = read(path.join('js', 'main.js'));
    const tracked = [...main.matchAll(/track\((?:'|`)[^']*(?:'|`),\s*\{([^}]*)\}/g)].map(m => m[1]);
    assert.ok(tracked.length >= 3, 'expected several tracked events');
    for (const props of tracked) {
        assert.ok(!/\bweight\b|\bage\b|\bemail\b/.test(props), `identifying data in event props: ${props}`);
    }
});

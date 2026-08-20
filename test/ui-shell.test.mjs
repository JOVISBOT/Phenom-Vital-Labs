/**
 * Guards for the pieces of the shell that live in two places at once.
 *
 * Every failure modelled here is a drift failure: two copies of the same fact
 * that agreed on the day they were written and have no reason to keep agreeing.
 * The theme boot script is inlined into 46 HTML files from a string in
 * js/theme.js; the storage key it reads is written by the toggle; the tier
 * labels on a generated page come from the same record the calculator reads.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { THEME_BOOT, STORAGE_KEY } from '../js/theme.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const peptides = JSON.parse(read('data/peptides.json')).peptides;

const pageFiles = [
    'index.html',
    'p/index.html',
    ...readdirSync(join(ROOT, 'p'), { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => `p/${d.name}/index.html`)
].filter(f => existsSync(join(ROOT, f)));

test('the theme boot script is inlined everywhere, and is the one theme.js exports', () => {
    // index.html has it hand-written; the 45 generated pages get it from
    // THEME_BOOT. If those two ever say different things, a visitor who chose
    // dark sees it hold on one page and flash white on the next.
    assert.ok(pageFiles.length >= 46, `only found ${pageFiles.length} pages`);
    for (const f of pageFiles) {
        assert.ok(read(f).includes(THEME_BOOT), `${f} does not carry the exported theme boot script`);
    }
});

test('the boot script reads the same storage key the toggle writes', () => {
    assert.ok(THEME_BOOT.includes(`'${STORAGE_KEY}'`),
        `boot script does not read ${STORAGE_KEY}; it would ignore the stored preference`);
    assert.ok(THEME_BOOT.includes('prefers-color-scheme'),
        'boot script does not fall back to the OS preference');
    // It must set the attribute the stylesheet actually keys off.
    assert.ok(THEME_BOOT.includes('data-theme'), 'boot script does not set data-theme');
    assert.ok(read('css/theme.css').includes('[data-theme="dark"]'),
        'theme.css does not style [data-theme="dark"]');
});

test('every page loads the theme stylesheet and carries a toggle', () => {
    for (const f of pageFiles) {
        const html = read(f);
        assert.match(html, /css\/theme\.css/, `${f} does not load theme.css`);
        assert.match(html, /class="theme-toggle"/, `${f} has no theme toggle`);
    }
});

test('the cache-busting version is the same across css, js and data', () => {
    // These had already drifted once -- styles at v=19 while the script said
    // v=27 -- which let a data change ship to browsers still holding old JSON.
    const index = read('index.html');
    const versions = new Set([...index.matchAll(/\?v=(\d+)/g)].map(m => m[1]));
    assert.equal(versions.size, 1, `index.html references more than one asset version: ${[...versions]}`);

    const dataVersion = read('js/dataLoader.js').match(/DATA_VERSION\s*=\s*(\d+)/)[1];
    assert.equal(dataVersion, [...versions][0],
        'DATA_VERSION does not match the ?v= on the tags in index.html');

    const assetV = read('tools/build-pages.js').match(/ASSET_V\s*=\s*(\d+)/)[1];
    assert.equal(assetV, [...versions][0], 'build-pages ASSET_V has drifted from index.html');
});

test('a tier set that is not a ladder is not labelled like one', () => {
    // tesamorelin's low/med/high are three formulations' labelled daily doses.
    // Its own instructions said "not an escalating ladder" while the cards
    // above them read Conservative -> Advanced, "Best for first-time users" ->
    // "For experienced users".
    const variants = peptides.filter(p => p.tiersAreVariants);
    assert.ok(variants.length >= 1, 'no record is flagged tiersAreVariants');

    for (const p of variants) {
        assert.ok(p.tierNote && p.tierNote.length > 40, `${p.id} is flagged as variants but explains nothing`);
        assert.ok(p.tierLabels && p.tierLabels.low && p.tierLabels.med && p.tierLabels.high,
            `${p.id} has no per-tier labels to replace the ladder wording`);

        const html = read(`p/${p.id}/index.html`);
        for (const bad of ['Conservative', 'Advanced']) {
            assert.ok(!html.includes(`<th scope="row">${bad}</th>`),
                `p/${p.id}/ still labels a tier "${bad}"`);
        }
        for (const key of ['low', 'med', 'high']) {
            assert.ok(html.includes(p.tierLabels[key]), `p/${p.id}/ does not use the ${key} variant label`);
        }
    }

    // And a record whose instructions say the tiers are not a ladder must be
    // flagged, so the next one added does not slip through unlabelled.
    for (const p of peptides) {
        const saysSo = /not an escalating ladder|not a ladder|not an escalation/i.test((p.inst || []).join(' '));
        if (saysSo) assert.equal(p.tiersAreVariants, true,
            `${p.id} tells the reader its tiers are not a ladder but is not flagged tiersAreVariants`);
    }
});

test('the searchable picker keeps the select as the source of truth', () => {
    const combo = read('js/combobox.js');
    // The whole design rests on this: main.js, restoreFromUrl and every test
    // read select.value, so the enhancement must write there and announce it.
    assert.match(combo, /select\.value = o\.value/, 'combobox does not write back to the select');
    assert.match(combo, /dispatchEvent\(new Event\('change'/, 'combobox does not fire the change everything listens for');
    // display:none would make the select unfocusable and break error handling
    // that points the user at it.
    assert.ok(!/display:\s*['"]none/.test(combo), 'combobox hides the select with display:none');
    assert.match(combo, /clipPath/, 'combobox does not visually hide the select the accessible way');

    // A thrown enhancement must leave a working native dropdown behind.
    assert.match(read('js/main.js'), /catch \(e\) \{[\s\S]*?falling back to the plain dropdown/,
        'main.js does not guard the picker enhancement');
});

test('a restored protocol names its own peptide in the picker', () => {
    // restoreFromUrl assigns select.value directly, and assignment fires no
    // change event -- so the search box in front of the select never heard it.
    // A shared link drew a full BPC-157 protocol under a peptide box still
    // reading "Search 44 peptides...", and the CTA on all 44 static pages
    // lands on exactly that path. Verified in Chromium before the fix.
    const main = read('js/main.js');
    const fn = main.slice(main.indexOf('function restoreFromUrl'));
    const body = fn.slice(0, fn.indexOf(String.fromCharCode(10) + 'function '));

    const assign = body.indexOf("$('peptide').value = id");
    assert.ok(assign !== -1, 'restoreFromUrl no longer assigns the peptide select');
    const refresh = body.indexOf('peptideCombo.refresh()');
    assert.ok(refresh !== -1, 'restoreFromUrl does not re-sync the search box after setting the select');
    assert.ok(refresh > assign, 'the search box is re-synced before the value it should be reading');

    // The API it calls has to exist and has to read from the select.
    const combo = read('js/combobox.js');
    assert.match(combo, /return \{ refresh \}/, 'combobox no longer exposes refresh()');
    assert.match(combo, /function refresh\(\)[\s\S]{0,200}options\.find\(o => o\.value === select\.value\)/,
        'refresh() does not read the visible text back off the select');
});

test('renderResults does not move the viewport on its own', () => {
    // It used to scrollIntoView on every render, including the re-render caused
    // by nudging the water volume -- pulling the page away from someone
    // standing on that control watching the number change.
    const ui = read('js/ui.js');
    assert.ok(!/container\.scrollIntoView/.test(ui),
        'ui.js scrolls on render again; navigation belongs to the caller');
    assert.match(read('js/main.js'), /if \(scrollToAnswer\)/, 'main.js no longer owns the scroll decision');
});

test('switching peptide cannot leave the previous result on screen', () => {
    // The dropdown read Tirzepatide while the card below still read
    // "BPC 157 - 500 mcg". On a dosing site that is a wrong number under a
    // right label.
    const main = read('js/main.js');
    const handler = main.slice(main.indexOf("$('peptide').addEventListener('change'"));
    const body = handler.slice(0, handler.indexOf('\n        });'));
    assert.match(body, /handleCalculate/, 'peptide change does not re-run the calculation');
    assert.match(body, /clearResults/, 'peptide change does not clear a result when the selection is emptied');
});

test('the answer is rendered before anything a visitor has to scroll past', () => {
    const ui = read('js/ui.js');
    const results = ui.slice(ui.indexOf('<div class="results" style="display: block;">'));
    const hero = results.indexOf('${heroHtml}');
    const tiers = results.indexOf('<div class="dose-grid">');
    const calc = results.indexOf('class="calc-box');
    assert.ok(hero > -1, 'the answer hero is not rendered');
    assert.ok(hero < tiers && hero < calc, 'the answer hero is not above the tier cards and the working');
    assert.match(ui, /id="answer"/, 'the hero has no scroll target');
});

test('warnings never fold away', () => {
    // Research, mechanism, clinical notes and dosing prose collapse on a phone.
    // The warnings panel is the one thing a visitor must not have to open.
    const ui = read('js/ui.js');
    const at = ui.indexOf('pc-card warnings');
    assert.ok(at > -1, 'the warnings panel is not rendered at all');

    // Count opens against closes rather than peeking at the next N characters:
    // a fixed window just reads into whatever block happens to come after, and
    // the first version of this test failed on the research fold below.
    const before = ui.slice(0, at);
    const open = (before.match(/<details/g) || []).length;
    const close = (before.match(/<\/details>/g) || []).length;
    assert.equal(open, close, 'the warnings panel sits inside an unclosed <details>');

    assert.match(ui, /<details class="fold/, 'nothing folds, so the phone page is still one long scroll');
});

test('print is light whatever theme the screen was in', () => {
    // Printing from dark mode produced a near-black hero with `color: #000`
    // forced on top of it -- black on black -- and asked the printer for a
    // full-bleed dark background on every panel.
    const css = readFileSync(join(ROOT, 'css/theme.css'), 'utf8');
    const at = css.indexOf('@media print');
    assert.ok(at > -1, 'there is no print stylesheet');
    const block = css.slice(at);

    assert.match(block, /:root\[data-theme="dark"\]\s*\{[^}]*--bg:\s*#fff/,
        'the print block does not reset the dark palette');
    assert.match(block, /--card:\s*#fff/, 'cards would still print dark');
    assert.match(block, /--text:\s*#111/, 'text would still print as a light-on-dark colour');
    assert.match(block, /body\s*\{[^}]*background:\s*#fff\s*!important/,
        'the page body would still print with a dark background');
});

test('the answer survives a medium that cannot animate', () => {
    // .animate-in starts at opacity:0. Anything that suppresses CSS animation
    // -- printing, save-to-PDF, reduced motion -- renders it blank unless
    // explicitly overridden, which is how a full-page capture once came out
    // half empty.
    const styles = readFileSync(join(ROOT, 'css/styles.css'), 'utf8');
    assert.match(styles, /@media print\{\.animate-in\{opacity:1!important/, 'printing would blank the animated blocks');
    assert.match(styles, /prefers-reduced-motion:reduce\)\{[\s\S]*?\.animate-in\{opacity:1\}/,
        'reduced motion would blank the animated blocks');

    // And the cascade must stay short enough that a capture taken a moment
    // after render is not caught mid-flight.
    const delays = [...readFileSync(join(ROOT, 'js/ui.js'), 'utf8')
        .matchAll(/animation-delay: ([\d.]+)s/g)].map(m => Number(m[1]));
    assert.ok(delays.length > 0, 'no staggered blocks found');
    assert.ok(Math.max(...delays) <= 0.5,
        `the reveal cascade runs ${Math.max(...delays)}s; everything below the fold is invisible that long`);
});

test('no stylesheet hardcodes a light panel colour behind themed text', () => {
    // When dark mode arrived, six rules in pages.css still held a literal
    // #f8fafc / #eff6ff / #f5f3ff while the text on them was var(--text),
    // which had gone light. "Protocol at a glance", the working box, the
    // featured tier row and the open FAQ answer all rendered near-white on
    // near-white. Panel backgrounds are tokens; only theme.css defines the
    // literals the tokens resolve to.
    const pages = readFileSync(join(ROOT, 'css/pages.css'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '');
    const literals = pages.match(/background:\s*#[0-9a-f]{3,8}/gi) || [];
    assert.deepEqual(literals, [],
        `pages.css sets a literal background: ${literals.join(', ')}`);
});

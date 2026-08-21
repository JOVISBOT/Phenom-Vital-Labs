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
    'plan/index.html',
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

    // The generator no longer keeps its own copy of the number to drift from -
    // it imports the one dataLoader exports. Hardcode a literal here again and
    // this fails, because a literal is the whole failure mode.
    const gen = read('tools/build-pages.js');
    assert.ok(/const ASSET_V = DATA_VERSION;/.test(gen),
        'build-pages ASSET_V is a literal again; derive it from DATA_VERSION');
    assert.ok(/import \{[^}]*DATA_VERSION[^}]*\} from '\.\.\/js\/dataLoader\.js'/.test(gen),
        'build-pages does not import DATA_VERSION');
    assert.ok(/export const DATA_VERSION/.test(read('js/dataLoader.js')),
        'DATA_VERSION is no longer exported, so the generator cannot share it');

    // And every generated page carries that same stamp, not just index.html.
    for (const f of ['plan/index.html', 'p/index.html']) {
        const v = new Set([...read(f).matchAll(/\?v=(\d+)/g)].map(m => m[1]));
        assert.deepEqual([...v], [dataVersion], `${f} is stamped ${[...v]}, not ${dataVersion}`);
    }
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

    // The cards were fixed and the row of three doses above them was not: it
    // still drew low -> med -> high arrows directly over a note reading "not a
    // low-to-high ladder". Same contradiction, one element higher up.
    const ui = read('js/ui.js');
    assert.match(ui, /const rung = variants \? '&middot;' : '&rarr;'/,
        'the dose row draws the same separator whether or not the tiers escalate');
    assert.ok(!/dose-arrow" aria-hidden="true">&rarr;</.test(ui),
        'the dose row hardcodes an escalation arrow again');

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

test('nothing centred on a tier card shares its top border with something else', () => {
    // At phone width the tier cards stay three across (comparing them is the
    // point), which leaves each card 114px wide. Both .dose-label and
    // .recommended-badge were centred on the same 8px of top border, so the
    // green Recommended pill sat behind the STANDARD label and poked out
    // either side. Measured in Chromium: label 159-231, badge 152-238.
    const theme = read('css/theme.css');
    const block = theme.slice(theme.indexOf('/* --- tier cards'));
    const NL = String.fromCharCode(10);
    const mobile = block.slice(0, block.indexOf('}' + NL + NL));
    assert.ok(/\.dose-label\s*\{[^}]*left:\s*50%/.test(mobile), 'the tier label is no longer centred - re-check this guard');
    assert.ok(/\.recommended-badge\s*\{[^}]*display:\s*none/.test(mobile),
        'the Recommended badge is drawn on a phone-width card again, on top of the tier label');
});

test('the dose ladder cannot strand a dose below its own arrow', () => {
    // 3 pills + 2 decorative arrows in a wrapping flex row: at 390px the pair
    // "0.4 mg -> 0.6 mg" broke across the wrap, leaving an arrow pointing at
    // the end of one line and the last dose alone on the next.
    const css = read('css/styles.css');
    const narrow = css.split('@media').find(m => /^\(max-width:5[0-9]{2}px\)/.test(m.trim()) && m.includes('.dose-range'));
    assert.ok(narrow, 'no narrow-width rule for the dose ladder');
    assert.match(narrow, /\.dose-range\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/,
        'the ladder is not laid out as three fixed columns at phone width');
    assert.match(narrow, /\.dose-arrow\s*\{\s*display:\s*none/,
        'the arrows are still drawn at a width where the row can wrap');
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
    for (const sheet of ['css/pages.css', 'css/plan.css']) {
        const css = readFileSync(join(ROOT, sheet), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        const literals = css.match(/background(-color)?:\s*#[0-9a-f]{3,8}/gi) || [];
        assert.deepEqual(literals, [], `${sheet} sets a literal background: ${literals.join(', ')}`);
    }
});

test('a theme override never resets a control that paints its own background-image', () => {
    // The dark theme set `background: var(--tint-neutral)` on <select>. The
    // shorthand resets background-repeat to `repeat` and background-position to
    // `0 0`, and styles.css draws the dropdown chevron with background-image
    // plus no-repeat plus a right-edge position. Result: a 14px arrow tiled
    // across the whole control and buried the option text -- invisible to every
    // test, visible in the first dark-mode screenshot. Use background-color.
    const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
    const styles = strip(readFileSync(join(ROOT, 'css/styles.css'), 'utf8'));
    const theme = strip(readFileSync(join(ROOT, 'css/theme.css'), 'utf8'));

    // Selectors that own a background-image in the base sheet.
    const painted = new Set();
    for (const [, sel, body] of styles.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        if (/background-image\s*:/.test(body)) {
            sel.split(',').forEach(s => painted.add(s.trim().split(/[\s:]/)[0]));
        }
    }
    assert.ok(painted.size > 0, 'no background-image rules found - the scan is broken');

    const offenders = [];
    for (const [, sel, body] of theme.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        if (!/(^|;)\s*background\s*:/.test(body)) continue;
        for (const one of sel.split(',')) {
            const base = one.trim().split(/\s+/).pop().split(/[:[]/)[0];
            if (painted.has(base)) offenders.push(one.trim());
        }
    }
    assert.deepEqual(offenders, [],
        `these override a painted control with the background shorthand: ${offenders.join(', ')}`);

    // The same reset, from the base sheet against itself -- which the scan above
    // cannot see, because it only ever reads theme.css for offenders.
    // `select:disabled{background:#f3f4f6}` sat four lines under the rule that
    // paints the chevron. In light mode the shorthand also cleared the image, so
    // nothing showed; in dark mode theme.css re-declares the image at higher
    // specificity while repeat and position stay reset, and the arrow tiled
    // across the disabled Vial Size control, printing over "Select a peptide
    // first". A rule that shorthands a painted control must say what happens to
    // the image -- `none`, or the url again. Silence is the bug.
    const unsaid = [];
    for (const sheet of ['css/styles.css', 'css/theme.css']) {
        const css = strip(readFileSync(join(ROOT, sheet), 'utf8'));
        for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
            if (!/(^|;)\s*background\s*:/.test(body)) continue;
            if (/background-image\s*:/.test(body)) continue;
            for (const one of sel.split(',')) {
                const base = one.trim().split(/\s+/).pop().split(/[:[]/)[0];
                if (painted.has(base)) unsaid.push(`${sheet} ${one.trim()}`);
            }
        }
    }
    assert.deepEqual(unsaid, [],
        `these shorthand a painted control without restating background-image: ${unsaid.join(', ')}`);
});

test('the planner labels a blend dose as combined, from one place', () => {
    // A blend's vialSize is both peptides, so the planner's dose box means the
    // combined figure while the person filling it thinks per peptide. The label
    // is the only thing that closes that gap, and it has to move with the
    // peptide -- so the unit and the meaning are set together, in one function.
    // Two call sites set that box (fresh pick, and restoring a saved plan); a
    // third added later that only sets the unit would silently reopen the bug.
    const plan = read('js/plan.js');
    const html = read('plan/index.html');

    assert.ok(/id="doseHint"/.test(html), 'plan/index.html has no dose hint element');
    assert.ok(/aria-describedby="doseHint"/.test(html), 'the dose input does not point at its hint');

    const unitWrites = plan.match(/\$\('doseUnit'\)\.textContent\s*=/g) || [];
    assert.equal(unitWrites.length, 1,
        `doseUnit is written in ${unitWrites.length} places; it belongs only in setDoseContext`);
    assert.ok(/function setDoseContext/.test(plan), 'setDoseContext is gone');
    assert.equal((plan.match(/setDoseContext\(/g) || []).length, 3,
        'setDoseContext should be declared once and called from both places that fill the dose box');
    assert.ok(/blendSplit\(peptide, doseAmount\)/.test(plan),
        'the mixing card no longer prints the per-component split');
});

test('every way the vial card can know its position is labelled on the page', () => {
    // The card prints one number - doses used - that can come from a measured
    // volume, a typed count, or an elapsed-time guess. They are not equally
    // true, and the measured one is the only one that survives a dose change
    // mid-vial. A source the planner can return but the page has no wording
    // for renders as a bare figure with no provenance, which reads as fact.
    const plan = read('js/plan.js');
    const planner = read('js/planner.js');
    const html = read('plan/index.html');

    assert.ok(/id="mlLeft"/.test(html), 'plan/index.html has no millilitres-left input');

    const sources = new Set(
        (planner.match(/source\s*=\s*measured\s*\?\s*'(\w+)'\s*:\s*logged\s*\?\s*'(\w+)'\s*:\s*'(\w+)'/) || [])
            .slice(1)
    );
    assert.equal(sources.size, 3, 'the planner no longer names three sources in one expression');

    for (const s of sources) {
        assert.ok(new RegExp(`\\b${s}:`).test(plan), `SOURCE_TAG has no entry for "${s}"`);
        assert.ok(new RegExp(`'${s}'`).test(plan), `sourceNote never branches on "${s}"`);
    }
    assert.ok(/function sourceNote/.test(plan), 'sourceNote is gone');
});

test('no source file carries an invisible control character', () => {
    // A scripted edit wrote a raw 0x08 into a regex in this very file. It is
    // invisible in a terminal, in a diff, and in an editor - the regex simply
    // stopped matching and the failure message pointed at the wrong file. Any
    // control byte outside tab/newline/carriage-return is a writing accident,
    // never intent.
    const files = [
        ...readdirSync(join(ROOT, 'js')).map(f => `js/${f}`),
        ...readdirSync(join(ROOT, 'css')).map(f => `css/${f}`),
        ...readdirSync(join(ROOT, 'test')).map(f => `test/${f}`),
        ...readdirSync(join(ROOT, 'tools')).map(f => `tools/${f}`),
        ...pageFiles
    ].filter(f => /\.(js|mjs|css|html|json)$/.test(f));

    assert.ok(files.length > 50, `only checked ${files.length} files`);
    for (const f of files) {
        const bad = [...read(f)].findIndex(ch => {
            const c = ch.charCodeAt(0);
            return c < 32 && c !== 9 && c !== 10 && c !== 13;
        });
        assert.equal(bad, -1,
            `${f} holds a control character (0x${bad < 0 ? '' : read(f).charCodeAt(bad).toString(16)}) at offset ${bad}`);
    }
});


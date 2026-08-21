/**
 * Guards for the 2026-08-20 UI pass.
 *
 * Each of these is a defect that was actually on the page, written as the
 * cheapest thing that would have caught it. Two of them are the same class as
 * the calculator's original bugs: something rendered in two places drifting
 * apart, and something whose loudness on screen did not match its consequence.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

/** Anything in the pictographic planes. Deliberately not the check and warning
 *  signs in the BMP - those carry meaning and are supposed to stay. */
const PICTOGRAPH = /[\u{1F000}-\u{1FAFF}]/u;

test('no form label wears an emoji', () => {
    // Emoji are a font, not a graphic: the same character is a flat glyph on one
    // machine, a glossy sticker on another, and a hollow box where no emoji font
    // is installed. Six of them sat inside gradient tiles, so the tile was
    // consistent and the thing inside it was not.
    for (const file of ['index.html', 'plan/index.html']) {
        const html = read(file);
        const icons = [...html.matchAll(/<span class="label-icon"[^>]*>([\s\S]*?)<\/span>/g)];
        assert.ok(icons.length >= 4, `${file} has no label icons at all`);
        for (const [, body] of icons) {
            assert.ok(body.includes('<svg'), `${file} has a label icon that is not an svg`);
            assert.ok(!PICTOGRAPH.test(body), `${file} has an emoji back in a label icon`);
        }
    }
});

test('every field on the planner is labelled the same way', () => {
    // The planner iconed two of its three field groups and left "the dates"
    // bare, which is the kind of inconsistency you see from across the room.
    const html = read('plan/index.html');
    const labels = [...html.matchAll(/<label for="([^"]+)">([\s\S]*?)<\/label>/g)];
    assert.ok(labels.length >= 12, `expected the planner's full field set, found ${labels.length}`);
    const bare = labels.filter(m => !m[2].includes('label-icon')).map(m => m[1]);
    assert.deepEqual(bare, [], `planner fields with no icon: ${bare.join(', ')}`);
});

test('a result renders exactly one set of PDF buttons', () => {
    // There were two identical Preview/Download bars on one result. Whichever a
    // visitor found, the other was dead weight on a page already several
    // screens long. main.js still binds both id sets, so a re-added bar would
    // work - and go unnoticed.
    const ui = read('js/ui.js');
    assert.equal((ui.match(/class="pdf-buttons/g) || []).length, 1,
        'more than one pdf-buttons block is rendered into a result');
});

test('the answer bar is inert until there is an answer', () => {
    // A bar advertising a dose has to be empty when there is no dose, and gone
    // when the result it mirrors is cleared.
    const html = read('index.html');
    const dock = html.match(/<div class="answer-dock"[^>]*>/);
    assert.ok(dock, 'index.html no longer ships the answer dock');
    assert.ok(dock[0].includes('hidden'), 'the answer dock ships visible');

    const main = read('js/main.js');
    assert.ok(/function clearResults\(\)[\s\S]{0,400}hideAnswerDock\(\)/.test(main),
        'clearResults leaves the dock on screen advertising a result that is gone');
    // A pre-filled pen has no draw, so there is no number for the bar to carry.
    assert.ok(/results\.noRecon\s*\)\s*\{\s*hideAnswerDock/.test(main),
        'the dock does not stand down for a record with no draw');
    assert.ok(/\.answer-hero\{scroll-margin-top:/.test(read('css/styles.css')),
        'the hero has no scroll offset, so a jump to #answer lands under the fixed bar');
});

test('the directory filter is offered only where it can work', () => {
    // Progressive enhancement, on purpose: the tables are built at build time
    // and every row is a real link. The input is created by the script, so a
    // page whose script is blocked shows no search box rather than a dead one.
    const hub = read('p/index.html');
    assert.ok(!/id="hubFilter"/.test(hub), 'the filter input is hardcoded into the hub markup');
    assert.ok(/js\/hubFilter\.js/.test(hub), 'the hub does not load the filter module');

    const mod = read('js/hubFilter.js');
    assert.ok(/id="hubFilter"/.test(mod), 'the filter module no longer creates its own input');
    // Narrowing, not widening: "bpc weekly" has to mean both words.
    assert.ok(/words\.every\(/.test(mod), 'the filter ORs its words together instead of ANDing them');
});

test('the one destructive control is never the loudest one, in either theme', () => {
    // .btn-ghost also carries .btn, and the dark-theme .btn rule is more
    // specific than the light .btn-ghost rule in plan.css - so in dark mode
    // "Clear saved plan" painted itself as a filled primary button, louder than
    // Save beside it. Light mode looked fine, which is how it survived.
    const theme = read('css/theme.css');
    assert.ok(/\[data-theme="dark"\]\s*\.btn-ghost\s*\{[^}]*background:\s*transparent/.test(theme),
        'a ghost button falls back to the dark .btn gradient again');

    const plan = read('css/plan.css');
    assert.ok(/\.plan-actions\s+\.btn-ghost\s*\{[^}]*background:\s*transparent/.test(plan),
        'the light-theme ghost button is filled again');
});

test('folding weight and age away does not hide what they are set to', () => {
    // They cannot change the answer - the page says so itself - so they were
    // demoted out of the primary row. Demoted is not the same as hidden: the
    // summary has to keep reading back the current values.
    const html = read('index.html');
    assert.ok(/<details class="form-field optional-fields"/.test(html),
        'the optional fields are no longer a disclosure');
    for (const id of ['weight', 'age']) {
        assert.ok(new RegExp(`<select id="${id}">`).test(html),
            `#${id} is gone from index.html - the PDF and the protocol note still read it`);
    }
    assert.ok(/id="optionalValues"/.test(html), 'the disclosure has nowhere to echo its values');

    const main = read('js/main.js');
    assert.ok(/function syncOptionalSummary/.test(main), 'syncOptionalSummary is gone');
    assert.ok(/'weight', 'age'\]\)\s*\{[\s\S]{0,220}syncOptionalSummary\(\)/.test(main),
        'changing weight or age no longer updates the summary that reports it');
});

test('every icon the code asks for exists', () => {
    // icon() returns '' for an unknown name so a typo degrades to a bare label
    // instead of throwing mid-render - which also means a typo is silent.
    const names = new Set(
        [...read('js/icons.js').matchAll(/^ {4}([a-zA-Z]+):\s*'/gm)].map(m => m[1]));
    assert.ok(names.size >= 10, `only ${names.size} icons parsed - the map format changed`);

    for (const f of ['js/ui.js', 'js/main.js']) {
        if (!existsSync(join(ROOT, f))) continue;
        for (const m of read(f).matchAll(/\bicon\('([a-zA-Z]+)'/g)) {
            assert.ok(names.has(m[1]), `${f} asks for icon('${m[1]}'), which is not in the set`);
        }
    }
});

test('generated pages do not carry a stale asset version', () => {
    // The pass touched css and js; a page still pointing at the previous ?v=
    // would serve new markup against old styles.
    const v = read('js/dataLoader.js').match(/DATA_VERSION\s*=\s*(\d+)/)[1];
    const pages = ['p/index.html', ...readdirSync(join(ROOT, 'p'), { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => `p/${d.name}/index.html`)]
        .filter(f => existsSync(join(ROOT, f)));
    for (const f of pages) {
        const stale = [...new Set([...read(f).matchAll(/\?v=(\d+)/g)].map(m => m[1]))]
            .filter(x => x !== v);
        assert.deepEqual(stale, [], `${f} still points at ?v=${stale[0]}, current is ${v}`);
    }
});

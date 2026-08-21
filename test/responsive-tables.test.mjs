/**
 * Guards for the phone-width layout pass.
 *
 * Both defects here were live and both measured clean. The suite was green,
 * the browser drive reported zero console errors, and the page's own
 * mobileOverflowX check said false -- because it ran on the calculator, and
 * the broken pages were the directory and the 44 reference pages.
 *
 * These are static checks on the CSS and the built HTML. The geometry itself
 * is asserted in a real browser by tools/probe-widths.py, which walks four
 * pages across ten viewport widths.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

test('nothing spans a second column in the one-column form', () => {
    // `grid-column:span 2` in a grid with one explicit column does not widen
    // the item -- it CONJURES an implicit second column, and every field in
    // the form is re-flowed into auto-sized columns narrower than their own
    // contents. At 390px the labels printed through each other: "Peptide"
    // overlapping "Vial Size", "BAC Water" overlapping "Syringe".
    const css = read('css/styles.css');

    const spans = [...css.matchAll(/([^{}]*)\{([^{}]*grid-column\s*:\s*span[^{}]*)\}/g)];
    for (const [, selector, body] of spans) {
        const rule = `${selector.trim()}{${body.trim()}}`;
        const at = css.indexOf(rule.slice(0, 30));
        // Every span must sit behind a min-width query, or inside one. Walk
        // back to the nearest @media and require it to be a min-width.
        const before = css.slice(0, at);
        const lastMedia = before.lastIndexOf('@media');
        const guarded = lastMedia !== -1
            && /min-width/.test(css.slice(lastMedia, lastMedia + 40))
            && before.slice(lastMedia).split('{').length > before.slice(lastMedia).split('}').length;
        assert.ok(
            guarded,
            `${selector.trim()} sets grid-column:span outside a min-width query. `
            + 'Below 500px the form is one column and a span conjures an implicit second one.'
        );
    }
    assert.ok(spans.length > 0, 'expected at least one span rule to check');
});

test('the one-column form rule is not undone later in the file', () => {
    // The first attempt at the fix put the override INSIDE the max-width
    // query, which sits earlier in the file than the .optional-fields block.
    // Equal specificity, later wins, and nothing changed on screen.
    const css = read('css/styles.css');
    const override = css.indexOf('@media(min-width:501px){.optional-fields{grid-column:span 2}}');
    assert.notEqual(override, -1, 'expected the span to be behind a min-width query');
    const base = css.indexOf('.optional-fields{grid-column:auto');
    assert.notEqual(base, -1, 'expected the mobile-first base to be grid-column:auto');
    assert.ok(base < override, 'the min-width override must come after the base rule to win the cascade');
});

test('every stacked table cell carries the column head it lost', () => {
    // Below 560px .data-table--stack hides <thead> and re-prints each column
    // head from data-label. A <td> without one renders as a bare value with
    // nothing saying which column it came from -- "0.12 ml" under "6 units"
    // and no way to tell volume from draw.
    const dir = join(ROOT, 'p');
    const pages = readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => join('p', d.name, 'index.html'));
    pages.push(join('p', 'index.html'));

    let checked = 0;
    for (const rel of pages) {
        const html = read(rel);
        for (const [, attrs, body] of html.matchAll(/<table([^>]*)>([\s\S]*?)<\/table>/g)) {
            if (!attrs.includes('data-table--stack')) continue;
            checked++;
            for (const [cell] of body.matchAll(/<td[^>]*>/g)) {
                assert.ok(
                    cell.includes('data-label='),
                    `${rel}: <td> in a stacked table has no data-label -- ${cell}`
                );
            }
        }
    }
    assert.ok(checked >= 45, `expected every built page to carry a stacked table, saw ${checked}`);
});

test('a stacked table still says it is a table', () => {
    // display:block on a table strips its role in several screen readers, so
    // the implicit roles are restated. If the stacking class is ever added to
    // a table without them, the grid stops being navigable by row and column
    // for exactly the readers who cannot see the layout that replaced it.
    const html = read(join('p', 'index.html'));
    const table = html.match(/<table[^>]*data-table--stack[^>]*>[\s\S]*?<\/table>/)[0];
    for (const [role, min] of [['role="table"', 1], ['role="rowgroup"', 2], ['role="row"', 2],
                               ['role="columnheader"', 4], ['role="rowheader"', 1], ['role="cell"', 3]]) {
        const n = table.split(role).length - 1;
        assert.ok(n >= min, `stacked table carries ${n} ${role}, expected at least ${min}`);
    }
});

test('the stacked caption is re-typed as a block', () => {
    // A <caption> inside a display:block table is still display:table-caption,
    // so it shrink-to-fits an anonymous table box and sets one word per line:
    // "DOSE / TIERS / AT A 10 / MG VIAL" down the left margin.
    const css = read('css/pages.css');
    const rule = css.match(/\.data-table--stack caption\{([^}]*)\}/);
    assert.ok(rule, 'expected a caption rule for stacked tables');
    assert.match(rule[1], /display:block/, 'the caption must be re-typed or it sets one word per line');
});

test('the planner is not re-flowed underneath its own scroller', () => {
    // The planner solves the same problem by scrolling horizontally inside
    // .table-scroll, with a min-width on the table. Stacking those rows as
    // well would fight the scroller and strand the min-width.
    const plan = read(join('plan', 'index.html'));
    assert.ok(!plan.includes('data-table--stack'),
        'the planner tables scroll rather than stack -- they must not opt into stacking');
    assert.match(read('css/plan.css'), /\.table-scroll \.data-table\{[^}]*min-width/);
});

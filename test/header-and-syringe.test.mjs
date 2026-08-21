/**
 * Guards for the navigation pass and the rebuilt syringe graphic.
 *
 * Two classes of defect are covered here, and neither is visible to a test
 * that only asks whether the page renders.
 *
 * The first is duplication that drifts. index.html and plan/index.html have no
 * build step, so the header markup exists in three places -- those two files
 * and tools/build-pages.js. Three copies of one nav is exactly the shape that
 * ends with the planner reachable from two pages out of four.
 *
 * The second is an inverted surface that forgets to invert its contents.
 * `.info-card-icon` painted a #1F2937 glyph on a #1E3D9D chip at 1.50:1 while
 * both of its siblings set `color:#fff`. That is not visible to the text
 * contrast probe -- an SVG owns no text node -- and it is not visible in a
 * full-page screenshot either, because an 8,000px page is downscaled about 4x
 * before anyone looks at it, which is the scale at which four distinct icons
 * look like four identical squares. The live measurement is
 * tools/probe-icon-contrast.py; this file guards the declaration that probe
 * exists to check.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateSyringeSVG } from '../js/ui.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

// The three destinations, in header order. A page's own entry is the current
// one; every page must offer all three.
const DESTINATIONS = ['', 'p/', 'plan/'];

/** The hrefs inside the primary nav of one built page, root-prefix stripped. */
function navTargets(html, prefix) {
    const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/);
    assert.ok(nav, 'page has no primary nav in its header');
    return [...nav[0].matchAll(/href="([^"]*)"/g)]
        .map(m => m[1].replace(prefix, '').replace(/^\.\/$/, ''));
}

test('every page links to all three destinations from its header', () => {
    const pages = [
        ['index.html', ''],
        ['plan/index.html', '../'],
        ['p/index.html', '../'],
        ['p/blend_gh1/index.html', '../../'],
    ];
    for (const [file, prefix] of pages) {
        assert.deepEqual(navTargets(read(file), prefix), DESTINATIONS,
            `${file}: header nav does not offer the same three destinations`);
    }
});

test('each page marks exactly one nav entry as the page you are on', () => {
    // aria-current is the whole reason a nav is orientation and not just links.
    // The hub and the 44 reference pages both sit under the directory, so both
    // mark that entry - one each, never two, never none.
    for (const file of ['index.html', 'plan/index.html', 'p/index.html',
                        'p/blend_gh1/index.html']) {
        const nav = read(file).match(/<nav class="site-nav"[\s\S]*?<\/nav>/)[0];
        assert.equal((nav.match(/aria-current="page"/g) || []).length, 1,
            `${file}: nav must mark exactly one current destination`);
        assert.equal((nav.match(/is-current/g) || []).length, 1,
            `${file}: the current class and aria-current must agree`);
    }
});

test('the short and long nav labels are never both visible', () => {
    // Two labels per link, exactly one of which is display:none at any width.
    // If a rule is dropped a link reads "All 44 peptidesPeptides", and if both
    // are hidden at some width the nav is three empty boxes.
    const css = read('css/theme.css');
    assert.match(css, /\.nav-short\s*\{\s*display:\s*none/, '.nav-short is not hidden by default');
    const narrow = css.slice(css.indexOf('@media (max-width: 760px)'));
    assert.match(narrow, /\.nav-full\s*\{\s*display:\s*none/, '.nav-full is not hidden on narrow screens');
    assert.match(narrow, /\.nav-short\s*\{\s*display:\s*inline/, '.nav-short is not restored on narrow screens');
});

test('an inverted chip sets its own foreground colour', () => {
    // .info-card-icon had the gradient and not the colour. Its two siblings
    // both had both. The rule is the pairing, not any one selector: a dark
    // chip built out of --chip-* must also say what colour the glyph is.
    const css = read('css/styles.css');
    const rules = [...css.matchAll(/([^{}\n]+)\{([^{}]*var\(--chip-1\)[^{}]*)\}/g)];
    assert.ok(rules.length >= 3, 'expected the chip tokens to be in use');
    for (const [, selector, body] of rules) {
        // A pseudo-element cannot contain an icon; ::before on .form-title is a
        // 5px accent bar that happens to share the palette.
        if (selector.includes('::')) continue;
        assert.match(body, /color:\s*#fff/,
            `${selector.trim()} paints a --chip-* surface without setting its glyph colour`);
    }
});

test('the chips do not follow --primary between themes', () => {
    // --primary inverts by design: it has to read ON the page background. A
    // chip is the opposite - it IS a background. Building one from --primary
    // turned it pale in dark mode and buried every white glyph at 2.43:1.
    const theme = read('css/theme.css');
    const dark = theme.slice(theme.indexOf(':root[data-theme="dark"]'));
    assert.match(dark, /--chip-1:\s*#/, 'the dark theme does not restate --chip-1');
});

// ---------------------------------------------------------------------------
// The syringe
// ---------------------------------------------------------------------------

test('the graphic scales to its container instead of a fixed pixel width', () => {
    // It carried width="400" height="130", so on a 952px container it rendered
    // at 42% with 552px of dead air either side. Measured, not guessed.
    // Only the opening <svg> tag - the rects inside it are sized in user units
    // by definition, and matching those would make this assertion meaningless.
    const open = generateSyringeSVG(12, 100).match(/<svg[\s\S]*?>/)[0];
    assert.match(open, /width="100%"/, 'the syringe is not fluid');
    assert.doesNotMatch(open, /(width|height)="\d+"/, 'the syringe still has a fixed pixel size');
    assert.match(open, /viewBox="0 0 \d+ \d+"/, 'a fluid SVG without a viewBox has no size at all');
});

test('the dose callout is rendered, not merely computed', () => {
    // It was assigned to a variable and never interpolated into the returned
    // markup - so the graphic shipped with no number on it at all, and looked
    // entirely plausible while doing it.
    const svg = generateSyringeSVG(12, 100);
    assert.match(svg, /class="syr-callout"[^>]*>12</, 'the units figure is missing from the graphic');
    assert.match(svg, /class="syr-leader"/, 'the callout has nothing tying it to the mark');
});

test('the callout cannot hang off either end of the graphic', () => {
    // At 0 units the plunger sits on the left edge and at full barrel on the
    // right; a text-anchor="middle" label at either would be half off-canvas.
    for (const units of [0, 1, 50, 99, 100]) {
        const svg = generateSyringeSVG(units, 100);
        const x = Number(svg.match(/class="syr-callout" x="([\d.]+)"/)[1]);
        const w = Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
        assert.ok(x >= 40 && x <= w - 40,
            `${units} units puts the callout at x=${x}, outside the drawable area`);
    }
});

test('the scale carries minor ticks between the numbered ones', () => {
    // Majors alone put 10 units between marks 52px apart, which is a dose you
    // can misread by five. The comb is what makes a position readable.
    for (const size of [30, 50, 100]) {
        const svg = generateSyringeSVG(12, size);
        const minor = svg.match(/class="syr-minor">([\s\S]*?)<\/g>/)[1];
        const count = (minor.match(/<line/g) || []).length;
        assert.ok(count > 10, `${size}U barrel drew only ${count} minor ticks`);
    }
});

test('an overflowing dose draws no plunger and says why', () => {
    // The plunger used to be unbounded and drew straight through the needle.
    const svg = generateSyringeSVG(140, 100);
    assert.doesNotMatch(svg, /class="syr-plunger"/, 'an impossible draw still drew a plunger');
    assert.match(svg, /exceeds this 100U syringe/);
    assert.match(svg, /2 draws/, 'the graphic does not say how many draws it would take');
});

test('the barrel label is out of the tick grid', () => {
    // "100U Insulin Syringe" was centred inside the barrel, straight across
    // its own gridlines, so both were unreadable where they crossed.
    const svg = generateSyringeSVG(12, 100);
    const barrelY = Number(svg.match(/class="syr-body" x="\d+" y="(\d+)"/)[1]);
    const barrelH = Number(svg.match(/class="syr-body"[^>]*height="(\d+)"/)[1]);
    const labelY = Number(svg.match(/class="syr-barrel-name" x="\d+" y="(\d+)"/)[1]);
    assert.ok(labelY > barrelY + barrelH,
        `the barrel name sits at y=${labelY}, inside the barrel (${barrelY}-${barrelY + barrelH})`);
});

test('the scale counts from the needle end', () => {
    // Zero is where the plunger tip rests when fully depressed, which is the
    // needle end. The needle used to be drawn on the right with the fill
    // running from the left, which puts zero at the far end from the needle.
    const svg = generateSyringeSVG(12, 100);
    const needleX = Number(svg.match(/class="syr-metal" points="([\d.]+),/)[1]);
    const barrelX = Number(svg.match(/class="syr-body" x="(\d+)"/)[1]);
    assert.ok(needleX < barrelX, 'the needle is not at the low end of the barrel');
    const zeroX = Number(svg.match(/<text x="([\d.]+)" y="\d+" text-anchor="middle">0<\/text>/)[1]);
    const maxX = Number(svg.match(/<text x="([\d.]+)" y="\d+" text-anchor="middle">100<\/text>/)[1]);
    assert.ok(zeroX < maxX, 'the scale does not increase away from the needle');
    assert.ok(Math.abs(zeroX - barrelX) < 2, 'zero is not at the barrel mouth');
});

test('the vial-size note is not folded away behind a disclosure', () => {
    // It moved out of the Vial Size cell, which it was making 100px taller
    // than the two beside it. Moving it is layout; hiding it is not - this is
    // the page saying what these sizes are NOT, and it stays on screen.
    const html = read('index.html');
    const at = html.indexOf('id="vialSizeProvenance"');
    assert.ok(at !== -1, 'the provenance note is gone entirely');
    assert.ok(at > html.indexOf('</details>'),
        'the note is back inside the form grid, where it unbalances the row');
    const before = html.slice(0, at);
    assert.equal((before.match(/<details/g) || []).length,
                 (before.match(/<\/details>/g) || []).length,
                 'the provenance note is inside an unclosed <details>');
});

/**
 * The independent data audit, as a build gate.
 *
 * tools/verify-data.js walks every record asking a different set of questions
 * from the rest of this suite -- schema, unit envelopes, self-contradiction,
 * and every vial x water combination the UI can reach. Running it by hand finds
 * things once; running it here means a record added next month cannot ship a
 * dose that overflows a syringe, a cadence that argues with its own prose, or a
 * range quietly republished as a fact.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
    dosesPerCycleRange, calculateVialsRange, weeklyFreqRange, performCalculation,
    solubilityCheck, SOLUBILITY_CEILING_MG_ML, RECON_VOLUMES
} from '../js/calculator.js';
import { formatRange } from '../js/ui.js';
import { parseFreqRange, parseCycleWeeks } from '../tools/freq-parse.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const peptides = JSON.parse(readFileSync(join(ROOT, 'data/peptides.json'), 'utf8')).peptides;
const byId = id => peptides.find(p => p.id === id);

function audit() {
    const raw = execFileSync(process.execPath, [join(ROOT, 'tools/verify-data.js'), '--json'], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    });
    return JSON.parse(raw);
}

test('the independent data audit finds nothing at ERROR severity', () => {
    const { findings, records, combosChecked } = audit();
    const errors = findings.filter(f => f.sev === 'ERROR');

    assert.equal(errors.length, 0,
        `data/peptides.json has ${errors.length} error-severity finding(s):\n`
        + errors.map(f => `  [${f.check}] ${f.id}: ${f.msg}`).join('\n'));

    // Guard the guard: an audit that silently stopped walking records would
    // also report zero errors.
    assert.equal(records, peptides.length);
    assert.ok(combosChecked > 500, `only ${combosChecked} vial x water combinations were computed`);
});

test('a cadence stated as a range is published as a range, not as its ceiling', () => {
    // cjc1295_nodac is the case that motivated this: "1-3x daily" stored f=21,
    // so the page said "252 injections" and "about 51 vials" -- true at three a
    // day and 3x too high at one, in prose and in the FAQ JSON-LD.
    const p = byId('cjc1295_nodac');
    assert.equal(p.freq, '1-3x daily');

    const doses = dosesPerCycleRange(p);
    assert.deepEqual([doses.min, doses.max, doses.ranged], [84, 252, true]);

    const vials = calculateVialsRange(p, p.med, p.vialSize);
    assert.deepEqual([vials.min, vials.max], [17, 51]);

    assert.equal(formatRange(doses), '84-252');
    assert.equal(formatRange(weeklyFreqRange(p)), '7-21');
});

test('every record whose prose gives a range carries that range in the data', () => {
    const missing = [];
    for (const p of peptides) {
        const fr = parseFreqRange(p.freq);
        if (fr && fr.min !== fr.max) {
            if (p.fMin === undefined || p.fMax === undefined) missing.push(`${p.id}: freq "${p.freq}" has no fMin/fMax`);
            else if (Math.abs(p.fMin - fr.min) > 0.001 || Math.abs(p.fMax - fr.max) > 0.001) {
                missing.push(`${p.id}: fMin/fMax ${p.fMin}/${p.fMax} do not match "${p.freq}"`);
            }
        }
        const cw = parseCycleWeeks(p.cycle);
        if (cw && cw.min !== cw.max && !p.dosesPerCycle) {
            if (p.wksMin !== cw.min || p.wksMax !== cw.max) missing.push(`${p.id}: cycle "${p.cycle}" has no matching wksMin/wksMax`);
        }
        // f must sit inside the range the record itself declares
        if (p.fMin !== undefined) {
            assert.ok(p.f >= p.fMin && p.f <= p.fMax, `${p.id}: f=${p.f} is outside fMin..fMax`);
        }
    }
    assert.deepEqual(missing, []);
});

test('a figure the record does not state is marked as assumed, not printed flat', () => {
    // "Multiple daily", "Continuous OK", "As needed" name no cadence and no
    // window. The stored f/wks are house assumptions, and a cycle total built
    // on them reads as measured unless it says otherwise.
    for (const p of peptides) {
        if (!parseFreqRange(p.freq)) {
            assert.equal(p.fAssumed, true, `${p.id}: freq "${p.freq}" is not countable but fAssumed is not set`);
        }
        if (!parseCycleWeeks(p.cycle) && !p.dosesPerCycle) {
            assert.equal(p.wksAssumed, true, `${p.id}: cycle "${p.cycle}" names no window but wksAssumed is not set`);
        }
    }
    assert.equal(dosesPerCycleRange(byId('gonadorelin')).assumed, true);
    assert.equal(dosesPerCycleRange(byId('blend_gh1')).assumed, false);
});

test('an interval reads as an interval, not as a count of the same digits', () => {
    // "Every 2-3 days" and "2-3x daily" carry the same two numbers and mean
    // opposite things -- 2.3-3.5 a week against 14-21. The first version of the
    // parser read the interval as a count and reported melanotan2, correctly
    // stored at f=3, as contradicting itself.
    const iv = parseFreqRange('Every 2-3 days');
    assert.ok(Math.abs(iv.min - 7 / 3) < 0.001 && Math.abs(iv.max - 3.5) < 0.001);

    const count = parseFreqRange('2-3x daily');
    assert.deepEqual([count.min, count.max], [14, 21]);

    assert.equal(parseFreqRange('Multiple daily'), null, '"Multiple daily" is not a countable cadence');
    assert.equal(parseFreqRange('As needed (before sexual activity)'), null);
});

test('a single stated cadence still renders as one number', () => {
    // 31 of 44 records state one cadence. The range work must not turn "84"
    // into "84-84" for any of them.
    const r = performCalculation(byId('blend_gh1'), { weightLbs: 180, syringe: 100 });
    assert.equal(formatRange(r.dosesPerCycleRange), '84');
    assert.equal(formatRange(r.vialsRange), '4');
    assert.equal(r.dosesPerCycleRange.ranged, false);
});

test('a concentration the powder cannot reach is flagged, not silently drawn', () => {
    // The syringe-overflow class, inverted. NAD+ at 500 mg in 1 ml computes a
    // tidy 50-unit draw -- the arithmetic is right and the solution does not
    // exist, because 500 mg/ml is well past where lyophilised powder dissolves.
    // Only mg-scale vials can reach the ceiling; mcg and IU products must
    // report `applies: false` rather than a pass they were never eligible for.
    const nad = byId('nadplus');
    const tight = solubilityCheck(nad, 500, 1);
    assert.equal(tight.overCeiling, true, 'NAD+ 500mg in 1ml is above the ceiling and must say so');
    assert.equal(tight.mlToClear, 1.5, 'the fix is a water volume, and it has to be named');
    assert.ok(tight.mlToClear * SOLUBILITY_CEILING_MG_ML >= 500,
        'the suggested volume must actually clear the ceiling it was derived from');

    assert.equal(solubilityCheck(nad, 500, 3).overCeiling, false, '500mg in 3ml dissolves fine');

    // Jo's own blend, and every peptide dosed in mcg or IU, sit orders of
    // magnitude below this and must never be flagged.
    assert.equal(solubilityCheck(byId('blend_gh1'), 10, 3).overCeiling, false);
    assert.equal(solubilityCheck(byId('hcg'), 5000, 3).applies, false,
        'an IU product has no mg/ml ceiling to breach');

    // A pre-filled pen is never reconstituted, so the field must exist and be inert.
    const pen = performCalculation(byId('dulaglutide'), { weightLbs: 180, syringe: 100 });
    assert.equal(pen.solubility.applies, false);
    assert.equal(pen.solubility.overCeiling, false);

    // Sweep: every mg-scale vial x water combination the UI can reach either
    // clears the ceiling or is flagged. No combination may pass unexamined.
    let flagged = 0;
    for (const p of peptides) {
        if (p.vialUnit !== 'mg' || p.noRecon) continue;
        for (const v of (p.vialSizes || [p.vialSize])) {
            for (const ml of RECON_VOLUMES) {
                const s = solubilityCheck(p, v, ml);
                assert.equal(s.applies, true, `${p.id}: mg vial must be in scope`);
                assert.equal(s.overCeiling, s.concentration > SOLUBILITY_CEILING_MG_ML,
                    `${p.id} ${v}mg/${ml}ml: flag disagrees with its own concentration`);
                if (s.overCeiling) flagged++;
            }
        }
    }
    assert.equal(flagged, 9,
        `expected the 9 known over-ceiling combinations (glutathione x3, nadplus x6), got ${flagged}`);
});

test('the page flags the concentration it cannot dissolve', () => {
    // The flag has to survive the trip through build-pages.js, or the 44 static
    // pages keep publishing a number the app now warns about.
    const nad = readFileSync(join(ROOT, 'p/nadplus/index.html'), 'utf8');
    // Match the flag element, not the phrase: the explanatory note under the
    // table says "may not dissolve" on all 43 pages, so the bare phrase cannot
    // tell a flagged row from an unflagged page. This assertion caught itself.
    const FLAG = /<span class="flag">may not dissolve<\/span>/;
    assert.match(nad, FLAG, 'nadplus 1ml row must carry the flag');
    // The template wraps that sentence across source lines, so match on the
    // collapsed text rather than one exact run of spaces.
    const nadFlat = nad.replace(/\s+/g, ' ');
    assert.match(nadFlat, /above roughly 400 mg\/ml/, 'and the table must explain what the flag means');

    // ...and must not appear on a record that dissolves fine at every volume.
    const blend = readFileSync(join(ROOT, 'p/blend_gh1/index.html'), 'utf8');
    assert.doesNotMatch(blend, FLAG, 'a 3.33 mg/ml blend must never be flagged');
});

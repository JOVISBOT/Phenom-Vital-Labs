/**
 * Regression guard for the dose engine.
 *
 * Every P0 defect found in the 2026-08-20 audit would have failed this file:
 *   - syringe units computed at 50 units/ml instead of 100  -> golden snapshot
 *   - flat mcg totals multiplied by body weight (up to 280x) -> PLAUSIBLE_UNITS
 *   - HCG vial sizes in IU labelled mg, computing 0 units    -> UNITS_ARE_DRAWABLE
 *   - blends with no vialSize, working only by regex         -> SCHEMA
 *
 * No dependencies. Run:  node --test test/
 * Refresh the snapshot after an intended change:  node test/calculator.test.mjs --update
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
    performCalculation,
    calculateSyringeUnits,
    calculateVialsNeeded,
    calculateDose,
    dosesPerCycle,
    vialsPerDose,
    splitBlendDose,
    toVialUnits,
    validateInputs,
    UNITS_PER_ML,
    RECON_VOLUMES,
    SYRINGE_SIZES
} from '../js/calculator.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, 'golden.json');

const { peptides } = JSON.parse(readFileSync(join(HERE, '..', 'data', 'peptides.json'), 'utf8'));
const LEVELS = ['low', 'med', 'high'];
const REF_WEIGHT = 180;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

test('every peptide declares a complete, self-consistent unit model', () => {
    for (const p of peptides) {
        assert.ok(['mcg', 'mg', 'IU'].includes(p.doseUnit), `${p.id}: bad doseUnit ${p.doseUnit}`);
        assert.ok(['mg', 'IU'].includes(p.vialUnit), `${p.id}: bad vialUnit ${p.vialUnit}`);

        // A dose in IU can only be measured against a vial in IU, and vice versa.
        // Mixing them is what made the calculator tell an HCG user to draw zero.
        const doseIsIU = p.doseUnit === 'IU';
        const vialIsIU = p.vialUnit === 'IU';
        assert.equal(doseIsIU, vialIsIU, `${p.id}: doseUnit ${p.doseUnit} vs vialUnit ${p.vialUnit}`);

        assert.ok(p.vialSize > 0, `${p.id}: missing vialSize`);
        assert.ok(Array.isArray(p.vialSizes) && p.vialSizes.length, `${p.id}: missing vialSizes`);
        assert.ok(p.vialSizes.includes(p.vialSize), `${p.id}: default vial ${p.vialSize} not in vialSizes`);
        assert.ok(RECON_VOLUMES.includes(p.reconMl), `${p.id}: reconMl ${p.reconMl} not offered`);
        assert.ok(p.f > 0 && p.wks > 0, `${p.id}: bad frequency/cycle`);
        assert.ok(!('fixed' in p), `${p.id}: legacy 'fixed' flag still present`);
    }
});

test('dose tiers ascend', () => {
    for (const p of peptides) {
        assert.ok(p.low <= p.med, `${p.id}: low ${p.low} > med ${p.med}`);
        assert.ok(p.med <= p.high, `${p.id}: med ${p.med} > high ${p.high}`);
    }
});

test('blend components sum to the vial and split cleanly', () => {
    for (const p of peptides.filter(x => x.components)) {
        const total = p.components.reduce((s, c) => s + c.mg, 0);
        assert.equal(total, p.vialSize, `${p.id}: components sum ${total} != vialSize ${p.vialSize}`);

        const split = splitBlendDose(p, p.med);
        const splitTotal = split.reduce((s, c) => s + c.mg, 0);
        assert.ok(Math.abs(splitTotal - toVialUnits(p.med, p.doseUnit)) < 1e-6,
            `${p.id}: per-component doses do not sum to the combined dose`);
    }
});

test('a blend never reports only its combined dose', () => {
    // 0.4 mg of a 5mg+5mg blend is 200 mcg of each. Showing only "0.4 mg" reads
    // as double the real per-peptide dose against every published convention.
    // Detection cannot key on the word "blend" alone: cagrisema is two actives in
    // one vial and its category reads "Dual Weight Loss Combo (2.5mg+2.5mg)".
    // Any record advertising "<n>mg + <n>mg" is a blend whatever it calls itself.
    for (const p of peptides) {
        const blob = `${p.id} ${p.name} ${p.category}`.toLowerCase();
        const isBlend = blob.includes('blend') || /\d\s*mg\s*\+\s*\d/.test(blob);
        if (isBlend) assert.ok(p.components, `${p.id} is a blend but has no components`);
    }
});

// ---------------------------------------------------------------------------
// Dose model
// ---------------------------------------------------------------------------

test('doses are flat totals, not scaled by body weight', () => {
    // The original bug: `fixed: false` was read as mcg/kg and multiplied by an
    // age-inflated body weight, turning BPC-157's 1000 mcg into 70,165 mcg.
    for (const p of peptides.filter(x => !x.perKg)) {
        for (const level of LEVELS) {
            assert.equal(calculateDose(p, 130, level), p[level]);
            assert.equal(calculateDose(p, 300, level), p[level]);
        }
    }
});

test('perKg peptides do scale with weight', () => {
    const fake = { ...peptides[0], perKg: true, low: 10, med: 10, high: 10 };
    const light = calculateDose(fake, 130, 'med');
    const heavy = calculateDose(fake, 260, 'med');
    assert.ok(heavy > light * 1.9 && heavy < light * 2.1, 'perKg should track weight linearly');
});

// ---------------------------------------------------------------------------
// Syringe arithmetic
// ---------------------------------------------------------------------------

test('a U-100 syringe reads 100 units per ml regardless of barrel size', () => {
    assert.equal(UNITS_PER_ML, 100);

    // 0.4 mg from a 10 mg vial in 3 ml is 0.12 ml, which is 12 units on any
    // insulin syringe. The old code returned 6 on a 50u barrel and 3.6 on a 30u.
    const blend = peptides.find(p => p.id === 'blend_gh1');
    const units = calculateSyringeUnits(blend, 0.4, 10, 3);
    assert.equal(units, 12);

    for (const syringe of SYRINGE_SIZES) {
        const r = performCalculation(blend, { weightLbs: REF_WEIGHT, vialSize: 10, reconMl: 3, syringe });
        assert.equal(r.syringeUnits.med, 12, `barrel size ${syringe} changed the reading`);
    }
});

test('units scale linearly with reconstitution volume', () => {
    const p = peptides.find(x => x.id === 'bpc157');
    const at1 = calculateSyringeUnits(p, p.med, 5, 1);
    const at3 = calculateSyringeUnits(p, p.med, 5, 3);
    assert.ok(Math.abs(at3 - at1 * 3) < 0.05, `${at3} should be 3x ${at1}`);
});

test('UNITS_ARE_DRAWABLE: no peptide computes a zero or negative draw', () => {
    // HCG's vial sizes were IU labelled as mg, giving 5000 mg/ml and a 0-unit draw.
    for (const p of peptides) {
        for (const level of LEVELS) {
            const r = performCalculation(p, { weightLbs: REF_WEIGHT });
            assert.ok(r.syringeUnits[level] > 0,
                `${p.id}/${level}: computes ${r.syringeUnits[level]} units`);
        }
    }
});

test('PLAUSIBLE_UNITS: the recommended dose fits inside one reconstituted vial', () => {
    // Draw volume can never exceed the volume of water the vial was mixed with.
    // Every runaway dose in the audit (2105 units, 393 vials) violated this.
    for (const p of peptides) {
        const r = performCalculation(p, { weightLbs: REF_WEIGHT });
        const maxUnits = p.reconMl * UNITS_PER_ML;
        assert.ok(r.syringeUnits.med <= maxUnits,
            `${p.id}: recommended dose is ${r.syringeUnits.med}u but the vial only holds ${maxUnits}u`);
    }
});

// The `med`-only check above is what let four records ship a `high` tier that
// needed more peptide than the vial contained. Every tier is checked now, and
// the exceptions are named rather than tolerated silently.
const EXCEEDS_VIAL_AT_HIGH = new Set([
    'aicar',    // 200mg dose, largest vial offered is 100mg
    'dihexa',   // 32mg dose, largest vial offered is 30mg
    'hmg'       // 300 IU dose, largest vial offered is 150 IU
]);

test('EVERY tier is either drawable from one vial, or flagged as needing more', () => {
    for (const p of peptides) {
        const r = performCalculation(p, { weightLbs: REF_WEIGHT });
        for (const level of LEVELS) {
            if (r.exceedsVial[level]) {
                assert.ok(EXCEEDS_VIAL_AT_HIGH.has(p.id),
                    `${p.id}/${level}: needs ${r.perDoseVials[level]} vials per dose and is not a known exception`);
                assert.equal(level, 'high', `${p.id}: only the high tier may exceed a vial`);
            } else {
                assert.ok(r.syringeUnits[level] <= p.reconMl * UNITS_PER_ML,
                    `${p.id}/${level}: ${r.syringeUnits[level]}u exceeds the ${p.reconMl * UNITS_PER_ML}u vial but was not flagged`);
            }
        }
    }
});

test('a dose bigger than the vial is reported, not silently truncated', () => {
    // Water dilutes, it does not add peptide -- so this state cannot be fixed by
    // reconstitution volume or barrel size, and the UI has to say so.
    for (const id of EXCEEDS_VIAL_AT_HIGH) {
        const p = peptides.find(x => x.id === id);
        const r = performCalculation(p, { weightLbs: REF_WEIGHT });
        assert.equal(r.exceedsVial.high, true, `${id}: expected the high tier to be flagged`);
        assert.ok(r.perDoseVials.high > 1, `${id}: perDoseVials should exceed 1`);
        assert.equal(r.exceedsVial.med, false, `${id}: the recommended dose must still be drawable`);
    }
});

test('dosesPerCycle overrides f x wks for day-stated courses', () => {
    // "10mg daily for 10 days" is not a whole number of weeks, so f x wks
    // over-reported thymalin by 4 doses and cortagen/crystagen by 1 each.
    const expected = { thymalin: 10, cortagen: 20, crystagen: 20 };
    for (const [id, doses] of Object.entries(expected)) {
        const p = peptides.find(x => x.id === id);
        assert.equal(dosesPerCycle(p), doses, `${id}: wrong cycle length`);
        assert.notEqual(p.f * p.wks, doses, `${id}: override is redundant, f x wks already gives ${doses}`);
    }
    // Everything else still derives from frequency x weeks.
    for (const p of peptides.filter(x => !(x.id in expected))) {
        assert.equal(dosesPerCycle(p), p.f * p.wks, `${p.id}: unexpected dosesPerCycle override`);
    }
});

test('PLAUSIBLE_VIALS: a full cycle never needs an absurd number of vials', () => {
    // dihexa previously computed 15,718 vials for one cycle.
    for (const p of peptides) {
        const r = performCalculation(p, { weightLbs: REF_WEIGHT });
        assert.ok(r.vialsNeeded >= 1 && r.vialsNeeded <= 60,
            `${p.id}: ${r.vialsNeeded} vials for a ${p.wks}-week cycle`);
    }
});

test('vials needed covers the whole cycle', () => {
    for (const p of peptides) {
        const perDose = toVialUnits(p.med, p.doseUnit);
        const needed = calculateVialsNeeded(p, p.med, p.vialSize);
        assert.ok(needed * p.vialSize >= perDose * dosesPerCycle(p) - 1e-9,
            `${p.id}: ${needed} vials do not cover the cycle`);
        assert.equal(vialsPerDose(p, p.med, p.vialSize) <= 1, true,
            `${p.id}: the recommended dose needs more than one vial`);
    }
});

test('overflow is reported, not hidden', () => {
    const p = peptides.find(x => x.id === 'bpc157');
    const small = performCalculation(p, { weightLbs: REF_WEIGHT, syringe: 30 });
    assert.equal(small.overflow.med, small.syringeUnits.med > 30);
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

test('validateInputs rejects the values that used to sail through', () => {
    const base = { peptide: peptides[0], weight: 180, age: 35, vialSize: 5, reconMl: 3, syringe: 100 };
    assert.ok(validateInputs(base).valid);
    assert.ok(!validateInputs({ ...base, peptide: null }).valid);
    assert.ok(!validateInputs({ ...base, vialSize: 0 }).valid);
    assert.ok(!validateInputs({ ...base, reconMl: 4 }).valid, 'unsupported recon volume');
    assert.ok(!validateInputs({ ...base, syringe: 50000 }).valid, 'unsupported syringe');
});

// ---------------------------------------------------------------------------
// Golden snapshot: all 44 peptides x 3 tiers. Any silent change to the maths or
// the data shows up here as a diff.
// ---------------------------------------------------------------------------

function snapshot() {
    const out = {};
    for (const p of [...peptides].sort((a, b) => a.id.localeCompare(b.id))) {
        const r = performCalculation(p, { weightLbs: REF_WEIGHT });
        out[p.id] = {
            doseUnit: r.doseUnit,
            vial: `${r.vialSize}${r.vialUnit}`,
            reconMl: r.reconMl,
            doses: r.doses,
            units: r.syringeUnits,
            vials: r.vialsNeeded
        };
    }
    return out;
}

test('golden snapshot matches', () => {
    const actual = snapshot();
    assert.ok(existsSync(GOLDEN), 'test/golden.json missing - run with --update');
    const expected = JSON.parse(readFileSync(GOLDEN, 'utf8'));

    for (const id of Object.keys(actual)) {
        assert.deepEqual(actual[id], expected[id], `${id} drifted from the golden snapshot`);
    }
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), 'peptide set changed');
});

if (process.argv.includes('--update')) {
    writeFileSync(GOLDEN, JSON.stringify(snapshot(), null, 2) + '\n');
    console.log(`Wrote ${GOLDEN}`);
}

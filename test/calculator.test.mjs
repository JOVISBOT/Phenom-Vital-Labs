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
    vialsPooled,
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
        if (!p.noRecon) {
            assert.ok(RECON_VOLUMES.includes(p.reconMl), `${p.id}: reconMl ${p.reconMl} not offered`);
        }
        assert.ok(p.f > 0 && p.wks > 0, `${p.id}: bad frequency/cycle`);
        assert.ok(!('fixed' in p), `${p.id}: legacy 'fixed' flag still present`);

        // Every record states how well its doses are evidenced. Left unset, the
        // site falls back to one blanket disclaimer that treats a Mounjaro label
        // strength and a forum figure as equally sourced.
        assert.ok(['approved', 'trial', 'convention'].includes(p.evidence),
            `${p.id}: bad or missing evidence class ${p.evidence}`);
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
    for (const p of peptides.filter(x => !x.noRecon)) {
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
    for (const p of peptides.filter(x => !x.noRecon)) {
        const r = performCalculation(p, { weightLbs: REF_WEIGHT });
        const maxUnits = p.reconMl * UNITS_PER_ML;
        assert.ok(r.syringeUnits.med <= maxUnits,
            `${p.id}: recommended dose is ${r.syringeUnits.med}u but the vial only holds ${maxUnits}u`);
    }
});

// The `med`-only check above is what let four records ship a `high` tier that
// needed more peptide than the vial contained. Every tier is checked now, and
// the exceptions are named rather than tolerated silently.
// The `med`-only check above is what let four records ship a `high` tier that
// needed more peptide than the vial contained. Every tier is checked now.
//
// aicar and dihexa were in this set because their doses were wrong (an 8-week
// 200mg/day protocol nobody publishes, and dihexa's ORAL range run through a
// subcutaneous draw). Both were corrected, so the only record left is one where
// dosing above a single vial is genuinely correct: menotropins ship as 75 IU
// vials and the label describes pooling several into one syringe. That record
// carries `multiVial`, and `multiVial` is now the ONLY licence to exceed a vial
// -- a record cannot re-enter this state by being added to a list.
const EXCEEDS_VIAL_ALLOWED = new Set(peptides.filter(p => p.multiVial).map(p => p.id));

test('only a multiVial product may need more than one vial per dose', () => {
    assert.deepEqual([...EXCEEDS_VIAL_ALLOWED], ['hmg'],
        'the set of products dosed above one vial changed');
});

test('EVERY tier is either drawable from one vial, or flagged as needing more', () => {
    for (const p of peptides.filter(x => !x.noRecon)) {
        const r = performCalculation(p, { weightLbs: REF_WEIGHT });
        for (const level of LEVELS) {
            if (r.exceedsVial[level]) {
                assert.ok(EXCEEDS_VIAL_ALLOWED.has(p.id),
                    `${p.id}/${level}: needs ${r.perDoseVials[level]} vials per dose and is not a multiVial product`);
                assert.equal(level, 'high', `${p.id}: only the high tier may exceed a vial`);
            } else {
                assert.ok(r.syringeUnits[level] <= p.reconMl * UNITS_PER_ML,
                    `${p.id}/${level}: ${r.syringeUnits[level]}u exceeds the ${p.reconMl * UNITS_PER_ML}u vial but was not flagged`);
            }
        }
    }
});

test('a dose bigger than the vial is reported, not silently truncated', () => {
    // Water dilutes, it does not add peptide, so an un-poolable dose above one
    // vial cannot be fixed by reconstitution volume or barrel size. No record is
    // in that state any more -- but the flag has to keep working, so drive it
    // with a synthetic record rather than deleting the guard along with the bug.
    const base = peptides.find(x => x.id === 'bpc157');
    const impossible = { ...base, low: 4000, med: 8000, high: 12000 }; // 12mg from a 5mg vial
    const r = performCalculation(impossible, { weightLbs: REF_WEIGHT, vialSize: 5, reconMl: 3 });

    assert.equal(r.exceedsVial.high, true, 'a 12mg dose from a 5mg vial must be flagged');
    assert.ok(r.perDoseVials.high > 1, 'perDoseVials should exceed 1');
    assert.equal(r.vialsPooled.high, 1, 'a record with no pooling instruction must not pool');
});

test('pooled vials share one volume of diluent, so the draw does not grow', () => {
    // MENOPUR ships only as 75 IU vials. Its instructions for use say to mix the
    // first vial with 1 ml, draw it back up, and dissolve up to five more in that
    // same liquid. Modelling a 300 IU dose as "4 vials, therefore 4 ml" would
    // have told the user to pull 400 units on a 100u barrel.
    const p = peptides.find(x => x.id === 'hmg');
    assert.equal(p.multiVial, true, 'hmg should be the pooling product');
    assert.equal(p.vialSize, 75, 'the real MENOPUR vial is 75 IU');

    const r = performCalculation(p, { weightLbs: REF_WEIGHT });

    assert.equal(r.vialsPooled.low, 1, '75 IU is one vial');
    assert.equal(r.vialsPooled.med, 2, '150 IU is two 75 IU vials');
    assert.equal(r.vialsPooled.high, 4, '300 IU is four 75 IU vials');

    // Pooling raises concentration, never volume: the draw is capped by the water.
    for (const level of LEVELS) {
        assert.equal(r.exceedsVial[level], false, `${level}: pooling is procedure, not a defect`);
        assert.ok(r.syringeUnits[level] <= p.reconMl * UNITS_PER_ML,
            `${level}: ${r.syringeUnits[level]}u exceeds the ${p.reconMl} ml it was mixed in`);
    }

    // Four vials of 75 IU in the same water is four times the concentration, so
    // 300 IU draws the same volume as 75 IU would from a single vial.
    assert.equal(r.syringeUnits.high, r.syringeUnits.low * 1,
        'a pooled dose should draw the same volume as one vial-worth');

    // Only a product carrying the flag pools. Everything else stays at one.
    for (const other of peptides.filter(x => !x.multiVial && !x.noRecon)) {
        const ro = performCalculation(other, { weightLbs: REF_WEIGHT });
        for (const level of LEVELS) {
            assert.equal(ro.vialsPooled[level], 1, `${other.id}/${level}: pooled without a label instruction`);
        }
        assert.equal(vialsPooled(other, other.high, other.vialSize), 1);
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
    for (const p of peptides.filter(x => !x.noRecon)) {
        const r = performCalculation(p, { weightLbs: REF_WEIGHT });
        assert.ok(r.vialsNeeded >= 1 && r.vialsNeeded <= 60,
            `${p.id}: ${r.vialsNeeded} vials for a ${p.wks}-week cycle`);
    }
});

test('vials needed covers the whole cycle', () => {
    for (const p of peptides.filter(x => !x.noRecon)) {
        const perDose = toVialUnits(p.med, p.doseUnit);
        const needed = calculateVialsNeeded(p, p.med, p.vialSize);
        assert.ok(needed * p.vialSize >= perDose * dosesPerCycle(p) - 1e-9,
            `${p.id}: ${needed} vials do not cover the cycle`);
        // A pooling product legitimately spends several vials per injection; a
        // single-vial product must never need more than one.
        assert.equal(vialsPerDose(p, p.med, p.vialSize) <= vialsPooled(p, p.med, p.vialSize), true,
            `${p.id}: the recommended dose needs more vials than it is allowed to pool`);
    }
});

test('overflow is reported, not hidden', () => {
    const p = peptides.find(x => x.id === 'bpc157');
    const small = performCalculation(p, { weightLbs: REF_WEIGHT, syringe: 30 });
    assert.equal(small.overflow.med, small.syringeUnits.med > 30);
});

test('the concentration shown is the one the volume was divided by', () => {
    // Found by reading the rendered page rather than the test output: HMG's
    // calculation box printed "75 IU/ml" and "1 ml" for a 150 IU dose. Both
    // numbers were individually right -- the volume came from two pooled vials,
    // the concentration from one -- and together they said 150 / 75 = 1.
    // Any figure the UI prints has to be the figure the arithmetic used.
    for (const p of peptides.filter(x => !x.noRecon)) {
        const r = performCalculation(p, { weightLbs: REF_WEIGHT });
        for (const level of LEVELS) {
            const dose = toVialUnits(r.doses[level], r.doseUnit);
            const implied = dose / r.concentrationAt[level];
            assert.ok(Math.abs(implied - r.volumeMl[level]) < 0.001,
                `${p.id}/${level}: ${dose} / ${r.concentrationAt[level]} is ${implied}, but the page says ${r.volumeMl[level]} ml`);
            assert.ok(Math.abs(r.volumeMl[level] * UNITS_PER_ML - r.syringeUnits[level]) < 0.06,
                `${p.id}/${level}: ${r.volumeMl[level]} ml does not match ${r.syringeUnits[level]} units`);
        }
    }
});

// ---------------------------------------------------------------------------
// Products that are never reconstituted
// ---------------------------------------------------------------------------

test('a pre-filled device reports no draw at all', () => {
    // dulaglutide is a single-dose pen. The calculator used to compute a
    // reconstitution volume and a syringe reading for it, which is not wrong so
    // much as meaningless -- and a meaningless number on a page whose whole job
    // is telling you what to pull to is worse than no number. Every draw field
    // comes back null so nothing downstream can render one by accident.
    const pens = peptides.filter(p => p.noRecon);
    assert.ok(pens.length, 'expected at least one pre-filled product');

    for (const p of pens) {
        const r = performCalculation(p, { weightLbs: REF_WEIGHT });
        assert.equal(r.noRecon, true, `${p.id}: noRecon not propagated`);
        assert.equal(r.concentration, null, `${p.id}: computed a concentration`);
        assert.equal(r.reconMl, null, `${p.id}: computed a water volume`);
        for (const level of LEVELS) {
            assert.equal(r.syringeUnits[level], null, `${p.id}/${level}: computed syringe units`);
            assert.equal(r.volumeMl[level], null, `${p.id}/${level}: computed a draw volume`);
            assert.equal(r.overflow[level], false, `${p.id}/${level}: flagged overflow with no syringe`);
            assert.equal(r.exceedsVial[level], false, `${p.id}/${level}: flagged exceedsVial with no vial`);
        }
        // The doses themselves are still real -- they are the marketed strengths.
        assert.equal(r.doses.med, p.med, `${p.id}: lost its dose`);
        // One single-dose device per injection.
        assert.equal(r.vialsNeeded, r.dosesPerCycle, `${p.id}: device count should equal dose count`);
    }
});

test('a pre-filled device does not require a syringe or a water volume', () => {
    const pen = peptides.find(p => p.noRecon);
    const base = { peptide: pen, weight: 180, age: 35, vialSize: pen.vialSize, reconMl: 0, syringe: 0 };
    assert.ok(validateInputs(base).valid, 'a pen should validate without recon volume or syringe');

    // Everything else still has to answer both questions.
    const vialed = peptides.find(p => !p.noRecon);
    assert.ok(!validateInputs({ ...base, peptide: vialed }).valid,
        'a lyophilised vial still needs a recon volume and a syringe');
});

// ---------------------------------------------------------------------------
// Vial sizes the user types in
// ---------------------------------------------------------------------------

test('a vial size outside our catalogue still calculates', () => {
    // Fourteen of the catalogue sizes were convention rather than evidence. The
    // fix is not a better guess -- it is accepting the number printed on the
    // user's own vial. Vial size sets how far up the barrel the dose lands, so a
    // wrong catalogue is a legibility bug; a typed value removes it from the answer.
    const p = peptides.find(x => x.id === 'bpc157');
    const odd = 7.5;
    assert.ok(!p.vialSizes.includes(odd), 'pick a size that is genuinely not catalogued');

    const r = performCalculation(p, { weightLbs: REF_WEIGHT, vialSize: odd, reconMl: 3 });
    assert.equal(r.vialSize, odd);
    assert.ok(r.syringeUnits.med > 0, 'a typed vial size must still produce a draw');

    // Half the peptide in the same water is twice the units.
    const half = performCalculation(p, { weightLbs: REF_WEIGHT, vialSize: odd / 2, reconMl: 3 });
    assert.ok(Math.abs(half.syringeUnits.med - r.syringeUnits.med * 2) < 0.15,
        `${half.syringeUnits.med} should be double ${r.syringeUnits.med}`);

    assert.ok(validateInputs({ peptide: p, weight: 180, age: 35, vialSize: odd, reconMl: 3, syringe: 100 }).valid);
    assert.ok(!validateInputs({ peptide: p, weight: 180, age: 35, vialSize: NaN, reconMl: 3, syringe: 100 }).valid,
        'an empty custom box must not calculate');
    assert.ok(!validateInputs({ peptide: p, weight: 180, age: 35, vialSize: -5, reconMl: 3, syringe: 100 }).valid,
        'a negative vial size must not calculate');
});

test('no instruction restates a number the user chooses', () => {
    // Vial size and water volume are form inputs. An instruction that names one
    // will eventually contradict the form: picking a 7.5 mg vial left BPC-157's
    // protocol sheet saying "Reconstitute 5mg vial with 3ml bacteriostatic water"
    // under a header that read 7.5 mg. Advice is fine; hardcoded quantities are not.
    const quantity = /\d+\s*(mg|ml|iu)(?![a-z])/i;
    const owned = /reconstitut|bacteriostatic/i;

    for (const p of peptides) {
        for (const line of p.inst) {
            assert.ok(!(quantity.test(line) && owned.test(line)),
                `${p.id}: instruction hardcodes a reconstitution figure the form owns - "${line}"`);
        }
    }
});

// ---------------------------------------------------------------------------
// Evidence class
// ---------------------------------------------------------------------------

test('evidence classes are assigned, not defaulted wholesale', () => {
    const counts = { approved: 0, trial: 0, convention: 0 };
    for (const p of peptides) counts[p.evidence]++;

    // If a future edit drops the field, every record silently becomes
    // 'convention' and the label stops carrying information. Require all three
    // classes to be populated.
    for (const [cls, n] of Object.entries(counts)) {
        assert.ok(n > 0, `no peptide is classed '${cls}' - the label has stopped discriminating`);
    }
    assert.equal(counts.approved + counts.trial + counts.convention, peptides.length);

    // The compounds with the thinnest evidence must never be over-claimed.
    for (const id of ['bpc157', 'tb500', 'dihexa', 'aicar', 'blend_heal', 'cjc1295_nodac']) {
        assert.equal(peptides.find(p => p.id === id).evidence, 'convention',
            `${id} has no human dosing study and must not claim otherwise`);
    }
    // ...and the approved ones must actually be marketed products.
    for (const id of ['tirzepatide', 'dulaglutide', 'tesamorelin', 'hmg']) {
        assert.equal(peptides.find(p => p.id === id).evidence, 'approved', `${id} downgraded`);
    }
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

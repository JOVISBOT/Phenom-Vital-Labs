/**
 * Peptide Calculator Module
 * Pure calculation functions - no DOM manipulation
 *
 * @module calculator
 */

/** Insulin syringes are U-100: 100 units per millilitre, whatever the barrel holds. */
export const UNITS_PER_ML = 100;

/** Reconstitution volumes (ml of bacteriostatic water) offered in the UI. */
export const RECON_VOLUMES = [1, 2, 3, 5];
export const DEFAULT_RECON_ML = 3;

/** Insulin syringe barrel sizes, in units. Barrel size caps volume, not concentration. */
export const SYRINGE_SIZES = [30, 50, 100];
export const DEFAULT_SYRINGE = 100;

/**
 * A peptide's own reconstitution volume, falling back to the site default.
 * Dosing scale varies 1000-fold across the database, so one global constant
 * cannot serve every peptide -- NAD+ needs 1 ml where an ipamorelin blend needs 3.
 * @param {Object} peptide
 * @returns {number} ml
 */
export function defaultReconMl(peptide) {
    return peptide.reconMl || DEFAULT_RECON_ML;
}

/**
 * Convert a dose into the same unit the vial is measured in.
 * mcg -> mg; mg and IU pass straight through.
 * @param {number} dose
 * @param {string} doseUnit - 'mcg' | 'mg' | 'IU'
 * @returns {number} Dose expressed in the vial's unit
 */
export function toVialUnits(dose, doseUnit) {
    return doseUnit === 'mcg' ? dose / 1000 : dose;
}

/**
 * Body weight in kilograms. Only used by peptides flagged `perKg`.
 * @param {number} weightLbs
 * @returns {number} kg
 */
export function toKg(weightLbs) {
    return weightLbs / 2.205;
}

/**
 * Dose for a given level.
 *
 * `low`/`med`/`high` are flat protocol totals in `doseUnit`. They are NOT
 * per-kilogram values, and they are not scaled by age -- doing either produced
 * doses up to 280x conventional. A peptide whose figures genuinely are
 * per-kilogram must opt in with `perKg: true`.
 *
 * @param {Object} peptide
 * @param {number} weightLbs
 * @param {string} level - 'low', 'med', or 'high'
 * @returns {number} Dose in the peptide's `doseUnit`
 */
export function calculateDose(peptide, weightLbs, level = 'med') {
    const base = peptide[level];

    if (peptide.perKg === true) {
        return round(base * toKg(weightLbs), 1);
    }

    return base;
}

/**
 * Reconstituted concentration.
 * @param {number} vialSize - Vial content, in the peptide's `vialUnit`
 * @param {number} reconMl - Bacteriostatic water added, in ml
 * @returns {number} Vial units per ml
 */
export function concentration(vialSize, reconMl = DEFAULT_RECON_ML) {
    return vialSize / reconMl;
}

/**
 * The concentration above which lyophilised peptide powder generally stops
 * going into solution. This is a general handling ceiling, not a per-compound
 * measurement, so it is surfaced as "confirm against the vendor's own
 * reconstitution note" and never as a refusal to compute.
 */
export const SOLUBILITY_CEILING_MG_ML = 400;

/**
 * Whether the chosen vial and water ask the powder to dissolve past that
 * ceiling, and the water volume that would clear it.
 *
 * Only mg-scale vials can reach it -- mcg and IU products sit orders of
 * magnitude below, so they report `applies: false` rather than a passing grade
 * they were never in the running for. Same shape as the `overflow` check above
 * it: a number the visitor cannot actually execute, named as such, with the
 * one control that fixes it.
 *
 * @param {Object} peptide
 * @param {number} vialSize
 * @param {number} reconMl
 */
export function solubilityCheck(peptide, vialSize, reconMl) {
    const size = vialSize || peptide.vialSize;
    const ml = reconMl || defaultReconMl(peptide);
    if (peptide.vialUnit !== 'mg' || !size || !ml) {
        return { applies: false, overCeiling: false, concentration: null,
                 ceiling: SOLUBILITY_CEILING_MG_ML, mlToClear: null };
    }
    const conc = concentration(size, ml);
    const over = conc > SOLUBILITY_CEILING_MG_ML;
    return {
        applies: true,
        overCeiling: over,
        concentration: round(conc, 1),
        ceiling: SOLUBILITY_CEILING_MG_ML,
        // Water that brings it under the ceiling, rounded up to the next half
        // ml so the answer is a volume someone can actually measure.
        mlToClear: over ? Math.ceil((size / SOLUBILITY_CEILING_MG_ML) * 2) / 2 : null
    };
}

/**
 * Volume to draw, in millilitres.
 * @param {Object} peptide
 * @param {number} doseAmount - Dose in the peptide's `doseUnit`
 * @param {number} vialSize
 * @param {number} reconMl
 * @returns {number} ml
 */
export function calculateVolumeMl(peptide, doseAmount, vialSize, reconMl) {
    const dose = toVialUnits(doseAmount, peptide.doseUnit);
    return dose / concentration(vialSize || peptide.vialSize, reconMl || defaultReconMl(peptide));
}

/**
 * Syringe units to draw. A U-100 syringe reads 100 units per ml regardless of
 * whether the barrel holds 30, 50 or 100 units.
 * @param {Object} peptide
 * @param {number} doseAmount - Dose in the peptide's `doseUnit`
 * @param {number} vialSize
 * @param {number} reconMl
 * @returns {number} Units to draw, to one decimal place
 */
export function calculateSyringeUnits(peptide, doseAmount, vialSize, reconMl) {
    const units = calculateVolumeMl(peptide, doseAmount, vialSize, reconMl) * UNITS_PER_ML;

    // Sub-unit draws are real at high concentrations, so keep one decimal
    // rather than rounding a 0.4-unit draw down to "0 units".
    return round(units, 1);
}

/**
 * Number of injections in one full cycle.
 *
 * `f` x `wks` only lands on the right number when the course is a whole number
 * of weeks. Protocols stated in days -- thymalin's "10mg daily for 10 days",
 * cortagen and crystagen's "20-day course" -- cannot be expressed that way and
 * were over-reporting by 4 and 1 doses respectively. Those records carry an
 * explicit `dosesPerCycle`, which wins when present.
 * @param {Object} peptide
 * @returns {number}
 */
export function dosesPerCycle(peptide) {
    return peptide.dosesPerCycle || peptide.f * peptide.wks;
}

/**
 * Injections in one cycle, as the RANGE the record actually states.
 *
 * `f` and `wks` are single numbers, and thirteen records got theirs by
 * collapsing a range in the prose -- "1-3x daily" stored 21, "8-12 on" stored
 * 10. Everything downstream then published the collapsed figure as fact.
 * cjc1295_nodac's page read "a typical course runs 12 on, 4 off, which is 252
 * injections", true only at the top of a 1-3x range; at once daily it is 84.
 * Where `fMin`/`fMax` or `wksMin`/`wksMax` exist, the range is the honest
 * answer and the point estimate is not.
 *
 * `assumed` is set where the prose names no cadence or no window at all
 * ("Multiple daily", "Continuous OK") and the stored figure is a house
 * assumption rather than something the record states.
 * @param {Object} peptide
 * @returns {{min: number, max: number, ranged: boolean, assumed: boolean}}
 */
export function dosesPerCycleRange(peptide) {
    const assumed = peptide.fAssumed === true || peptide.wksAssumed === true;

    if (peptide.dosesPerCycle) {
        return { min: peptide.dosesPerCycle, max: peptide.dosesPerCycle, ranged: false, assumed };
    }

    const fLo = peptide.fMin ?? peptide.f;
    const fHi = peptide.fMax ?? peptide.f;
    const wLo = peptide.wksMin ?? peptide.wks;
    const wHi = peptide.wksMax ?? peptide.wks;

    const min = Math.round(fLo * wLo);
    const max = Math.round(fHi * wHi);
    return { min, max, ranged: max > min, assumed };
}

/**
 * Vials for a full cycle, as a range, for the same reason.
 * @param {Object} peptide
 * @param {number} doseAmount - Dose in the peptide's `doseUnit`
 * @param {number} vialSize
 * @returns {{min: number, max: number, ranged: boolean, assumed: boolean}}
 */
export function calculateVialsRange(peptide, doseAmount, vialSize) {
    const perDose = toVialUnits(doseAmount, peptide.doseUnit);
    const size = vialSize || peptide.vialSize;
    const doses = dosesPerCycleRange(peptide);

    return {
        min: Math.ceil((perDose * doses.min) / size),
        max: Math.ceil((perDose * doses.max) / size),
        ranged: doses.ranged,
        assumed: doses.assumed
    };
}

/**
 * Doses per week as the record states it -- "14-21" rather than "21".
 * @param {Object} peptide
 * @returns {{min: number, max: number, ranged: boolean, assumed: boolean}}
 */
export function weeklyFreqRange(peptide) {
    const min = peptide.fMin ?? peptide.f;
    const max = peptide.fMax ?? peptide.f;
    return { min, max, ranged: max > min, assumed: peptide.fAssumed === true };
}

/**
 * Vials needed for one full cycle.
 * @param {Object} peptide
 * @param {number} doseAmount - Dose in the peptide's `doseUnit`
 * @param {number} vialSize
 * @returns {number}
 */
export function calculateVialsNeeded(peptide, doseAmount, vialSize) {
    const perDose = toVialUnits(doseAmount, peptide.doseUnit);
    const total = perDose * dosesPerCycle(peptide);

    return Math.ceil(total / (vialSize || peptide.vialSize));
}

/**
 * Vials consumed by a SINGLE injection.
 *
 * Normally a fraction. When it exceeds 1 the protocol asks for more peptide
 * than one reconstituted vial holds, so the dose cannot be drawn at all -- no
 * amount of bacteriostatic water fixes it, because water dilutes rather than
 * adds. Four records shipped in this state (aicar, dihexa, dulaglutide, hmg);
 * the old syringe-overflow check missed them because it only looked at `med`.
 * @param {Object} peptide
 * @param {number} doseAmount - Dose in the peptide's `doseUnit`
 * @param {number} vialSize
 * @returns {number}
 */
export function vialsPerDose(peptide, doseAmount, vialSize) {
    const perDose = toVialUnits(doseAmount, peptide.doseUnit);
    return round(perDose / (vialSize || peptide.vialSize), 3);
}

/**
 * How many vials are dissolved into a single dose.
 *
 * One, for everything that is sold in a vial big enough to hold the dose. The
 * exception is a product whose own label describes sequential reconstitution:
 * MENOPUR is supplied only as 75 IU vials, and the instructions for use say to
 * mix the first vial with 1 ml of diluent, draw it back up, and use that same
 * liquid to dissolve up to five more. So a 150 or 300 IU dose is two or four
 * vials -- and, critically, the volume does NOT grow with the vial count. The
 * draw stays 1 ml; the concentration goes up. Modelling it as "N times the
 * volume" would have told a user to pull 400 units.
 * @param {Object} peptide
 * @param {number} doseAmount - Dose in the peptide's `doseUnit`
 * @param {number} vialSize
 * @returns {number}
 */
export function vialsPooled(peptide, doseAmount, vialSize) {
    if (peptide.multiVial !== true) return 1;
    const perDose = toVialUnits(doseAmount, peptide.doseUnit);
    return Math.max(1, Math.ceil(round(perDose / (vialSize || peptide.vialSize), 6)));
}

/**
 * Validate all inputs
 * @param {Object} inputs
 * @returns {Object} Validation result
 */
export function validateInputs(inputs) {
    const errors = [];

    if (!inputs.peptide) {
        errors.push('Please select a peptide');
    }

    if (!inputs.weight || inputs.weight < 50 || inputs.weight > 500) {
        errors.push('Please enter a valid weight (50-500 lbs)');
    }

    if (!inputs.age || inputs.age < 18 || inputs.age > 100) {
        errors.push('Please enter a valid age (18-100)');
    }

    // Vial size is now typed as well as picked, so this has to reject text and
    // negatives rather than just an unselected dropdown.
    if (!Number.isFinite(Number(inputs.vialSize)) || Number(inputs.vialSize) <= 0) {
        errors.push('Enter a vial size greater than zero');
    }

    // A pre-filled pen has neither a reconstitution volume nor a syringe, so
    // requiring them would make the record impossible to calculate.
    if (!(inputs.peptide && inputs.peptide.noRecon)) {
        if (!RECON_VOLUMES.includes(Number(inputs.reconMl))) {
            errors.push('Please select a reconstitution volume');
        }

        if (!SYRINGE_SIZES.includes(Number(inputs.syringe))) {
            errors.push('Please select a syringe size');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Per-component breakdown of a blend, so a 0.4mg combined dose is also shown as
 * 200mcg of each peptide. Every dosing convention for these compounds is stated
 * per component, so the combined figure alone reads as double.
 * @param {Object} peptide
 * @param {number} doseAmount - Combined dose in the peptide's `doseUnit`
 * @returns {Array<{name: string, mg: number, mcg: number}>|null}
 */
export function splitBlendDose(peptide, doseAmount) {
    if (!peptide.components || !peptide.components.length) return null;

    const totalMg = peptide.components.reduce((sum, c) => sum + c.mg, 0);
    const doseMg = toVialUnits(doseAmount, peptide.doseUnit);

    return peptide.components.map(c => {
        const mg = doseMg * (c.mg / totalMg);
        return { name: c.name, mg: round(mg, 4), mcg: round(mg * 1000, 1) };
    });
}

/**
 * Perform full calculation
 * @param {Object} peptide
 * @param {Object} opts - { weightLbs, vialSize, reconMl, syringe }
 * @returns {Object} Complete calculation results
 */
export function performCalculation(peptide, opts = {}) {
    const vialSize = opts.vialSize || peptide.vialSize;
    const reconMl = opts.reconMl || defaultReconMl(peptide);
    const syringe = opts.syringe || DEFAULT_SYRINGE;
    const weightLbs = opts.weightLbs;

    if (peptide.noRecon === true) {
        return deviceCalculation(peptide, weightLbs, vialSize);
    }

    const doses = {};
    const syringeUnits = {};
    const volumeMl = {};
    const components = {};
    const pooled = {};
    const concentrationAt = {};

    for (const level of ['low', 'med', 'high']) {
        doses[level] = calculateDose(peptide, weightLbs, level);
        components[level] = splitBlendDose(peptide, doses[level]);

        // Pooled vials share one volume of diluent, so the peptide available in
        // that volume goes up while the volume itself does not.
        pooled[level] = vialsPooled(peptide, doses[level], vialSize);
        const available = vialSize * pooled[level];

        concentrationAt[level] = round(concentration(available, reconMl), 4);
        volumeMl[level] = round(calculateVolumeMl(peptide, doses[level], available, reconMl), 4);
        syringeUnits[level] = calculateSyringeUnits(peptide, doses[level], available, reconMl);
    }

    const perDoseVialUnits = toVialUnits(doses.med, peptide.doseUnit);
    const perDoseVials = {};
    for (const level of ['low', 'med', 'high']) {
        perDoseVials[level] = vialsPerDose(peptide, doses[level], vialSize);
    }

    return {
        doseUnit: peptide.doseUnit,
        vialUnit: peptide.vialUnit,
        vialSize,
        reconMl,
        syringe,
        concentration: round(concentration(vialSize, reconMl), 4),
        // Concentration actually in the syringe at each tier. Identical to the
        // above everywhere except a pooled product, where dissolving N vials in
        // one volume multiplies it. Printing the single-vial figure next to the
        // pooled volume made the on-screen arithmetic contradict itself: 150 IU
        // divided by 75 IU/ml is 2 ml, but the page said 1 ml.
        concentrationAt,
        doses,
        volumeMl,
        syringeUnits,
        components,
        // True when one dose will not fit in the selected barrel in a single draw.
        // Fixable by the user: pick a bigger barrel, or split the injection.
        overflow: {
            low: syringeUnits.low > syringe,
            med: syringeUnits.med > syringe,
            high: syringeUnits.high > syringe
        },
        // True when the powder is being asked to dissolve past the practical
        // ceiling. Fixable by the user, and by exactly one control: more water.
        solubility: solubilityCheck(peptide, vialSize, reconMl),
        perDoseVials,
        // Vials dissolved into one dose. >1 only where the label says to.
        vialsPooled: pooled,
        // True when one dose needs more peptide than a whole vial holds and the
        // product has no pooling instruction to cover it. NOT fixable by barrel
        // size or water volume -- water dilutes, it does not add peptide.
        exceedsVial: {
            low: perDoseVials.low > 1 && pooled.low === 1,
            med: perDoseVials.med > 1 && pooled.med === 1,
            high: perDoseVials.high > 1 && pooled.high === 1
        },
        vialsNeeded: calculateVialsNeeded(peptide, doses.med, vialSize),
        // The range beside every collapsed figure. Where a record states one
        // cadence these are equal to the point estimate and `ranged` is false,
        // so nothing changes for 31 of the 44.
        vialsRange: calculateVialsRange(peptide, doses.med, vialSize),
        dosesPerCycleRange: dosesPerCycleRange(peptide),
        weeklyFreqRange: weeklyFreqRange(peptide),
        totalCycle: round(perDoseVialUnits * dosesPerCycle(peptide), 2),
        dosesPerCycle: dosesPerCycle(peptide),
        weeklyFreq: peptide.f,
        cycleWeeks: peptide.wks,
        noRecon: false,
        // Some products are legitimately dosed above one vial. Menotropins are
        // sold only as 75 IU vials and the label itself describes pooling several
        // into one syringe, so `exceedsVial` there is procedure, not a defect.
        multiVial: peptide.multiVial === true
    };
}

/**
 * Results for a product that is never reconstituted.
 *
 * A pre-filled pen has no powder, no bacteriostatic water and no draw: the dose
 * is whichever strength was dispensed. The calculator used to compute a
 * reconstitution volume for dulaglutide anyway, which is not wrong so much as
 * meaningless -- and a meaningless number on a page whose whole job is telling
 * you what to pull to is worse than no number. Every draw field is returned as
 * null so nothing downstream can render one by accident.
 * @param {Object} peptide
 * @param {number} weightLbs
 * @param {number} strength - Selected device strength, in `vialUnit`
 * @returns {Object}
 */
function deviceCalculation(peptide, weightLbs, strength) {
    const nulls = { low: null, med: null, high: null };
    const falses = { low: false, med: false, high: false };
    const doses = {};
    const components = {};

    for (const level of ['low', 'med', 'high']) {
        doses[level] = calculateDose(peptide, weightLbs, level);
        components[level] = splitBlendDose(peptide, doses[level]);
    }

    const perDose = toVialUnits(doses.med, peptide.doseUnit);

    return {
        doseUnit: peptide.doseUnit,
        vialUnit: peptide.vialUnit,
        vialSize: strength,
        reconMl: null,
        syringe: null,
        concentration: null,
        concentrationAt: { low: null, med: null, high: null },
        doses,
        volumeMl: { ...nulls },
        syringeUnits: { ...nulls },
        components,
        overflow: { ...falses },
        // A pre-filled pen is never reconstituted, so there is nothing to dissolve.
        solubility: { applies: false, overCeiling: false, concentration: null,
                      ceiling: SOLUBILITY_CEILING_MG_ML, mlToClear: null },
        perDoseVials: { ...nulls },
        vialsPooled: { low: 1, med: 1, high: 1 },
        exceedsVial: { ...falses },
        // One single-dose device per injection, so the device count is the dose count.
        vialsNeeded: dosesPerCycle(peptide),
        vialsRange: dosesPerCycleRange(peptide),
        dosesPerCycleRange: dosesPerCycleRange(peptide),
        weeklyFreqRange: weeklyFreqRange(peptide),
        totalCycle: round(perDose * dosesPerCycle(peptide), 2),
        dosesPerCycle: dosesPerCycle(peptide),
        weeklyFreq: peptide.f,
        cycleWeeks: peptide.wks,
        noRecon: true,
        device: peptide.device || 'device',
        multiVial: false
    };
}

function round(n, dp) {
    const f = Math.pow(10, dp);
    return Math.round(n * f) / f;
}

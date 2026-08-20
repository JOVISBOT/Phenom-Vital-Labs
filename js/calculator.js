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

    if (!inputs.vialSize || inputs.vialSize <= 0) {
        errors.push('Please select a vial size');
    }

    if (!RECON_VOLUMES.includes(Number(inputs.reconMl))) {
        errors.push('Please select a reconstitution volume');
    }

    if (!SYRINGE_SIZES.includes(Number(inputs.syringe))) {
        errors.push('Please select a syringe size');
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

    const doses = {};
    const syringeUnits = {};
    const volumeMl = {};
    const components = {};

    for (const level of ['low', 'med', 'high']) {
        doses[level] = calculateDose(peptide, weightLbs, level);
        volumeMl[level] = round(calculateVolumeMl(peptide, doses[level], vialSize, reconMl), 4);
        syringeUnits[level] = calculateSyringeUnits(peptide, doses[level], vialSize, reconMl);
        components[level] = splitBlendDose(peptide, doses[level]);
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
        perDoseVials,
        // True when one dose needs more peptide than a whole vial holds. NOT
        // fixable by barrel size or water volume -- it needs a second vial.
        exceedsVial: {
            low: perDoseVials.low > 1,
            med: perDoseVials.med > 1,
            high: perDoseVials.high > 1
        },
        vialsNeeded: calculateVialsNeeded(peptide, doses.med, vialSize),
        totalCycle: round(perDoseVialUnits * dosesPerCycle(peptide), 2),
        dosesPerCycle: dosesPerCycle(peptide),
        weeklyFreq: peptide.f,
        cycleWeeks: peptide.wks
    };
}

function round(n, dp) {
    const f = Math.pow(10, dp);
    return Math.round(n * f) / f;
}

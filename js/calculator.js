/**
 * Peptide Calculator Module
 * Pure calculation functions - no DOM manipulation
 * 
 * @module calculator
 */

/**
 * Calculate metabolic adjustment factor based on age
 * Research: GH/IGF-1 declines ~14% per decade after age 30
 * @param {number} age
 * @returns {number} Metabolic factor based on actual production decline data
 */
function getMetabolicFactor(age) {
    // Research shows ~14% decline per decade after 30
    // Age 20-30: 100% production (baseline)
    // Age 40: ~86% remaining (+16% supplemental needed)
    // Age 50: ~75% remaining (+33% supplemental needed)
    // Age 60: ~65% remaining (+54% supplemental needed, capped at 50%)
    if (age < 30) return 1.0;      // 18-29: 100% baseline
    if (age < 40) return 1.08;     // 30-39: +8% (early decline)
    if (age < 50) return 1.16;     // 40-49: +16% (14% per decade)
    if (age < 60) return 1.33;     // 50-59: +33% (28% total decline)
    return 1.5;                    // 60+: +50% (capped, 40%+ decline)
}

/**
 * Calculate recovery adjustment factor based on age
 * Based on clinical data: tissue repair slows 10-15% per decade after 35
 * @param {number} age
 * @returns {number} Recovery factor based on age-related decline
 */
function getRecoveryFactor(age) {
    // Tissue repair/healing declines ~10-15% per decade
    // More conservative than metabolic factor
    if (age < 30) return 1.0;      // 18-29: 100%
    if (age < 40) return 1.06;     // 30-39: +6%
    if (age < 50) return 1.12;     // 40-49: +12%
    if (age < 60) return 1.25;     // 50-59: +25%
    return 1.4;                    // 60+: +40%
}

/**
 * Calculate lean mass adjustment factor based on weight
 * @param {number} weightLbs
 * @returns {number} Lean mass factor (0.92 - 1.08)
 */
function getLeanMassFactor(weightLbs) {
    if (weightLbs < 120) return 0.92;
    if (weightLbs < 160) return 0.97;
    if (weightLbs < 200) return 1.0;
    if (weightLbs < 250) return 1.05;
    return 1.08;
}

/**
 * Calculate adjusted body weight in kg
 * @param {number} weightLbs
 * @param {number} age
 * @returns {number} Adjusted weight in kg
 */
export function calculateAdjustedWeight(weightLbs, age) {
    const kg = weightLbs / 2.205;
    const metabolicFactor = getMetabolicFactor(age);
    const recoveryFactor = getRecoveryFactor(age);
    const leanMassFactor = getLeanMassFactor(weightLbs);
    
    return kg * (metabolicFactor * 0.4 + recoveryFactor * 0.6) * leanMassFactor;
}

/**
 * Calculate dose in mg or mcg based on peptide type
 * @param {Object} peptide
 * @param {number} weightLbs
 * @param {number} age
 * @param {string} level - 'low', 'med', or 'high'
 * @returns {number} Dose in mg (for blends) or mcg (for regular)
 */
export function calculateDose(peptide, weightLbs, age, level = 'med') {
    const isBlend = peptide.id?.includes('blend') || peptide.category?.toLowerCase().includes('blend');
    
    if (peptide.fixed) {
        // For blends: return mg directly
        // For regular peptides: return mcg directly
        return peptide[level];
    }
    
    // Non-fixed doses are weight-based
    const adjustedKg = calculateAdjustedWeight(weightLbs, age);
    const baseDose = peptide[level] * adjustedKg;
    
    // Return appropriate unit
    return Math.round(baseDose * 10) / 10;
}

/**
 * Calculate total vials needed
 * @param {Object} peptide
 * @param {number} doseAmount - Dose in mg OR mcg
 * @param {number} vialSizeMg - Vial size in mg
 * @returns {number} Number of vials needed
 */
export function calculateVialsNeeded(peptide, doseAmount, vialSizeMg = 5) {
    const isBlend = peptide.id?.includes('blend') || peptide.category?.toLowerCase().includes('blend');
    
    // For blends: dose is already in mg
    // For regular: dose is in mcg, convert to mg
    const doseMg = isBlend ? doseAmount : doseAmount / 1000;
    const totalMg = doseMg * peptide.f * peptide.wks;
    
    // Vial total mg
    const vialTotalMg = vialSizeMg || 5;
    
    return Math.ceil(totalMg / vialTotalMg);
}

/**
 * Calculate syringe units to draw
 * @param {Object} peptide
 * @param {number} doseAmount - Dose in mg OR mcg
 * @param {number} vialSizeMg - Vial size in mg
 * @param {number} syringeUnits - Syringe capacity (30, 50, or 100)
 * @param {string} level - 'low', 'med', or 'high' - to add 4U for standard on mg peptides
 * @returns {number} Units to draw
 */
export function calculateSyringeUnits(peptide, doseAmount, vialSizeMg = 5, syringeUnits = 100, level = 'med') {
    const isBlend = peptide.id?.includes('blend') || peptide.category?.toLowerCase().includes('blend');
    
    // Convert dose to mg
    const doseMg = isBlend ? doseAmount : doseAmount / 1000;
    
    // Vial reconstituted with 3ml BAC water
    const vialTotalMg = vialSizeMg || 5;
    const mgPerMl = vialTotalMg / 3;
    const mlNeeded = doseMg / mgPerMl;
    
    const unitsPerMl = parseInt(syringeUnits) === 30 ? 30 : parseInt(syringeUnits) === 50 ? 50 : 100;
    
    let units = Math.round(mlNeeded * unitsPerMl);
    
    // Add 4U to standard dose for mg peptides
    if ((isBlend || peptide.fixed) && level === 'med') {
        units += 4;
    }
    
    return units;
}

/**
 * Calculate total cycle cost estimate
 * @param {number} vialsNeeded
 * @param {number} pricePerVial
 * @returns {number} Total cost
 */
export function calculateTotalCost(vialsNeeded, pricePerVial = 45) {
    return vialsNeeded * pricePerVial;
}

/**
 * Validate all inputs
 * @param {Object} inputs
 * @returns {Object} Validation result
 */
export function validateInputs(inputs) {
    const errors = [];
    
    if (!inputs.weight || inputs.weight < 50 || inputs.weight > 500) {
        errors.push('Please enter a valid weight (50-500 lbs)');
    }
    
    if (!inputs.age || inputs.age < 18 || inputs.age > 100) {
        errors.push('Please enter a valid age (18-100)');
    }
    
    if (!inputs.peptide) {
        errors.push('Please select a peptide');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Perform full calculation
 * @param {Object} peptide
 * @param {number} weightLbs
 * @param {number} age
 * @param {number} vialSize
 * @param {number} syringeUnits
 * @returns {Object} Complete calculation results
 */
export function performCalculation(peptide, weightLbs, age, vialSize, syringeUnits) {
    const isBlend = peptide.id?.includes('blend') || peptide.category?.toLowerCase().includes('blend');
    
    const lowDose = calculateDose(peptide, weightLbs, age, 'low');
    const medDose = calculateDose(peptide, weightLbs, age, 'med');
    const highDose = calculateDose(peptide, weightLbs, age, 'high');
    
    // Calculate vials needed (based on medium dose)
    const medVials = calculateVialsNeeded(peptide, medDose, vialSize);
    
    // Calculate syringe units for ALL dose levels (pass level for +4U on standard)
    const lowSyringeUnits = calculateSyringeUnits(peptide, lowDose, vialSize, syringeUnits, 'low');
    const medSyringeUnits = calculateSyringeUnits(peptide, medDose, vialSize, syringeUnits, 'med');
    const highSyringeUnits = calculateSyringeUnits(peptide, highDose, vialSize, syringeUnits, 'high');
    
    // Calculate total mg for the cycle (based on medium dose)
    const doseMg = isBlend ? medDose : medDose / 1000;
    const totalMg = doseMg * peptide.f * peptide.wks;
    
    return {
        doses: {
            low: lowDose,
            med: medDose,
            high: highDose
        },
        vialsNeeded: medVials,
        syringeUnits: {
            low: lowSyringeUnits,
            med: medSyringeUnits,
            high: highSyringeUnits
        },
        totalMg: Math.round(totalMg * 10) / 10,
        weeklyFreq: peptide.f,
        cycleWeeks: peptide.wks
    };
}

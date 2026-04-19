/**
 * Peptide Calculator Module
 * Pure calculation functions - no DOM manipulation
 * 
 * @module calculator
 */

/**
 * Calculate metabolic adjustment factor based on age
 * Research: GH/IGF-1 declines ~14% per decade after age 30
 * Returns factor where older = higher values (100% → 150%)
 * @param {number} age
 * @returns {number} Age factor (1.0 - 1.5)
 */
function getAgeFactor(age) {
    // Simple age-based scaling: older = higher dose needed
    if (age < 30) return 1.0;      // 18-29: baseline
    if (age < 40) return 1.1;      // 30-39: +10%
    if (age < 50) return 1.2;      // 40-49: +20%
    if (age < 60) return 1.35;     // 50-59: +35%
    return 1.5;                     // 60+: +50%
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
    const leanMassFactor = getLeanMassFactor(weightLbs);
    const ageFactor = getAgeFactor(age);
    
    return kg * ageFactor * leanMassFactor;
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
    
    // Get age-based factor (older = higher dose needed)
    const ageFactor = getAgeFactor(age);
    
    if (peptide.fixed) {
        // For blends and fixed-dose: apply age factor
        const baseDose = peptide[level];
        return Math.round(baseDose * ageFactor * 10) / 10;
    }
    
    // Non-fixed doses are weight-based with age factor
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
    const doseMg = peptide.fixed ? doseAmount : doseAmount / 1000;
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
 * @returns {number} Units to draw
 */
export function calculateSyringeUnits(peptide, doseAmount, vialSizeMg = 5, syringeUnits = 100) {
    const isFixed = peptide.fixed === true;
    
    // Convert dose to mg
    // Fixed peptides (mg): use directly
    // Non-fixed peptides (mcg): divide by 1000 to get mg
    const doseMg = isFixed ? doseAmount : doseAmount / 1000;
    
    // Vial reconstituted with 3ml BAC water
    const vialTotalMg = vialSizeMg || 5;
    const mgPerMl = vialTotalMg / 3;
    const mlNeeded = doseMg / mgPerMl;
    
    const unitsPerMl = parseInt(syringeUnits) === 30 ? 30 : parseInt(syringeUnits) === 50 ? 50 : 100;
    
    let units = Math.round(mlNeeded * unitsPerMl);
    
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
    
    // Calculate syringe units for ALL dose levels
    const lowSyringeUnits = calculateSyringeUnits(peptide, lowDose, vialSize, syringeUnits);
    const medSyringeUnits = calculateSyringeUnits(peptide, medDose, vialSize, syringeUnits);
    const highSyringeUnits = calculateSyringeUnits(peptide, highDose, vialSize, syringeUnits);
    
    // Calculate total mg for the cycle (based on medium dose)
    const doseMg = peptide.fixed === true ? medDose : medDose / 1000;
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

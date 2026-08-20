/**
 * Planner Module - reconstitution planning, vial life, and cycle supply.
 *
 * Pure functions, no DOM, no storage. Everything here answers a question the
 * calculator does not: not "how much do I draw" but "how much water should I
 * add so the draw is readable", "when does this vial run out or expire",
 * and "how many vials does the whole run need".
 *
 * @module planner
 */

import {
    UNITS_PER_ML, defaultReconMl, toVialUnits,
    concentration, calculateVolumeMl, SOLUBILITY_CEILING_MG_ML
} from './calculator.js';

/**
 * Reconstituted shelf life, refrigerated.
 *
 * Bacteriostatic water is preserved with 0.9% benzyl alcohol and holds for
 * weeks. PLAIN sterile water has no preservative: once the stopper is pierced
 * the vial is a single-use container, and treating it as a multi-week supply
 * is a sterility question rather than a potency one. The two are one letter
 * apart on a bottle and four weeks apart in consequence, so they are modelled
 * separately rather than assumed.
 */
export const SHELF_LIFE_DAYS = {
    bac: { min: 28, max: 42 },
    sterile: { min: 1, max: 1 }
};

/** A draw below this is too small to read reliably on a U-100 barrel. */
export const MIN_READABLE_UNITS = 4;

/**
 * Glass peptide vials are commonly 2 or 3 ml. Water is not the only thing that
 * has to fit -- the vial does too, and a recommendation of "add 5 ml" to a 3 ml
 * vial is not a recommendation, it is a spill. Volumes above this are still
 * offered and still computed, but flagged and never picked as `best`.
 */
export const TYPICAL_VIAL_CAPACITY_ML = 3;

/** Candidate water volumes, in ml. Half-ml steps are measurable; finer is not. */
export const CANDIDATE_RECON_ML = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

const MS_PER_DAY = 86400000;

/**
 * Parse an ISO `YYYY-MM-DD` date at noon UTC.
 *
 * Noon, not midnight: a midnight-anchored date shifts a day either way under
 * a timezone offset, and every number in here is a day count someone reads off
 * a calendar. Returns null rather than an Invalid Date, so callers branch on a
 * value instead of on NaN.
 * @param {string} iso
 * @returns {Date|null}
 */
export function parseDate(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt;
}

/** @param {Date} date @returns {string} ISO `YYYY-MM-DD` */
export function toISO(date) {
    return date.toISOString().slice(0, 10);
}

/**
 * `iso` shifted by whole days.
 * @param {string} iso
 * @param {number} days
 * @returns {string|null}
 */
export function addDays(iso, days) {
    const dt = parseDate(iso);
    if (!dt) return null;
    return toISO(new Date(dt.getTime() + Math.round(days) * MS_PER_DAY));
}

/**
 * Whole days from `a` to `b`. Negative when `b` is earlier.
 * @param {string} a
 * @param {string} b
 * @returns {number|null}
 */
export function daysBetween(a, b) {
    const x = parseDate(a), y = parseDate(b);
    if (!x || !y) return null;
    return Math.round((y.getTime() - x.getTime()) / MS_PER_DAY);
}

function round(n, dp) {
    const f = Math.pow(10, dp);
    return Math.round(n * f) / f;
}

/**
 * How close a unit count is to a mark someone can actually line up against.
 *
 * Whole units are best. Half-units are readable on a 30u barrel and guessable
 * on a 100u one. Anything else is a number the person is going to round in
 * their head at 11pm, which is the moment the dose stops being the dose.
 * @param {number} units
 * @returns {{grade: 'whole'|'half'|'awkward', off: number}}
 */
export function markQuality(units) {
    const toWhole = Math.abs(units - Math.round(units));
    if (toWhole < 0.051) return { grade: 'whole', off: round(toWhole, 2), mark: Math.round(units) };
    const toHalf = Math.abs(units * 2 - Math.round(units * 2)) / 2;
    if (toHalf < 0.051) return { grade: 'half', off: round(toHalf, 2), mark: Math.round(units * 2) / 2 };
    return { grade: 'awkward', off: round(toWhole, 2), mark: round(units, 1) };
}

/**
 * Every candidate water volume for one target dose, ranked.
 *
 * This is the question asked at mix time, and the calculator does not answer
 * it: the dose is already decided, the vial is already bought, and the only
 * free variable left is how much water goes in. Pick badly and the draw lands
 * at 2.7 units on a barrel marked in whole units.
 *
 * A candidate is rejected outright (`usable: false`) when the draw will not
 * fit the barrel or the powder cannot dissolve; it is merely penalised when
 * the draw is too small to read or lands off a mark.
 *
 * @param {Object} peptide
 * @param {number} doseAmount - dose in the peptide's `doseUnit`
 * @param {Object} [opts]
 * @param {number} [opts.vialSize]
 * @param {number} [opts.syringe=100] - barrel size in units
 * @param {number} [opts.currentMl]
 * @param {number[]} [opts.candidates]
 * @returns {{options: Array, best: Object|null, current: Object|null}}
 */
export function reconOptions(peptide, doseAmount, opts = {}) {
    const vialSize = opts.vialSize || peptide.vialSize;
    const syringe = opts.syringe || 100;
    const candidates = opts.candidates || CANDIDATE_RECON_ML;
    const currentMl = opts.currentMl == null ? defaultReconMl(peptide) : opts.currentMl;

    if (!vialSize || !(doseAmount > 0)) return { options: [], best: null, current: null };

    const perDoseVialUnits = toVialUnits(doseAmount, peptide.doseUnit);

    const options = candidates.map(ml => {
        const conc = concentration(vialSize, ml);
        const units = round(calculateVolumeMl(peptide, doseAmount, vialSize, ml) * UNITS_PER_ML, 2);
        const mark = markQuality(units);
        const fitsSyringe = units <= syringe;
        // Only mg-scale vials can approach the solubility ceiling; mcg and IU
        // products sit orders of magnitude below it.
        const solubilityOk = peptide.vialUnit !== 'mg' || conc <= SOLUBILITY_CEILING_MG_ML;
        const readable = units >= MIN_READABLE_UNITS;
        const fitsTypicalVial = ml <= TYPICAL_VIAL_CAPACITY_ML;
        const dosesPerVial = perDoseVialUnits > 0 ? Math.floor(round(vialSize / perDoseVialUnits, 6)) : 0;

        let score = 0;
        if (mark.grade === 'whole') score += 100;
        else if (mark.grade === 'half') score += 55;
        if (readable) score += 30;
        // Below three quarters of the barrel there is room to spare; above it,
        // a mis-pull runs off the end.
        if (units <= syringe * 0.75) score += 10;
        if (fitsTypicalVial) score += 40;
        // Tie-break toward the LARGER draw, not the smaller one. More water
        // means a longer pull for the same peptide, and a longer pull is the
        // one you can read. The instinct to save water optimises the wrong
        // variable: it buys nothing and costs precision.
        score += units * 0.01;

        return {
            reconMl: ml,
            units,
            // The mark to actually pull to. A dose of 0.167 mg at 3.33 mg/ml is
            // 5.01 units; printing "5.01 units, a whole mark" is a number
            // arguing with its own label, and 5.01 is not a thing a barrel can
            // show. `units` stays exact for the arithmetic; this is what a
            // person reads.
            drawUnits: mark.mark,
            perUnit: round(vialSize / ml / UNITS_PER_ML * (peptide.doseUnit === 'mcg' && peptide.vialUnit === 'mg' ? 1000 : 1), 3),
            perUnitLabel: peptide.doseUnit,
            concentration: round(conc, 2),
            concentrationUnit: (peptide.vialUnit || 'mg') + '/ml',
            mark: mark.grade,
            readable,
            fitsSyringe,
            solubilityOk,
            fitsTypicalVial,
            usable: fitsSyringe && solubilityOk,
            dosesPerVial,
            isCurrent: ml === currentMl,
            score: fitsSyringe && solubilityOk ? score : -1000 + score
        };
    });

    const ranked = [...options].sort((a, b) => b.score - a.score);
    const best = ranked.length && ranked[0].usable ? ranked[0] : null;
    return {
        options,
        best,
        current: options.find(o => o.isCurrent) || null
    };
}

/**
 * Where a reconstituted vial stands: what is left, when it runs dry, when it
 * expires, and which of those two comes first.
 *
 * The last part is the point. A vial that empties before it expires needs no
 * date tracking at all; the same vial at a smaller draw suddenly outlives its
 * own preservative, and the person is injecting past-window product with
 * plenty still in the barrel. Changing the dose silently flips which limit
 * applies, and nothing on a vial tells you that.
 *
 * @param {Object} opts
 * @param {number} opts.vialSize
 * @param {number} opts.reconMl
 * @param {number} opts.doseAmount - dose in `doseUnit`
 * @param {string} opts.doseUnit
 * @param {number} opts.dosesPerWeek
 * @param {string} opts.mixDate - ISO
 * @param {string} opts.today - ISO
 * @param {number} [opts.dosesTaken] - defaults to elapsed days x cadence
 * @param {'bac'|'sterile'} [opts.diluent='bac']
 * @returns {Object|null}
 */
export function vialProjection(opts) {
    const {
        vialSize, reconMl, doseAmount, doseUnit,
        dosesPerWeek, mixDate, today, diluent = 'bac'
    } = opts;

    if (!(vialSize > 0) || !(reconMl > 0) || !(doseAmount > 0) || !(dosesPerWeek > 0)) return null;
    const age = daysBetween(mixDate, today);
    if (age === null) return null;

    const mlPerDose = toVialUnits(doseAmount, doseUnit) / concentration(vialSize, reconMl);
    if (!(mlPerDose > 0) || mlPerDose > reconMl) return null;
    const dosesPerVial = Math.floor(round(reconMl / mlPerDose, 6));
    const perDay = dosesPerWeek / 7;

    // Elapsed-time estimate, unless the user has logged an actual count.
    const estimated = opts.dosesTaken === undefined || opts.dosesTaken === null;
    const taken = Math.max(0, Math.min(dosesPerVial,
        estimated ? Math.floor(Math.max(0, age) * perDay) : Math.round(opts.dosesTaken)));

    const dosesLeft = Math.max(0, dosesPerVial - taken);
    const mlUsed = round(taken * mlPerDose, 3);
    const mlLeft = round(Math.max(0, reconMl - mlUsed), 3);

    const daysToEmpty = Math.ceil(dosesLeft / perDay);
    const emptyDate = addDays(today, daysToEmpty);

    const shelf = SHELF_LIFE_DAYS[diluent] || SHELF_LIFE_DAYS.bac;
    const expiryMin = addDays(mixDate, shelf.min);
    const expiryMax = addDays(mixDate, shelf.max);
    const daysToExpiryMin = daysBetween(today, expiryMin);
    const daysToExpiryMax = daysBetween(today, expiryMax);

    // Conservative: compare against the near end of the window, because that
    // is the one a person can be caught out by.
    const limiting = daysToEmpty <= daysToExpiryMin ? 'empty' : 'expiry';
    const dosesLostToExpiry = limiting === 'expiry'
        ? Math.max(0, dosesLeft - Math.floor(Math.max(0, daysToExpiryMin) * perDay))
        : 0;

    return {
        mlPerDose: round(mlPerDose, 4),
        unitsPerDose: round(mlPerDose * UNITS_PER_ML, 1),
        dosesPerVial,
        dosesTaken: taken,
        dosesTakenEstimated: estimated,
        dosesLeft,
        mlUsed,
        mlLeft,
        pctUsed: Math.min(100, Math.round((mlUsed / reconMl) * 100)),
        ageDays: age,
        daysToEmpty,
        emptyDate,
        diluent,
        shelfLifeDays: shelf,
        expiryMin,
        expiryMax,
        daysToExpiryMin,
        daysToExpiryMax,
        expired: daysToExpiryMin < 0,
        limiting,
        dosesLostToExpiry
    };
}

/**
 * A whole run: how long it lasts, how much peptide it consumes, how many vials
 * to buy, and when each one gets mixed.
 *
 * The vial schedule is the part worth having. Vials are mixed one after
 * another rather than all at once, so vial N's expiry clock starts when vial
 * N-1 runs dry -- and a later vial in a long run can sit past its window while
 * an earlier one never came close. `expiresFirst` marks exactly those.
 *
 * @param {Object} opts
 * @param {string} opts.startDate - ISO
 * @param {number} opts.weeksOn
 * @param {number} [opts.weeksOff=0]
 * @param {number} opts.dosesPerWeek
 * @param {number} opts.doseAmount
 * @param {string} opts.doseUnit
 * @param {number} opts.vialSize
 * @param {number} opts.reconMl
 * @param {string} [opts.today]
 * @param {'bac'|'sterile'} [opts.diluent='bac']
 * @returns {Object|null}
 */
export function cyclePlan(opts) {
    const {
        startDate, weeksOn, weeksOff = 0, dosesPerWeek,
        doseAmount, doseUnit, vialSize, reconMl, diluent = 'bac'
    } = opts;

    if (!parseDate(startDate)) return null;
    if (!(weeksOn > 0) || !(dosesPerWeek > 0) || !(doseAmount > 0) || !(vialSize > 0) || !(reconMl > 0)) return null;

    const daysOn = Math.round(weeksOn * 7);
    // A run that starts on day 1 and lasts N days ends on day N, so the last
    // day is start + N - 1.
    const endDate = addDays(startDate, daysOn - 1);
    const totalDoses = Math.round(weeksOn * dosesPerWeek);

    const perDoseVialUnits = toVialUnits(doseAmount, doseUnit);
    const mlPerDose = perDoseVialUnits / concentration(vialSize, reconMl);
    if (!(mlPerDose > 0) || mlPerDose > reconMl) return null;
    const dosesPerVial = Math.floor(round(reconMl / mlPerDose, 6));
    const vialsNeeded = Math.ceil(totalDoses / dosesPerVial);

    const today = opts.today || null;
    const elapsed = today ? daysBetween(startDate, today) : null;
    const dosesDone = elapsed === null ? null
        : Math.max(0, Math.min(totalDoses, Math.floor((elapsed + 1) * (dosesPerWeek / 7))));

    const shelf = SHELF_LIFE_DAYS[diluent] || SHELF_LIFE_DAYS.bac;
    const perDay = dosesPerWeek / 7;

    const schedule = [];
    let doseCursor = 0;
    let dayCursor = 0;
    for (let i = 0; i < vialsNeeded; i++) {
        const dosesThis = Math.min(dosesPerVial, totalDoses - doseCursor);
        const daysThis = Math.ceil(dosesThis / perDay);
        const mixDate = addDays(startDate, dayCursor);
        const emptyDate = addDays(startDate, dayCursor + daysThis - 1);
        const ageAtEmpty = daysThis - 1;
        schedule.push({
            index: i + 1,
            mixDate,
            emptyDate,
            doses: dosesThis,
            ageAtEmptyDays: ageAtEmpty,
            expiryMin: addDays(mixDate, shelf.min),
            // The vial outlives its own preservative before it is finished.
            expiresFirst: ageAtEmpty > shelf.min,
            partial: dosesThis < dosesPerVial
        });
        doseCursor += dosesThis;
        dayCursor += daysThis;
    }

    return {
        startDate,
        endDate,
        weeksOn,
        weeksOff,
        daysOn,
        totalDoses,
        dosesDone,
        dosesLeft: dosesDone === null ? null : totalDoses - dosesDone,
        pctComplete: dosesDone === null ? null : Math.round((dosesDone / totalDoses) * 100),
        dayOfCycle: elapsed === null ? null : elapsed + 1,
        totalDoseAmount: round(doseAmount * totalDoses, 2),
        doseUnit,
        dosesPerVial,
        vialsNeeded,
        // Half the run, rounded down -- the last point at which a mid-cycle
        // result can still change the back half.
        midpointDate: addDays(startDate, Math.floor(daysOn / 2)),
        nextCycleStart: weeksOff > 0 ? addDays(endDate, Math.round(weeksOff * 7) + 1) : null,
        schedule,
        anyExpiresFirst: schedule.some(v => v.expiresFirst)
    };
}

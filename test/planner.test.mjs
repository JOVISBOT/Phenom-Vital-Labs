/**
 * Regression guard for the planner - mix volume, vial life, cycle supply.
 *
 * The defects this file exists to catch are all of one family: a number that
 * looks right in the happy case and is wrong at an edge nobody types on
 * purpose.
 *
 *   - a date shifted by a day across a DST boundary        -> DATES
 *   - "best water volume" that will not fit the vial       -> RECON
 *   - "best water volume" whose draw overflows the barrel  -> RECON
 *   - a vial that expires before it empties, unflagged     -> PROJECTION
 *   - a schedule whose doses do not sum to the run         -> CYCLE
 *
 * No dependencies. Run:  node --test test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
    parseDate, toISO, addDays, daysBetween, markQuality,
    reconOptions, vialProjection, cyclePlan,
    SHELF_LIFE_DAYS, CANDIDATE_RECON_ML, TYPICAL_VIAL_CAPACITY_ML
} from '../js/planner.js';
import { calculateDose, toVialUnits, defaultReconMl } from '../js/calculator.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const { peptides } = JSON.parse(readFileSync(join(HERE, '..', 'data', 'peptides.json'), 'utf8'));
const REF_WEIGHT = 180;

// ---------------------------------------------------------------------------
// DATES
// ---------------------------------------------------------------------------

test('a malformed date returns null rather than an Invalid Date', () => {
    for (const bad of ['', '2026-8-6', '06/08/2026', 'tomorrow', null, undefined, 20260806]) {
        assert.equal(parseDate(bad), null, `${bad} should not parse`);
    }
});

test('a date that does not exist does not silently roll into the next month', () => {
    // new Date(2026, 1, 30) happily becomes 2 March. A mix date of 30 February
    // is a typo, and answering it with a real date hides the typo.
    assert.equal(parseDate('2026-02-30'), null);
    assert.equal(parseDate('2026-13-01'), null);
    assert.ok(parseDate('2026-02-28'));
});

test('day arithmetic survives a daylight-saving boundary', () => {
    // US DST ends 1 Nov 2026. A midnight-anchored date lands on 31 Oct 23:00
    // local and reads back as the previous day. Every figure on the page is a
    // day count off a calendar, so a one-day slip is a wrong answer.
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(addDays('2026-11-01', 1), '2026-11-02');
    assert.equal(daysBetween('2026-10-25', '2026-11-08'), 14);
    // ...and the spring boundary, 8 March 2026.
    assert.equal(daysBetween('2026-03-01', '2026-03-15'), 14);
    assert.equal(addDays('2026-03-07', 1), '2026-03-08');
});

test('addDays and daysBetween are inverses over a long run', () => {
    const start = '2026-07-17';
    for (const n of [0, 1, 13, 28, 91, 365]) {
        assert.equal(daysBetween(start, addDays(start, n)), n);
    }
    assert.equal(daysBetween('2026-08-20', '2026-08-06'), -14, 'past dates go negative');
});

test('a leap day is a real day', () => {
    assert.ok(parseDate('2028-02-29'));
    assert.equal(parseDate('2027-02-29'), null);
    assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2);
});

// ---------------------------------------------------------------------------
// MARK QUALITY
// ---------------------------------------------------------------------------

test('a draw is graded by the mark it lands on', () => {
    assert.equal(markQuality(12).grade, 'whole');
    assert.equal(markQuality(12.02).grade, 'whole', 'float noise is still a whole mark');
    assert.equal(markQuality(12.5).grade, 'half');
    assert.equal(markQuality(12.7).grade, 'awkward');
    assert.equal(markQuality(0.4).grade, 'awkward');
});

// ---------------------------------------------------------------------------
// RECON - the mix-time recommendation
// ---------------------------------------------------------------------------

test('the recommended water volume is one that fits the vial and the barrel', () => {
    // This is the whole safety contract of the feature. A recommendation the
    // person cannot physically execute is worse than no recommendation.
    for (const p of peptides) {
        for (const level of ['low', 'med', 'high']) {
            const dose = calculateDose(p, REF_WEIGHT, level);
            for (const syringe of [30, 50, 100]) {
                const { best } = reconOptions(p, dose, { syringe });
                if (!best) continue;
                assert.ok(best.units <= syringe,
                    `${p.id}/${level}: best is ${best.units}u on a ${syringe}u barrel`);
                assert.ok(best.reconMl <= TYPICAL_VIAL_CAPACITY_ML,
                    `${p.id}/${level}: best asks for ${best.reconMl} ml into a vial`);
                assert.ok(best.usable, `${p.id}/${level}: best is flagged unusable`);
            }
        }
    }
});

test('when nothing can work, best is null rather than the least-bad overflow', () => {
    // A dose larger than the whole vial cannot be drawn at any water volume,
    // because water dilutes rather than adds.
    const p = peptides.find(x => x.vialUnit === 'mg' && x.doseUnit === 'mg') || peptides[0];
    const impossible = (p.vialSize || 5) * 100;
    const { best, options } = reconOptions({ ...p, doseUnit: p.vialUnit }, impossible, { syringe: 100 });
    assert.equal(best, null);
    assert.ok(options.every(o => !o.usable));
});

test('every candidate volume is reported, including the ones that are rejected', () => {
    const p = peptides.find(x => x.id === 'bpc157') || peptides[0];
    const { options } = reconOptions(p, calculateDose(p, REF_WEIGHT, 'med'), { syringe: 30 });
    assert.equal(options.length, CANDIDATE_RECON_ML.length);
    assert.deepEqual(options.map(o => o.reconMl), CANDIDATE_RECON_ML);
});

test('more water always means a longer pull for the same dose', () => {
    // The monotonicity the recommendation rests on. If this inverts, the
    // ranking is optimising a number that does not mean what it says.
    const p = peptides.find(x => x.id === 'bpc157') || peptides[0];
    const { options } = reconOptions(p, calculateDose(p, REF_WEIGHT, 'med'), { syringe: 100 });
    for (let i = 1; i < options.length; i++) {
        assert.ok(options[i].units > options[i - 1].units,
            `${options[i].reconMl} ml drew ${options[i].units}u, less than ${options[i - 1].reconMl} ml`);
    }
});

test('the current volume is marked so the page can say "no change needed"', () => {
    const p = peptides.find(x => x.id === 'cjc1295_nodac') || peptides[0];
    const r = reconOptions(p, 200, { vialSize: 10, currentMl: 3, syringe: 100 });
    assert.equal(r.current.reconMl, 3);
    assert.equal(r.current.units, 6, '10 mg in 3 ml is 3.33 mg/ml; 200 mcg is 0.06 ml is 6 units');
});

// ---------------------------------------------------------------------------
// PROJECTION - where a live vial stands
// ---------------------------------------------------------------------------

const VIAL = {
    vialSize: 10, reconMl: 3, doseAmount: 250, doseUnit: 'mcg',
    dosesPerWeek: 7, mixDate: '2026-08-06', today: '2026-08-20'
};

test('what has been used and what is left add up to what went in', () => {
    for (const dosesTaken of [0, 1, 7, 14, 19]) {
        const v = vialProjection({ ...VIAL, dosesTaken });
        assert.ok(Math.abs((v.mlUsed + v.mlLeft) - VIAL.reconMl) < 0.005,
            `${dosesTaken} doses: ${v.mlUsed} + ${v.mlLeft} != ${VIAL.reconMl}`);
    }
});

test('a smaller draw can flip a vial from "runs out first" to "expires first"', () => {
    // The reason the feature exists. At 15 units a 3 ml vial empties in 20 days
    // and cannot reach its own expiry; at 10 units the same vial lasts 30 days
    // and the preservative window becomes the binding limit. Nothing on the
    // vial tells you that the constraint moved.
    // Both vials are mixed today and untouched, so the only thing that differs
    // is the size of the draw.
    const fresh = { ...VIAL, mixDate: VIAL.today, dosesTaken: 0 };
    const big = vialProjection({ ...fresh, doseAmount: 500 });
    const small = vialProjection({ ...fresh, doseAmount: 333.33 });
    assert.equal(big.dosesPerVial, 20);
    assert.equal(big.limiting, 'empty');
    assert.equal(big.dosesLostToExpiry, 0);

    assert.equal(small.dosesPerVial, 30);
    assert.equal(small.limiting, 'expiry');
    assert.ok(small.dosesLostToExpiry > 0, 'doses stranded past the window are counted');
});

test('an untouched vial reports the full count, not an elapsed-time guess', () => {
    const v = vialProjection({ ...VIAL, dosesTaken: 0 });
    assert.equal(v.dosesTaken, 0);
    assert.equal(v.dosesTakenEstimated, false);
    assert.equal(v.dosesLeft, v.dosesPerVial);
});

test('with no logged count it estimates from elapsed days and says so', () => {
    const v = vialProjection(VIAL);
    assert.equal(v.dosesTakenEstimated, true);
    assert.equal(v.ageDays, 14);
    assert.equal(v.dosesTaken, 14, 'once daily for 14 days');
});

test('a logged count is never allowed to exceed what the vial holds', () => {
    const v = vialProjection({ ...VIAL, dosesTaken: 9999 });
    assert.equal(v.dosesTaken, v.dosesPerVial);
    assert.equal(v.dosesLeft, 0);
    assert.equal(v.mlLeft, 0, 'never a negative volume');
});

test('plain sterile water is a one-day vial, not a four-week one', () => {
    const bac = vialProjection({ ...VIAL, dosesTaken: 0, diluent: 'bac' });
    const sterile = vialProjection({ ...VIAL, dosesTaken: 0, diluent: 'sterile' });
    assert.equal(bac.expiryMin, addDays(VIAL.mixDate, SHELF_LIFE_DAYS.bac.min));
    assert.equal(sterile.expiryMin, addDays(VIAL.mixDate, 1));
    assert.equal(sterile.expired, true, 'mixed 14 days ago with no preservative');
    assert.equal(sterile.limiting, 'expiry');
});

test('a dose bigger than the reconstituted vial is refused, not approximated', () => {
    assert.equal(vialProjection({ ...VIAL, doseAmount: 99000 }), null);
    assert.equal(vialProjection({ ...VIAL, dosesPerWeek: 0 }), null);
    assert.equal(vialProjection({ ...VIAL, mixDate: 'yesterday' }), null);
});

// ---------------------------------------------------------------------------
// CYCLE - the whole run
// ---------------------------------------------------------------------------

const CYCLE = {
    startDate: '2026-07-17', weeksOn: 13, weeksOff: 4, dosesPerWeek: 7,
    doseAmount: 250, doseUnit: 'mcg', vialSize: 10, reconMl: 3, today: '2026-08-20'
};

test('a 13-week run ends on its last day, not the day after', () => {
    const c = cyclePlan(CYCLE);
    assert.equal(c.daysOn, 91);
    assert.equal(c.endDate, '2026-10-15', '17 Jul + 91 days inclusive');
    assert.equal(daysBetween(c.startDate, c.endDate), 90);
    assert.equal(c.totalDoses, 91);
});

test('the off-period starts the day after the run ends', () => {
    const c = cyclePlan(CYCLE);
    assert.equal(c.nextCycleStart, addDays(c.endDate, 29));
    assert.equal(cyclePlan({ ...CYCLE, weeksOff: 0 }).nextCycleStart, null);
});

test('progress counts the current day as done', () => {
    const c = cyclePlan(CYCLE);
    assert.equal(c.dayOfCycle, 35);
    assert.equal(c.dosesDone, 35);
    assert.equal(c.dosesLeft, 91 - 35);
    assert.equal(c.pctComplete, 38);
});

test('with no today, progress is null rather than zero', () => {
    // Zero would render as "0% complete" on a plan the person has not started,
    // which is a different and wrong claim.
    const c = cyclePlan({ ...CYCLE, today: null });
    assert.equal(c.dosesDone, null);
    assert.equal(c.pctComplete, null);
    assert.equal(c.dayOfCycle, null);
    assert.equal(c.totalDoses, 91, 'the plan itself still computes');
});

test('the vial schedule accounts for every dose in the run', () => {
    const c = cyclePlan(CYCLE);
    const scheduled = c.schedule.reduce((n, v) => n + v.doses, 0);
    assert.equal(scheduled, c.totalDoses);
    assert.equal(c.schedule.length, c.vialsNeeded);
    assert.equal(c.schedule.filter(v => v.partial).length <= 1, true, 'only the last vial is partial');
});

test('vials are mixed in sequence, each starting the day the last ran dry', () => {
    const c = cyclePlan(CYCLE);
    for (let i = 1; i < c.schedule.length; i++) {
        assert.equal(c.schedule[i].mixDate, addDays(c.schedule[i - 1].emptyDate, 1),
            `vial ${i + 1} does not start the day after vial ${i} empties`);
    }
    assert.equal(c.schedule[0].mixDate, c.startDate);
    assert.equal(c.schedule[c.schedule.length - 1].emptyDate, c.endDate);
});

test('a vial that outlives its own preservative is flagged', () => {
    const c = cyclePlan(CYCLE);
    assert.equal(c.dosesPerVial, 40, '10 mg in 3 ml is 3.33 mg/ml; 250 mcg is 0.075 ml; 3 / 0.075 = 40');
    assert.ok(c.anyExpiresFirst, '40 days of use against a 28-day window');
    assert.ok(c.schedule[0].expiresFirst);

    // The same run at a larger draw empties each vial inside the window.
    const fast = cyclePlan({ ...CYCLE, doseAmount: 500 });
    assert.equal(fast.dosesPerVial, 20);
    assert.equal(fast.anyExpiresFirst, false);
});

test('the midpoint is the midpoint', () => {
    const c = cyclePlan(CYCLE);
    assert.equal(c.midpointDate, addDays(c.startDate, 45));
    assert.equal(cyclePlan({ ...CYCLE, weeksOn: 8 }).midpointDate, addDays(c.startDate, 28));
});

test('a bad plan returns null instead of a schedule of NaN', () => {
    assert.equal(cyclePlan({ ...CYCLE, startDate: 'soon' }), null);
    assert.equal(cyclePlan({ ...CYCLE, weeksOn: 0 }), null);
    assert.equal(cyclePlan({ ...CYCLE, dosesPerWeek: 0 }), null);
    assert.equal(cyclePlan({ ...CYCLE, doseAmount: 0 }), null);
    assert.equal(cyclePlan({ ...CYCLE, doseAmount: 999999 }), null, 'dose larger than the vial');
});

// ---------------------------------------------------------------------------
// Every record, not just the convenient one
// ---------------------------------------------------------------------------

test('every peptide produces a coherent plan or an honest null', () => {
    for (const p of peptides) {
        const dose = calculateDose(p, REF_WEIGHT, 'med');
        const reconMl = defaultReconMl(p);
        const perDose = toVialUnits(dose, p.doseUnit);
        const c = cyclePlan({
            startDate: '2026-07-17',
            weeksOn: p.wks || 8,
            weeksOff: 4,
            dosesPerWeek: p.f || 7,
            doseAmount: dose,
            doseUnit: p.doseUnit,
            vialSize: p.vialSize,
            reconMl,
            today: '2026-08-20'
        });

        // A dose that exceeds one reconstituted vial genuinely cannot be
        // planned - those records are already flagged on the calculator.
        if (perDose > p.vialSize) {
            assert.equal(c, null, `${p.id}: dose exceeds the vial but a plan was returned`);
            continue;
        }
        assert.ok(c, `${p.id}: no plan`);
        for (const [k, v] of Object.entries(c)) {
            if (typeof v === 'number') assert.ok(Number.isFinite(v), `${p.id}.${k} is ${v}`);
        }
        assert.equal(c.schedule.reduce((n, v) => n + v.doses, 0), c.totalDoses, `${p.id}: doses lost`);
        assert.ok(c.vialsNeeded >= 1, `${p.id}: ${c.vialsNeeded} vials`);
        assert.ok(c.schedule.every(v => parseDate(v.mixDate) && parseDate(v.emptyDate)),
            `${p.id}: a schedule row has an unparseable date`);
    }
});

// ---------------------------------------------------------------------------
// Privacy - the planner is the only feature that remembers anything
// ---------------------------------------------------------------------------

test('the saved plan never leaves the browser', () => {
    // A dose, a compound and a set of injection dates describe a named
    // person's protocol. A peptide id is a catalogue fact. Only the second one
    // is allowed into an analytics call, and nothing at all is allowed into an
    // endpoint or the URL.
    const ROOT = join(HERE, '..');
    const plan = readFileSync(join(ROOT, 'js/plan.js'), 'utf8');
    const store = readFileSync(join(ROOT, 'js/planStore.js'), 'utf8');
    const analytics = readFileSync(join(ROOT, 'js/analytics.js'), 'utf8');

    assert.ok(!analytics.includes('pvl-plan'),
        'analytics.js references the plan storage key');

    const sensitive = ['doseAmount', 'mixDate', 'startDate', 'dosesTaken', 'vialSize', 'reconMl'];
    for (const [, props] of plan.matchAll(/track\(\s*'[^']+'\s*,\s*\{([^}]*)\}/g)) {
        for (const field of sensitive) {
            assert.ok(!props.includes(field), `plan.js sends ${field} to analytics`);
        }
    }

    // No exfiltration path of any kind from the planner.
    for (const [file, src] of [['plan.js', plan], ['planStore.js', store]]) {
        assert.ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|navigator\.clipboard/.test(src),
            `${file} opens a network path out of the planner`);
        assert.ok(!/history\.(replace|push)State|location\.search\s*=/.test(src),
            `${file} writes plan state into the URL, where it would be shared by a copied link`);
    }
});

test('storage failure degrades to a working page, not a broken one', () => {
    // Safari private browsing throws on setItem rather than returning null, so
    // every call site is wrapped. An unwrapped one takes the page down at boot.
    const store = readFileSync(join(HERE, '..', 'js/planStore.js'), 'utf8');
    const calls = store.match(/localStorage\.\w+\(/g) || [];
    assert.ok(calls.length >= 4, 'no storage calls found to check');
    const tries = store.match(/try\s*\{/g) || [];
    assert.ok(tries.length >= 4, `${calls.length} storage calls but only ${tries.length} try blocks`);
    assert.ok(!/catch\s*\(\s*e\s*\)\s*\{\s*throw/.test(store), 'a catch rethrows');
});

test('assets are addressed from the module, not from the page that loaded it', () => {
    // The planner lives one directory down. `fetch('./data/peptides.json')`
    // resolves against the DOCUMENT, so it worked from the calculator at the
    // root and 404'd from /plan/ - a page that rendered a header, a form and
    // no peptides. Any module-level path has to resolve against import.meta.url
    // or it silently depends on how deep the page happens to be.
    const loader = readFileSync(join(HERE, '..', 'js/dataLoader.js'), 'utf8');
    assert.match(loader, /import\.meta\.url/, 'dataLoader resolves its fetch against the page');
    assert.ok(!/fetch\(\s*[`'"]\.\//.test(loader), 'dataLoader still fetches a page-relative path');
});

test('the unit count shown is a mark the barrel actually has', () => {
    // 0.167 mg at 3.33 mg/ml is 5.01 units. The page printed "5.01 units, a
    // whole mark" - a number arguing with its own label, and 5.01 is not
    // something a barrel can show. `units` stays exact for the arithmetic;
    // `drawUnits` is what a person reads.
    const p = peptides.find(x => x.id === 'blend_gh1') || peptides[0];
    const r = reconOptions(p, 0.167, { vialSize: 10, currentMl: 3, syringe: 100 });
    assert.equal(r.current.units, 5.01, 'the exact figure is kept');
    assert.equal(r.current.drawUnits, 5, 'the printed figure is the mark');
    assert.equal(r.current.mark, 'whole');

    for (const o of r.options) {
        if (o.mark === 'whole') assert.ok(Number.isInteger(o.drawUnits), `${o.reconMl} ml: ${o.drawUnits}`);
        if (o.mark === 'half') assert.ok(Number.isInteger(o.drawUnits * 2), `${o.reconMl} ml: ${o.drawUnits}`);
        // Never round so far that the label and the number disagree.
        assert.ok(Math.abs(o.drawUnits - o.units) <= 0.051 || o.mark === 'awkward',
            `${o.reconMl} ml: ${o.units} shown as ${o.drawUnits}`);
    }
});

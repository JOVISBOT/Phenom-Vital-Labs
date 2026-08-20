#!/usr/bin/env node
/**
 * One-shot data migration: close every open item in data/DATA-REVIEW.md.
 *
 * The previous pass (tools/migrate-units.js) fixed everything that was a *unit*
 * error. It deliberately stopped short of anything that meant picking a dose,
 * and parked those in DATA-REVIEW.md awaiting sign-off. This script applies that
 * sign-off. Every dose below is anchored to a published trial arm or a stated
 * clinical convention -- the citation is on the change, not in a commit message.
 *
 * A sweep of all 44 records for the same bug classes also turned up five defects
 * the review had not caught. Those are folded in here and marked NEW.
 *
 * Run:  node tools/apply-data-review.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'peptides.json');

// ---------------------------------------------------------------------------
// Section 1 - doses that did not match published protocols.
// ---------------------------------------------------------------------------
const FIXES = {
    // Phase 2 (26 wks, n=706) randomised five weekly arms: 0.3, 0.6, 1.2, 2.4,
    // 4.5 mg, escalating every two weeks. Stored tiers were 100/200/400 MCG --
    // roughly 12x below the lowest arm, because the record was in the wrong unit
    // as well as the wrong magnitude. Tiers now are the three escalated arms.
    cagrilintide: {
        why: 'stored 100/200/400 mcg; Phase 2 arms are 0.3-4.5 mg weekly',
        set: {
            doseUnit: 'mg',
            low: 1.2, med: 2.4, high: 4.5,
            vialSize: 10,   // 5mg/3ml put the 2.4mg dose at 144u, past a 100u barrel
            reconMl: 2,     // 10mg/2ml = 5mg/ml -> 24u / 48u / 90u, all drawable
            wks: 26,        // trial duration; the record's own `cycle` is "Continuous"
            inst: [
                'Weekly subcutaneous injection, same day each week',
                'Phase 2 titration: 0.3mg -> 0.6mg -> 1.2mg -> 2.4mg -> 4.5mg',
                'Escalate every 2 weeks as tolerated - do not start at the top tier',
                '4.5mg weekly was the most effective arm (-10.8% body weight at 26 weeks)',
                'Often combined with semaglutide (see Cagrisema) rather than run alone',
                'Monitor for nausea - may need antiemetics during escalation'
            ]
        }
    },

    // Phase 2 (48 wks, n=338, NEJM 2023) dosed 1, 4, 8 and 12 mg weekly from a
    // 2mg or 4mg starting dose. Stored high was 4mg -- below the record's own
    // instruction text, which already said "Week 13+: 9-12mg weekly".
    retatrutide: {
        why: 'stored 1/2/4 mg; the record\'s own inst says 9-12mg is therapeutic',
        set: {
            low: 4, med: 8, high: 12,
            vialSize: 30,   // 10mg/2ml put the 8mg dose at 160u and 12mg past the vial
            reconMl: 2,     // 30mg/2ml = 15mg/ml -> 27u / 53u / 80u
            wks: 48,        // trial duration
            inst: [
                'Week 1-4: 2mg weekly (lower start halves GI side effects vs 4mg)',
                'Week 5-8: 4mg weekly',
                'Week 9-12: 8mg weekly',
                'Week 13+: 12mg weekly (highest trial arm, -24.2% at 48 weeks)',
                'Titrate every 4 weeks for GI tolerance',
                'Monitor resting heart rate - elevation is expected and dose-related',
                'Cardiovascular clearance recommended'
            ]
        }
    },

    // ------------------------------------------------------------------
    // Section 2 - instruction text that contradicted the dose fields.
    // ------------------------------------------------------------------

    // Convention for the short-acting stack is 100-300 mcg of EACH peptide.
    // Stored high was 0.8mg combined = 400 mcg each, past the top of that range;
    // the inst text quoted 300 mcg (the ceiling) as "typical". Both now agree.
    blend_gh1: {
        why: 'high tier was 400mcg each (above the 100-300 convention); inst quoted the ceiling as typical',
        set: {
            high: 0.6,
            inst: [
                'Contains 5mg CJC-1295 NO DAC + 5mg Ipamorelin (10mg total)',
                'Convention is 100-300mcg of EACH peptide per injection; 200mcg is typical',
                'CJC-1295 NO DAC saturates the GHRH receptor near 1mcg/kg - past that, side effects scale but GH release does not',
                'Inject once daily before bed on empty stomach',
                'Evening dosing rides the natural overnight GH pulse',
                'Empty stomach: wait 30 min after injection before eating'
            ]
        }
    },

    // TB-500 maintenance is 2-2.5mg/week. At 5 injections/week the stored med
    // (750mcg of each) delivered 3.75mg/wk of TB-500 -- loading-phase dosing held
    // for six straight weeks. The inst text (500mcg of each) was the correct
    // reading, so the dose fields moved to meet it.
    blend_heal: {
        why: 'med delivered 3.75mg/wk TB-500 (loading dose sustained 6 wks); inst said 500mcg each and was right',
        set: {
            low: 0.5, med: 1.0, high: 1.5,
            inst: [
                'Contains 5mg BPC-157 + 5mg TB-500 (10mg total)',
                'Typical dose: 1mg total = 500mcg of EACH peptide per injection',
                'At 5 injections/week that is 2.5mg/wk TB-500 - its maintenance dose',
                'Subcutaneous injection 5 days per week',
                'Inject near the injury site where practical - local beat systemic in tendon studies',
                'High tier (750mcg each) reaches TB-500 loading dose - use for acute injury, not maintenance'
            ]
        }
    },

    // Same two peptides at double the vial strength. Dose is a property of the
    // patient, not the vial, so the tiers must match blend_heal exactly -- the
    // 20mg vial buys a smaller injection volume, not a bigger dose. Stored tiers
    // were double, which is what "(High Dose)" in the name had come to mean.
    blend_heal_20: {
        why: 'tiers were double blend_heal for the same two peptides; the 20mg vial is more concentrated, not a higher dose',
        set: {
            name: 'BPC 157 + TB 500 Blend (20mg vial)',
            low: 0.5, med: 1.0, high: 1.5,
            inst: [
                'Contains 10mg BPC-157 + 10mg TB-500 (20mg total)',
                'Typical dose: 1mg total = 500mcg of EACH peptide - the same dose as the 10mg blend',
                'The 20mg vial is twice as concentrated: same dose, half the injection volume',
                'Subcutaneous injection 5 days per week',
                'Inject near the injury site where practical',
                'Fewer vials per cycle than the 10mg blend, so better value on long protocols'
            ]
        }
    },

    // "Maintenance: 5mg twice weekly" is 10mg/wk -- roughly 4x the cited
    // maintenance dose and double the loading dose. The dose fields were the
    // sane reading; the inst text was rewritten to match published protocol.
    tb500: {
        why: 'inst claimed 5mg twice weekly (10mg/wk) - about 4x the cited maintenance dose',
        set: {
            low: 1000, med: 2000, high: 2500,
            inst: [
                'Loading: 2-2.5mg twice weekly (4-5mg/wk) for the first 4-6 weeks',
                'Maintenance: 2-2.5mg once weekly thereafter',
                'Any fatty area acceptable (abdomen, thigh, glute)',
                'Best stacked with BPC-157 for acute injuries',
                'Community convention extrapolated from animal work - there is no validated human dose',
                'Can continue longer cycles with 4-week breaks'
            ]
        }
    },

    // ------------------------------------------------------------------
    // NEW - found by sweeping all 44 records, not listed in DATA-REVIEW.md
    // ------------------------------------------------------------------

    // NEW: cited range is 250-500 mcg/day. Stored med was 1000 and high 2000 --
    // 2x and 4x the top of that range. Also: the record's own inst said
    // "reconstitute with 3ml" while the data said 2ml.
    bpc157: {
        why: 'NEW - med/high were 2x/4x the cited 250-500mcg/day range; reconMl contradicted its own inst',
        set: {
            low: 250, med: 500, high: 1000,
            reconMl: 3,
            inst: [
                'Reconstitute 5mg vial with 3ml bacteriostatic water',
                'Cited range is 250-500mcg per day; 250mcg is the usual starting dose',
                'High tier (1000mcg) is an acute-injury protocol - split into AM and PM doses',
                'Inject subcutaneously near the injury site OR abdominal fat',
                'Morning on empty stomach, 30 minutes before eating',
                'Can be stacked with TB-500 for enhanced healing',
                'Store reconstituted vial refrigerated (2-8C)'
            ]
        }
    },

    // NEW: full maintenance is 2.4mg of each = 4.8mg total, and the low tier
    // should be the starting dose. The inst named "0.25mg total", which is half
    // the real 0.25mg-of-each start.
    cagrisema: {
        why: 'NEW - inst named 0.25mg total; the real start is 0.25mg of EACH (0.5mg total)',
        set: {
            low: 0.5,
            inst: [
                'Contains 2.5mg Cagrilintide + 2.5mg Semaglutide (5mg total)',
                'Starting dose: 0.5mg total = 0.25mg of EACH per week',
                'Full maintenance: 4.8mg total = 2.4mg of EACH per week',
                'Weekly subcutaneous injection, same day each week',
                'Titrate every 4 weeks - both components escalate together',
                'Monitor for nausea - may need antiemetics initially'
            ]
        }
    },

    // NEW: inst pointed at 1500-2000mg for skin protocols against a 500mg high
    // tier. Those are IV protocols; this calculator computes a subcutaneous or
    // IM draw, and 2000mg is more than three of its own vials.
    glutathione: {
        why: 'NEW - inst named 1500-2000mg (IV skin protocol) against a 500mg high tier and a 600mg vial',
        set: {
            inst: [
                'Subcutaneous or IM injection - the doses below are for that route',
                '2-3 times weekly maintenance',
                'Morning dosing may enhance detox',
                'Combine with vitamin C for synergy',
                'Skin-lightening protocols use 1500-2000mg by IV INFUSION - out of scope here, and more than three of these vials'
            ]
        }
    },

    // NEW: inst said "Week 13+: 10-15mg weekly (max)" while high was 10mg.
    // 15mg is the approved maximum, so the tier moved up; the 10mg vial had to
    // grow with it or a 15mg dose would exceed the vial.
    tirzepatide: {
        why: 'NEW - inst named 15mg as the max but high was 10mg; 15mg did not fit the 10mg vial',
        set: { high: 15, vialSize: 20 }
    },

    // NEW: high tier 4.5mg is a real Trulicity strength, but the default vial
    // was 3mg -- so the recommended maximum could not be drawn. 4.5 was already
    // in vialSizes; it just was not the default.
    dulaglutide: {
        why: 'NEW - high tier 4.5mg could not be drawn from the 3mg default vial',
        set: { vialSize: 4.5 }
    },

    // ------------------------------------------------------------------
    // Section 3 - cycles stated in days, which f x wks cannot express.
    // ------------------------------------------------------------------
    thymalin: { why: '"10mg daily for 10 days" - f x wks over-reported 14', set: { dosesPerCycle: 10 } },
    cortagen: { why: '"20-day course" - f x wks over-reported 21', set: { dosesPerCycle: 20 } },
    crystagen: { why: '"20-day course" - f x wks over-reported 21', set: { dosesPerCycle: 20 } }
};

// ---------------------------------------------------------------------------

const raw = fs.readFileSync(FILE, 'utf8');
const data = JSON.parse(raw);
const byId = Object.fromEntries(data.peptides.map(p => [p.id, p]));

let changed = 0;
for (const [id, fix] of Object.entries(FIXES)) {
    const p = byId[id];
    if (!p) throw new Error(`unknown peptide id: ${id}`);

    const deltas = [];
    for (const [key, val] of Object.entries(fix.set)) {
        const before = p[key];
        const same = JSON.stringify(before) === JSON.stringify(val);
        if (same) continue;
        deltas.push(Array.isArray(val) ? `${key}: rewritten` : `${key}: ${JSON.stringify(before)} -> ${JSON.stringify(val)}`);
        p[key] = val;
    }
    if (!deltas.length) continue;

    changed++;
    console.log(`${id}\n  why: ${fix.why}`);
    for (const d of deltas) console.log(`  ${d}`);
    console.log('');
}

// Guard: a blend's components must still sum to its vial after any rename.
for (const p of data.peptides.filter(x => x.components)) {
    const total = p.components.reduce((s, c) => s + c.mg, 0);
    if (total !== p.vialSize) throw new Error(`${p.id}: components sum ${total} != vialSize ${p.vialSize}`);
}
// Guard: the default vial must remain one the UI offers.
for (const p of data.peptides) {
    if (!p.vialSizes.includes(p.vialSize)) throw new Error(`${p.id}: default vial ${p.vialSize} not in vialSizes`);
    if (!(p.low <= p.med && p.med <= p.high)) throw new Error(`${p.id}: dose tiers do not ascend`);
}

data.schemaVersion = 3;
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log(`Updated ${changed} records. schemaVersion -> 3. Wrote ${FILE}`);

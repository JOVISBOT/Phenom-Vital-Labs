#!/usr/bin/env node
/**
 * One-shot data migration: replace the ambiguous `fixed` boolean with an explicit
 * unit model, and correct the seven peptides whose dose values were stored in the
 * wrong unit.
 *
 * Before: `fixed: true`  => low/med/high are milligrams
 *         `fixed: false` => low/med/high are micrograms, AND calculator.js
 *                           multiplied them by body weight (they are flat totals)
 *
 * After:  `doseUnit`  'mcg' | 'mg' | 'IU'  -- unit of low/med/high
 *         `vialUnit`  'mg' | 'IU'          -- unit of vialSize / vialSizes
 *         `vialSize`  default vial
 *         `vialSizes` selectable vials (moved out of the hardcoded map in ui.js)
 *         `perKg`     optional, true when low/med/high are per-kilogram
 *         `components` optional, for blends: per-component content
 *
 * Run:  node tools/migrate-units.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'peptides.json');

// ---------------------------------------------------------------------------
// Unit corrections. Every entry cites the evidence that justified the change;
// nothing was reclassified on a hunch.
// ---------------------------------------------------------------------------
const UNIT_FIXES = {
    hcg: {
        doseUnit: 'IU', scale: 1000,
        why: 'Record\'s own instructions say "250-500 IU typical maintenance" and ' +
             '"Higher doses (1000 IU) for PCT". Stored 0.25/0.5/1 "mg" = 250/500/1000 IU.'
    },
    hmg: {
        doseUnit: 'IU', scale: 1000,
        why: 'HMG is dosed exclusively in IU (75 IU per ampoule). ' +
             'Stored 0.075/0.15/0.3 "mg" = 75/150/300 IU.'
    },
    hgh: {
        doseUnit: 'IU', scale: 1,
        why: 'Somatropin is dosed in IU. 1/2/4 IU/day is the standard range; ' +
             '1-4 mg/day would be 3-12 IU/day.'
    },
    epo: {
        doseUnit: 'IU', scale: 1,
        why: 'Erythropoietin is dosed exclusively in IU. 1000/3000/5000 IU 3x weekly ' +
             'is the standard range. ENHANCEMENT_PLAN.md independently lists "epo | 3000iu".'
    },
    aicar: {
        doseUnit: 'mg', scale: 1,
        why: 'Record\'s own instructions say "Higher doses (100-200mg) for metabolic ' +
             'effects" -- 50/100/200 are milligrams, not micrograms.'
    },
    nadplus: {
        doseUnit: 'mg', scale: 1,
        why: 'Record\'s own instructions say "Large injection volume - split doses if ' +
             'needed", impossible at 100-500 mcg. Vial sizes are mg. 100/250/500 mg.'
    },
    glutathione: {
        doseUnit: 'mg', scale: 1,
        why: 'Injectable glutathione is dosed in mg (200-600 mg typical). ' +
             'ENHANCEMENT_PLAN.md independently lists a 200mg vial.'
    }
};

// Instruction strings carrying the same 1000x unit error as the dose fields.
const INST_FIXES = {
    glutathione: [['For skin: higher doses (1500-2000mcg)', 'For skin: higher doses (1500-2000mg)']]
};

// ---------------------------------------------------------------------------
// Vial catalogue. Sizes marked (plan) come from data/ENHANCEMENT_PLAN.md, which
// derived them from each record's own instruction text back in April.
// ---------------------------------------------------------------------------
const MG = [2, 5, 10, 15, 20, 30];
const VIALS = {
    ace031:        { size: 5,    sizes: MG },                          // plan
    adamax:        { size: 5,    sizes: MG },                          // plan
    adipotide:     { size: 5,    sizes: MG },                          // plan
    aicar:         { size: 50,   sizes: [25, 50, 100] },               // plan
    aod9604:       { size: 5,    sizes: [2, 5, 10] },                  // plan
    ara290:        { size: 10,   sizes: [5, 10, 20] },                 // plan
    b733:          { size: 5,    sizes: MG },                          // plan
    blend_gh1:     { size: 10,   sizes: [10] },                        // 5mg + 5mg
    blend_heal:    { size: 10,   sizes: [10] },                        // 5mg + 5mg
    blend_heal_20: { size: 20,   sizes: [20] },                        // 10mg + 10mg
    bpc157:        { size: 5,    sizes: [2, 5, 10] },                  // plan + inst
    cagrilintide:  { size: 5,    sizes: [2, 5, 10] },                  // plan
    cagrisema:     { size: 5,    sizes: [5] },                         // 2.5mg + 2.5mg
    cjc1295:       { size: 2,    sizes: [2, 5, 10] },                  // plan
    cjc1295_nodac: { size: 2,    sizes: [2, 5, 10] },                  // plan
    cortagen:      { size: 10,   sizes: [10, 20] },                    // plan
    crystagen:     { size: 10,   sizes: [10, 20] },                    // plan
    dermorphin:    { size: 5,    sizes: MG },                          // plan
    dihexa:        { size: 10,   sizes: [10, 20, 30] },                // plan
    dsip:          { size: 5,    sizes: [2, 5, 10] },                  // plan
    dulaglutide:   { size: 1.5,  sizes: [0.75, 1.5, 3, 4.5] },         // plan (pen)
    epo:           { size: 3000, sizes: [1000, 2000, 3000, 4000, 10000], unit: 'IU' },
    follistatin:   { size: 1,    sizes: [1, 2, 5] },                   // plan
    foxo4:         { size: 5,    sizes: [5, 10] },                     // plan
    frag1723:      { size: 5,    sizes: [2, 5, 10] },                  // plan
    ghrp2:         { size: 5,    sizes: [5, 10, 15] },                 // plan
    ghrp6:         { size: 5,    sizes: [5, 10, 15] },                 // plan
    glutathione:   { size: 200,  sizes: [200, 600, 1200] },            // plan
    gonadorelin:   { size: 2,    sizes: [2, 5, 10] },
    hcg:           { size: 5000, sizes: [1000, 2000, 5000, 10000], unit: 'IU' },
    hexarelin:     { size: 5,    sizes: [2, 5, 10] },
    hgh:           { size: 10,   sizes: [10, 12, 15, 24, 36], unit: 'IU' },
    hmg:           { size: 75,   sizes: [75, 150], unit: 'IU' },
    melanotan2:    { size: 10,   sizes: [10] },
    motsc:         { size: 10,   sizes: [5, 10, 20] },
    nadplus:       { size: 500,  sizes: [100, 250, 500, 1000, 2000] },
    pegmgf:        { size: 2,    sizes: [2, 5] },
    pt141:         { size: 10,   sizes: [5, 10] },
    retatrutide:   { size: 10,   sizes: [5, 10, 15, 20, 30, 40, 50, 60] },
    sermorelin:    { size: 5,    sizes: [2, 5, 10] },
    tb500:         { size: 5,    sizes: [2, 5, 10] },                  // inst: "1.5 vials" = 7.5mg
    tesamorelin:   { size: 5,    sizes: [2, 5, 10, 20] },
    thymalin:      { size: 10,   sizes: [10, 20] },                    // inst: "10mg daily"
    tirzepatide:   { size: 10,   sizes: [5, 10, 15, 20, 30, 40, 50, 60, 80] }
};

// Blends: per-component content, so the UI can stop reporting only the combined dose.
const COMPONENTS = {
    blend_gh1:     [{ name: 'CJC-1295 NO DAC', mg: 5 },  { name: 'Ipamorelin', mg: 5 }],
    blend_heal:    [{ name: 'BPC-157', mg: 5 },          { name: 'TB-500', mg: 5 }],
    blend_heal_20: [{ name: 'BPC-157', mg: 10 },         { name: 'TB-500', mg: 10 }],
    cagrisema:     [{ name: 'Cagrilintide', mg: 2.5 },   { name: 'Semaglutide', mg: 2.5 }]
};

// ---------------------------------------------------------------------------

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const log = [];

for (const p of data.peptides) {
    const fix = UNIT_FIXES[p.id];

    if (fix) {
        const before = [p.low, p.med, p.high];
        for (const level of ['low', 'med', 'high']) {
            p[level] = round(p[level] * fix.scale);
        }
        p.doseUnit = fix.doseUnit;
        log.push({
            id: p.id,
            from: `${before.join('/')} ${p.fixed ? 'mg' : 'mcg'}`,
            to: `${p.low}/${p.med}/${p.high} ${fix.doseUnit}`,
            why: fix.why
        });
    } else {
        p.doseUnit = p.fixed === true ? 'mg' : 'mcg';
    }

    const vial = VIALS[p.id];
    if (!vial) throw new Error(`No vial entry for ${p.id}`);
    p.vialUnit = vial.unit || 'mg';
    p.vialSize = vial.size;
    p.vialSizes = vial.sizes;

    if (COMPONENTS[p.id]) p.components = COMPONENTS[p.id];

    for (const [from, to] of INST_FIXES[p.id] || []) {
        const i = p.inst.indexOf(from);
        if (i === -1) throw new Error(`Instruction text not found on ${p.id}: ${from}`);
        p.inst[i] = to;
    }

    // `fixed` is gone: it conflated "is a milligram value" with "is not weight-scaled",
    // and the second half of that was never true of the data.
    delete p.fixed;

    // Key order: keep the file readable and diff-stable.
    reorder(p, ['id', 'name', 'category', 'research', 'mechanism', 'halfLife', 'freq',
        'cycle', 'doseUnit', 'low', 'med', 'high', 'perKg', 'vialUnit', 'vialSize',
        'vialSizes', 'components', 'f', 'wks', 'pros', 'cons', 'warnings', 'inst']);
}

data.schemaVersion = 2;
reorder(data, ['schemaVersion', 'peptides']);

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');

console.log(`Migrated ${data.peptides.length} peptides to schema v2.\n`);
console.log('Unit corrections:');
for (const l of log) console.log(`  ${l.id.padEnd(14)} ${l.from}  ->  ${l.to}\n${' '.repeat(18)}${l.why}`);

function round(n) { return Math.round(n * 1e6) / 1e6; }

function reorder(obj, order) {
    const copy = { ...obj };
    for (const k of Object.keys(obj)) delete obj[k];
    for (const k of order) if (k in copy) obj[k] = copy[k];
    for (const k of Object.keys(copy)) if (!(k in obj)) obj[k] = copy[k];
}

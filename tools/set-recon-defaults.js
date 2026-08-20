#!/usr/bin/env node
/**
 * Pick the default vial size and reconstitution volume for each peptide.
 *
 * Units drawn scale linearly with reconstitution volume:
 *     units = dose / (vialSize / reconMl) * 100
 * so the single hardcoded 3 ml suited peptides dosed at a few hundred mcg and
 * nothing else. NAD+ at 250 mg needed 1.5 ml; an ipamorelin blend needed 0.12 ml.
 * One constant cannot serve both, and it was duplicated in calculator.js and
 * pdfGenerator.js with no UI control.
 *
 * Vial size is what a buyer actually receives, so it stays pinned to the curated
 * catalogue in migrate-units.js and is escalated only when the recommended dose
 * would not fit comfortably inside one vial. Reconstitution volume is the dial
 * that actually gets turned, so that is what gets tuned.
 *
 * Constraints, in priority order:
 *   1. Reconstitution volume must be physically possible. Below ~1 ml you cannot
 *      wet the lyophilised cake and recover the dose; above 3 ml a standard 2R/3R
 *      peptide vial has no headspace. 5 ml is offered only for large-format vials.
 *   2. Prefer a vial holding at least two recommended doses; never default to one
 *      that holds less than a single dose.
 *   3. Then: put the RECOMMENDED (med) dose as close to 30 units as possible --
 *      a legible draw well up the barrel, where a half-mark misread is a few
 *      percent rather than 25%.
 *   4. Tie-break toward a 3 ml reconstitution, the volume the site has always
 *      used and that the BPC-157 record's own instructions specify.
 *
 * Run:  node tools/set-recon-defaults.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'peptides.json');
const TARGET_UNITS = 30;

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const rows = [];

for (const p of data.peptides) {
    const dose = p.doseUnit === 'mcg' ? p.med / 1000 : p.med;

    const sizes = [...p.vialSizes].sort((a, b) => a - b);
    const vialSize = p.vialSize >= dose * 2 ? p.vialSize                  // catalogue default is roomy enough
        : sizes.find(s => s >= dose * 2)                                 // else smallest holding two doses
        ?? sizes.find(s => s >= dose)                                     // else smallest holding one
        ?? sizes[sizes.length - 1];                                       // else the largest that exists

    // Headspace is a property of the vial actually chosen, not of the catalogue.
    const largeFormat = p.vialUnit === 'IU' ? vialSize >= 1000 : vialSize >= 20;
    const volumes = largeFormat ? [1, 2, 3, 5] : [1, 2, 3];

    let best = null;
    for (const ml of volumes) {
        const units = (dose / (vialSize / ml)) * 100;
        const candidate = {
            ml,
            units,
            // Log-distance so 15u and 60u are penalised equally against a 30u target.
            score: Math.abs(Math.log(units / TARGET_UNITS)) - (ml === 3 ? 0.15 : 0)
        };
        if (!best || candidate.score < best.score) best = candidate;
    }
    best.vialSize = vialSize;
    best.overVial = dose > vialSize;

    const changedVial = best.vialSize !== p.vialSize;
    p.vialSize = best.vialSize;
    p.reconMl = best.ml;

    reorder(p, ['id', 'name', 'category', 'research', 'mechanism', 'halfLife', 'freq',
        'cycle', 'doseUnit', 'low', 'med', 'high', 'perKg', 'vialUnit', 'vialSize',
        'vialSizes', 'reconMl', 'components', 'f', 'wks', 'pros', 'cons', 'warnings', 'inst']);

    rows.push({
        id: p.id,
        vial: `${best.vialSize}${p.vialUnit}${changedVial ? '*' : ''}`,
        ml: best.ml,
        units: Math.round(best.units * 10) / 10,
        overVial: best.overVial
    });
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');

rows.sort((a, b) => b.units - a.units);
console.log('Defaults (* = vial size changed). Recommended dose -> units drawn:\n');
for (const r of rows) {
    const flag = r.overVial ? '  << dose exceeds one vial; no vial size avoids it'
               : r.units > 100 ? '  << exceeds a 1ml syringe' : '';
    console.log(`  ${r.id.padEnd(15)} ${r.vial.padStart(9)}  ${String(r.ml).padStart(2)} ml  ${String(r.units).padStart(6)} u${flag}`);
}


function reorder(obj, order) {
    const copy = { ...obj };
    for (const k of Object.keys(obj)) delete obj[k];
    for (const k of order) if (k in copy) obj[k] = copy[k];
    for (const k of Object.keys(copy)) if (!(k in obj)) obj[k] = copy[k];
}

#!/usr/bin/env node
/**
 * Schema v5 - give every vial-size catalogue a provenance.
 *
 * DATA-REVIEW left this open:
 *
 *   "Vial-size catalogues remain unsourced. They are now defaults rather than
 *    constraints - the user can type any size - but the pre-filled list is still
 *    convention for most research compounds."
 *
 * The v4 answer was to let the user type their own size, which removes the
 * catalogue from the arithmetic. It does not remove it from the *screen*: the
 * dropdown still presents a list of numbers with no indication that some are a
 * marketed product's labelled strength and the rest are a vendor's habit. A
 * `10mg` sitting next to a `5000IU` reads as equally authoritative when only one
 * of them was ever printed on an FDA-approved carton.
 *
 * So: source what can be sourced, mark it on each size, and say plainly when
 * nothing can be. Three classes, mirroring the `evidence` field:
 *
 *   label   every size offered is a marketed strength
 *   mixed   some are; the rest are vendor convention
 *   vendor  no approved product is supplied in this compound at all
 *
 * Strengths below come from the openFDA NDC directory (data as of 2026-08-19)
 * and, where the NDC entry is a kit and so carries no strength, from the FDA
 * label's HOW SUPPLIED section on DailyMed. Every figure is US-marketed.
 * Sources sit on each record.
 *
 * Run:  node tools/apply-vial-sources.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, '..', 'data', 'peptides.json');

const db = JSON.parse(readFileSync(FILE, 'utf8'));
const byId = Object.fromEntries(db.peptides.map(p => [p.id, p]));
const log = [];

/**
 * @param {string} id
 * @param {number[]} labelSizes - Marketed strengths, in the record's vialUnit
 * @param {string} labelSource  - What product, and how it is supplied
 */
function sourced(id, labelSizes, labelSource) {
    const p = byId[id];
    if (!p) throw new Error(`no such peptide: ${id}`);

    // A marketed strength the catalogue did not offer gets added: the point of
    // the exercise is that the real sizes are present, not merely flagged.
    const before = [...p.vialSizes];
    const merged = [...new Set([...p.vialSizes, ...labelSizes])].sort((a, b) => a - b);
    p.vialSizes = merged;
    p.labelSizes = labelSizes;
    p.labelSource = labelSource;
    p.vialSizeSource = labelSizes.length === 0 ? 'vendor'
        : merged.every(s => labelSizes.includes(s)) ? 'label'
            : 'mixed';

    if (JSON.stringify(before) !== JSON.stringify(merged)) {
        log.push(`${id}.vialSizes: [${before}] -> [${merged}]`);
    }
    log.push(`${id}.vialSizeSource: ${p.vialSizeSource}  label=[${labelSizes}]`);
    log.push(`  ^ ${labelSource}`);
}

// ---------------------------------------------------------------------------
// The eight records classed `approved`. These are the only ones where a vial
// size can be sourced to anything at all.
// ---------------------------------------------------------------------------

// Trulicity is a single-dose pre-filled pen in exactly four strengths, and the
// catalogue already matched all four. Nothing to add - this is the only record
// in the file whose entire catalogue is label-anchored.
//   openFDA NDC: TRULICITY, INJECTION SOLUTION, 0.75 / 1.5 / 3 / 4.5 mg per 0.5 mL
sourced('dulaglutide', [0.75, 1.5, 3, 4.5],
    'Trulicity single-dose pre-filled pen - 0.75, 1.5, 3 and 4.5 mg per 0.5 ml');

// Mounjaro and Zepbound are marketed at six strengths. The catalogue was missing
// three of them while offering six that no approved product uses. Those larger
// sizes are compounded and research lyophilised vials; they stay, tagged. Note
// the approved product is a solution and is never reconstituted - the recon
// maths on this record only ever applied to the research powder.
//   openFDA NDC: Mounjaro / Zepbound, 2.5 / 5 / 7.5 / 10 / 12.5 / 15 mg per 0.5 mL
sourced('tirzepatide', [2.5, 5, 7.5, 10, 12.5, 15],
    'Mounjaro and Zepbound - 2.5 to 15 mg per 0.5 ml, supplied ready-made as a solution rather than as a powder. Sizes above 15 mg are compounded or research vials with no approved counterpart');

// Two approved tesamorelin products, two vial sizes, and the catalogue had one
// of them. EGRIFTA WR's 11.6 mg vial was missing entirely.
//   DailyMed: EGRIFTA SV 2 mg vial + 0.5 ml diluent, dose 1.4 mg
//   DailyMed: EGRIFTA WR 11.6 mg vial + 1.3 ml BAC water, dose 1.28 mg
sourced('tesamorelin', [2, 11.6],
    'EGRIFTA SV is supplied as a 2 mg vial and EGRIFTA WR as an 11.6 mg vial; their labelled daily doses are 1.4 mg and 1.28 mg');

// HCG is supplied in the US at 5,000 and 10,000 USP units. The 1,000 and 2,000
// unit entries match no marketed product; they stay for compounded vials, tagged.
//   DailyMed: NOVAREL 5,000 or 10,000 USP units per multiple-dose vial
//   DailyMed: PREGNYL 10,000 USP units per multiple-dose vial
sourced('hcg', [5000, 10000],
    'Novarel is supplied at 5,000 and 10,000 USP units and Pregnyl at 10,000 USP units, as multiple-dose vials');

// MENOPUR is supplied in the US only as a 75 IU vial. That is not a gap in the
// catalogue - it is the reason this record already carries `multiVial`.
//   DailyMed: MENOPUR 75 IU FSH + 75 IU LH activity per vial
sourced('hmg', [75],
    'MENOPUR 75 IU FSH + 75 IU LH per single-dose vial - the only US strength, which is why larger doses pool several vials');

// Somatropin, restricted to the lyophilised presentations that are actually
// reconstituted. Genotropin 5 and 12 mg and Humatrope 6, 12 and 24 mg cartridges
// are powder; Norditropin and Omnitrope are pre-filled solution pens and are
// deliberately excluded - nothing is drawn out of those into a syringe.
// Converted at the label's own 1 mg = 3 IU.
//   DailyMed: GENOTROPIN 5 mg and 12 mg cartridges
//   DailyMed: HUMATROPE 6 mg (18 IU), 12 mg (36 IU), 24 mg (72 IU) cartridges
sourced('hgh', [15, 18, 36, 72],
    'Genotropin 5 mg (15 IU) and 12 mg (36 IU), Humatrope 6 mg (18 IU), 12 mg (36 IU) and 24 mg (72 IU) lyophilised cartridges. Norditropin and Omnitrope are pre-filled solutions, so nothing is mixed or drawn from those');

// Epoetin alfa is sold by concentration per ml, at six strengths. The catalogue
// offered a 1,000 IU that does not exist and omitted the two largest.
//   openFDA NDC: EPOGEN / RETACRIT, 2000 / 3000 / 4000 / 10000 / 20000 / 40000 IU per mL
sourced('epo', [2000, 3000, 4000, 10000, 20000, 40000],
    'Epogen and Retacrit - 2,000 to 40,000 IU per ml, supplied as a ready-made solution in single-dose and multi-dose vials rather than as a powder');

// The record that inverts the exercise. PT-141 is classed `approved` because
// bremelanotide is an approved active - but Vyleesi is a 1.75 mg / 0.3 ml
// pre-filled autoinjector, so there is no approved *vial* of it at any size.
// Adding 1.75 to a list of vial sizes would imply a vial nobody sells, so the
// catalogue stays vendor-only and the note says why.
//   openFDA NDC: Vyleesi, INJECTION, 1.75 mg per 0.3 mL autoinjector
sourced('pt141', [],
    'Bremelanotide is approved as Vyleesi, a 1.75 mg / 0.3 ml pre-filled autoinjector. No approved product is supplied as a vial, so every size here is vendor convention');

// ---------------------------------------------------------------------------
// Everything else. No approved product exists, so no size can be sourced - and
// that is the fact worth putting on the screen, rather than leaving a column of
// unmarked numbers to look equally official.
// ---------------------------------------------------------------------------
const NO_PRODUCT = 'No FDA-approved product contains this compound, so no size here is a labelled strength - these are the sizes research vendors commonly supply';

for (const p of db.peptides) {
    if (p.vialSizeSource) continue;
    p.labelSizes = [];
    p.labelSource = NO_PRODUCT;
    p.vialSizeSource = 'vendor';
}

// Field order: keep the new keys beside the catalogue they describe rather than
// appended after pros/cons/warnings, so a human reading the JSON meets them in
// the right place.
db.peptides = db.peptides.map(p => {
    const out = {};
    for (const [k, v] of Object.entries(p)) {
        if (k === 'labelSizes' || k === 'labelSource' || k === 'vialSizeSource') continue;
        out[k] = v;
        if (k === 'vialSizes') {
            out.vialSizeSource = p.vialSizeSource;
            out.labelSizes = p.labelSizes;
            out.labelSource = p.labelSource;
        }
    }
    return out;
});

const counts = db.peptides.reduce((a, p) => (a[p.vialSizeSource] = (a[p.vialSizeSource] || 0) + 1, a), {});

db.schemaVersion = 5;
writeFileSync(FILE, JSON.stringify(db, null, 2) + '\n');
console.log(log.join('\n'));
console.log(`\nvialSizeSource: ${JSON.stringify(counts)}`);
console.log(`${db.peptides.length} records written to ${FILE}`);

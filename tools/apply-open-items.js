#!/usr/bin/env node
/**
 * Schema v4 - close the four items left OPEN by tools/apply-data-review.js.
 *
 * The v3 pass fixed doses that were wrong and stopped at anything that needed
 * evidence it did not have. This pass went and got the evidence.
 *
 *   OPEN 1  three `high` tiers exceeded the largest vial offered
 *   OPEN 2  fourteen vial sizes were convention, not evidence
 *   OPEN 3  dulaglutide is a pre-filled pen and does not reconstitute at all
 *   OPEN 4  no dose here was labelled by how well it is actually evidenced
 *
 * OPEN 2 is fixed in the UI rather than here: the vial-size dropdown now takes a
 * typed-in value, so the number that matters is the one printed on the user's own
 * vial rather than one of ours. The catalogue below stays as the default only.
 *
 * Sources are attached to each change. Run:  node tools/apply-open-items.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, '..', 'data', 'peptides.json');

const db = JSON.parse(readFileSync(FILE, 'utf8'));
const byId = Object.fromEntries(db.peptides.map(p => [p.id, p]));
const log = [];

function edit(id, changes, why) {
    const p = byId[id];
    if (!p) throw new Error(`no such peptide: ${id}`);
    for (const [k, v] of Object.entries(changes)) {
        const before = JSON.stringify(p[k]);
        p[k] = v;
        if (before !== JSON.stringify(v)) log.push(`${id}.${k}: ${before} -> ${JSON.stringify(v)}`);
    }
    if (why) log.push(`  ^ ${why}`);
}

// ---------------------------------------------------------------------------
// OPEN 1 - a `high` tier that needs more peptide than one vial holds.
//
// Three records were in this state. Two turned out to be wrong *doses* rather
// than missing vial sizes; one turned out to be right, and correct practice.
// ---------------------------------------------------------------------------

// AICAR. 50/100/200 mg daily for 8 weeks matched no source found. Published
// research-protocol write-ups converge on ~25 mg/day as the standard figure,
// with low-end protocols at 1-3 mg/day, and cap the run at about two weeks with
// a 1-2 month washout - not 8 weeks on / 4 off. 200 mg/day for 56 days is 11.2 g
// of AICAR, which is why the high tier needed two 100 mg vials per injection.
//   peptides.org/aicar-dosage-calculator, pepdose.com/aicar-dosage-calculator,
//   dosagepeptide.com AICAR 50 mg vial protocol
edit('aicar', {
    low: 10, med: 25, high: 50,
    vialSize: 50,
    wks: 2,
    cycle: '2 weeks max, 4-8 off',
    inst: [
        'Subcutaneous injection daily',
        'Standard research protocol is 25mg daily; conservative protocols start at 10mg',
        'Morning dosing may enhance fat oxidation',
        'Combine with exercise for synergistic effects',
        'Run no longer than 14 days, then wash out 4-8 weeks',
        'No more than about three courses a year'
    ]
}, '50/100/200mg matched no source; 25mg/day and a 2-week cap do');

// Dihexa. The 8/16/32 mg tiers are the ORAL range. This is a reconstitution and
// syringe calculator: subcutaneous community protocols run 2-5 mg daily in 4-6
// week blocks, roughly half the oral amount. Putting an oral figure through a
// subq draw is the same defect already fixed on glutathione, where an IV dose
// was being drawn into an insulin syringe.
//   thepeptidecatalog.com dihexa dosing guide, peptidedosage.org/peptides/dihexa,
//   pathtopeptides.com dihexa protocol
edit('dihexa', {
    low: 2000, med: 3000, high: 5000,
    wks: 6,
    cycle: '4-6 weeks',
    inst: [
        'Subcutaneous injection daily',
        'Subcutaneous protocols run 2-5mg daily - roughly half the oral amount',
        'The 8-45mg figures in circulation are ORAL doses and do not apply to a syringe draw',
        'Consistent daily use for 4-6 weeks',
        'Cycle off 2-4 weeks before repeating',
        'Monitor cognitive clarity and memory'
    ]
}, '8-32mg is the oral range; a subq calculator needs the subq range');

// HMG. This one was not a defect. Menotropins are supplied in the US only as
// 75 IU lyophilised vials (MENOPUR, Ferring); 150 IU vials are a grey-market
// size. Labelled dosing starts at 75-150 IU daily and is titrated upward, and
// pooling several vials into one syringe is the method the label itself
// describes. So 300 IU genuinely is four 75 IU vials, and that is procedure
// rather than an error - it just has to say so.
//   ferringusa.com/PI/Menopur, medicines.org.uk/emc/product/1294/smpc
edit('hmg', {
    vialSize: 75,
    multiVial: true,
    multiVialNote: 'Menotropins are supplied as 75 IU vials. Reconstituting several vials '
        + 'into a single syringe is the method described on the label, so a dose above one '
        + 'vial is normal practice here rather than an error.',
    inst: [
        'Subcutaneous or IM injection',
        '3 times per week (every other day)',
        'Supplied as 75 IU vials - higher doses are several vials pooled into one syringe',
        'Use during PCT or fertility treatment',
        'Monitor testosterone and estrogen',
        'Cycle 3-6 weeks maximum'
    ]
}, '300 IU is real; 75 IU is the real vial. Multi-vial pooling is the labelled method');

// ---------------------------------------------------------------------------
// OPEN 3 - dulaglutide does not reconstitute.
//
// Trulicity ships as a single-dose pre-filled pen at a fixed strength. There is
// no powder, no bacteriostatic water and no draw. The calculator was computing a
// reconstitution volume for it anyway - harmless but meaningless, which is worse
// than useless on a page whose whole job is telling you what to pull to.
// ---------------------------------------------------------------------------
edit('dulaglutide', {
    noRecon: true,
    device: 'pen',
    deviceNote: 'Trulicity is a single-dose pre-filled pen. The dose is the pen strength you '
        + 'are prescribed - there is nothing to reconstitute and nothing to draw. The strengths '
        + 'listed are the marketed pen sizes.',
    inst: [
        'Weekly subcutaneous injection from a single-dose pre-filled pen',
        'No reconstitution - the pen is supplied ready to inject',
        'Dose is fixed by the pen strength: 0.75, 1.5, 3 or 4.5 mg',
        'Any time of day, same day each week',
        'Titrate 0.75mg -> 1.5mg -> 3mg -> 4.5mg at 4-week intervals as tolerated',
        'Take with food if nausea occurs',
        'Monitor blood glucose and weight'
    ]
}, 'pre-filled pen: a reconstitution draw for it is meaningless');

// ---------------------------------------------------------------------------
// Fallout from OPEN 2: instructions must not restate a user input.
//
// Once vial size is typed rather than picked from our list, any instruction that
// names one can contradict the form. Selecting a 7.5 mg vial left BPC-157's own
// protocol sheet saying "Reconstitute 5mg vial with 3ml bacteriostatic water"
// directly under a header reading 7.5 mg. Only one record did this. The advice
// itself is worth keeping -- it is the hardcoded numbers that have to go.
// ---------------------------------------------------------------------------
edit('bpc157', {
    inst: byId['bpc157'].inst.map(line => line.startsWith('Reconstitute 5mg vial')
        ? 'Reconstitute with bacteriostatic water - use the vial size and volume set above'
        : line)
}, 'instruction restated a vial size the user now chooses');

// ---------------------------------------------------------------------------
// OPEN 4 - label every dose by how well it is evidenced.
//
// The site carried one blanket disclaimer covering all 44 records equally, which
// flattens a Mounjaro label dose and a forum figure for a compound that has never
// been in a human into the same claim. Three classes, assigned per record:
//
//   approved   an FDA-approved product with this active is marketed, and the
//              tiers here are anchored to its labelled strengths
//   trial      published human clinical trial data exists at comparable doses;
//              the compound itself is not approved for this use
//   convention no human dosing study at all - vendor and forum figures
//              extrapolated from animal work
// ---------------------------------------------------------------------------
const EVIDENCE = {
    approved: ['dulaglutide', 'tirzepatide', 'tesamorelin', 'hcg', 'hmg', 'hgh', 'epo', 'pt141'],
    trial: ['ace031', 'aod9604', 'ara290', 'cagrilintide', 'cagrisema', 'cjc1295',
        'ghrp2', 'ghrp6', 'gonadorelin', 'hexarelin', 'retatrutide', 'sermorelin']
};

for (const p of db.peptides) {
    const cls = EVIDENCE.approved.includes(p.id) ? 'approved'
        : EVIDENCE.trial.includes(p.id) ? 'trial'
            : 'convention';
    if (p.evidence !== cls) log.push(`${p.id}.evidence: ${p.evidence ?? 'none'} -> ${cls}`);
    p.evidence = cls;
}

db.schemaVersion = 4;

writeFileSync(FILE, JSON.stringify(db, null, 2) + '\n');
console.log(log.join('\n'));
console.log(`\n${log.filter(l => !l.startsWith('  ')).length} field changes written to ${FILE}`);

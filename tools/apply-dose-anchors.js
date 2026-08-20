#!/usr/bin/env node
/**
 * Schema v6 - stop the `approved` badge over-claiming, and fix the three
 * records whose own text or label contradicted their dose tiers.
 *
 * Found by reading the rendered PT-141 page after the v5 provenance work went
 * in. The card said, in three places at once:
 *
 *   FDA-APPROVED DRUG - "the doses here are anchored to its labelled strengths"
 *   None of these sizes is a marketed strength (Vyleesi is a 1.75 mg autoinjector)
 *   MAXIMUM DOSE 2.5 mg          <- 43% above the only labelled dose
 *   "Can increase to 1000-1500mcg if tolerated"   <- and its own text said 1.5
 *
 * Three separate claims about the same compound, no two of which agreed. The
 * badge text was written once for eight records and is true of four of them.
 *
 * Sources sit on each change. Run:  node tools/apply-dose-anchors.js
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
// 1. Tiers that exceeded the label, or the record's own instructions
// ---------------------------------------------------------------------------

// PT-141. The only approved dose of bremelanotide is 1.75 mg subcutaneous, and
// the label caps it at one dose in 24 hours and 8 doses a month. The record
// offered 2.5 mg as its MAXIMUM tier while its own instructions said not to go
// past 1.5 mg. Ceiling moves to the labelled dose; low and med keep the
// titration the instructions already described.
//   DailyMed VYLEESI: "1.75 mg administered subcutaneously in the abdomen or
//   thigh, as needed, at least 45 minutes before anticipated sexual activity";
//   "should not administer more than one dose within 24 hours"; "more than 8
//   doses per month is not recommended". Phase 3 RECONNECT used 1.75 mg SC.
edit('pt141', {
    low: 0.5, med: 1, high: 1.75,
    inst: [
        'Inject 45-60 minutes before sexual activity',
        'Subcutaneous abdominal or thigh injection',
        'Start with 0.5mg to assess nausea',
        'Can increase to 1mg, then to 1.75mg - the approved Vyleesi dose and the ceiling here',
        'No more than one dose in 24 hours, and no more than 8 doses a month',
        'Take with anti-nausea medication if needed',
        'Effects last 2-4 hours typically'
    ]
}, 'high tier was 2.5mg - above the labelled 1.75mg and above its own instruction text');

// ARA-290. The record read "Higher doses (2-4mg) for severe neuropathy" beside a
// 6 mg maximum tier, and 2 and 6 mg are not arms of any published trial. The
// phase 2 study in painful sarcoid neuropathy randomised daily subcutaneous
// 1, 4 or 8 mg for 28 days (n=64), with the nerve-regrowth signal at 4 mg.
// Tiers move onto those arms, which is the same anchor the v3 pass used for
// cagrilintide and retatrutide.
//   Araim/Culver et al. phase 2, cibinetide 1/4/8 mg SC daily x 28 days
edit('ara290', {
    low: 1000, med: 4000, high: 8000,
    inst: [
        'Subcutaneous injection daily',
        'Trial arms were 1, 4 and 8mg daily for 28 days - the nerve-regrowth signal was at 4mg',
        'Commit to 12 weeks for full effects',
        'Can combine with other nerve support',
        'Monitor pain levels and nerve function'
    ]
}, 'tiers 2/4/6mg included two figures that are not trial arms; text capped at 4mg beside a 6mg tier');

// Tesamorelin. Three approved formulations, three labelled daily doses, and the
// record used none of them - its 2.5 mg maximum is 79% above EGRIFTA WR's dose
// and above every other. Worth knowing while reading the ladder: these are not
// escalating strengths, they are the same systemic exposure delivered by three
// different formulations, so the instruction says so.
//   DailyMed EGRIFTA WR 1.28 mg daily; EGRIFTA SV 1.4 mg daily;
//   original EGRIFTA (1 mg/vial) 2 mg daily. The SV label states 1.4 mg SV and
//   2 mg original EGRIFTA give similar Cmax and AUC.
edit('tesamorelin', {
    low: 1.28, med: 1.4, high: 2,
    inst: [
        'Once-daily subcutaneous injection into the abdomen',
        'These three are the labelled daily doses of the three formulations, not an escalating ladder',
        'EGRIFTA WR 1.28mg, EGRIFTA SV 1.4mg and the original EGRIFTA 2mg give similar systemic exposure',
        'Rotate injection sites to limit local reactions',
        'Effect on visceral fat is assessed at 6 months, not weeks',
        'Reconstitute with the vial size and volume set above'
    ]
}, 'tiers 1/2/2.5mg matched no labelled dose; 2.5mg exceeded all three');

// ---------------------------------------------------------------------------
// 2. What the `approved` badge is actually entitled to claim
//
// `evidence: approved` says an approved product with this active is marketed.
// The badge text went further - "the doses here are anchored to its labelled
// strengths" - and that is true of four of the eight. The other four carry
// community and off-label protocol figures that no label prints. Split the
// claim rather than soften it for everyone.
//
//   label     no tier exceeds a dose or strength on the approved label
//   protocol  the tiers are community or off-label practice
// ---------------------------------------------------------------------------
const ANCHOR = {
    // Every tier is a marketed strength of the pen itself.
    dulaglutide: 'label',
    // 2.5 / 5 / 15 mg are Mounjaro and Zepbound strengths; 15 mg is the maximum.
    tirzepatide: 'label',
    // Fixed above: the three formulations' labelled daily doses.
    tesamorelin: 'label',
    // Fixed above: ceiling is now the labelled 1.75 mg.
    pt141: 'label',

    // 250-1000 IU is fertility-clinic and TRT-adjunct practice. The label's own
    // regimens start at 1,000 IU and run to 10,000 IU for a different purpose.
    hcg: 'protocol',
    // MENOPUR's label starts at 225 IU under monitoring in an ART cycle. 75-300
    // IU here is protocol use, not a labelled regimen.
    hmg: 'protocol',
    // 1-4 IU/day is bodybuilding convention. Labelled adult growth-hormone
    // deficiency dosing is far lower and titrated to IGF-1.
    hgh: 'protocol',
    // Labelled epoetin dosing is weight-based and titrated to haemoglobin, with
    // a boxed warning about exceeding target. Flat 1,000-5,000 IU is not that.
    epo: 'protocol'
};

for (const p of db.peptides) {
    const anchor = ANCHOR[p.id] || null;
    if (p.evidence === 'approved' && !anchor) {
        throw new Error(`${p.id} is classed approved but has no dose anchor`);
    }
    if (anchor && p.evidence !== 'approved') {
        throw new Error(`${p.id} has a dose anchor but is not classed approved`);
    }
    if (p.doseAnchor !== anchor) log.push(`${p.id}.doseAnchor: ${p.doseAnchor ?? 'none'} -> ${anchor}`);
    if (anchor) p.doseAnchor = anchor;
    else delete p.doseAnchor;
}

db.schemaVersion = 6;
writeFileSync(FILE, JSON.stringify(db, null, 2) + '\n');
console.log(log.join('\n'));
console.log(`\n${log.filter(l => !l.startsWith('  ')).length} field changes written to ${FILE}`);

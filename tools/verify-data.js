#!/usr/bin/env node
/**
 * Independent data verification for data/peptides.json.
 *
 * Deliberately does NOT reuse the assertions in test/. Those were written
 * alongside the fixes they guard, so they can only confirm what was already
 * known. This walks every record from scratch and asks a different set of
 * questions -- mostly "does this record agree with itself?", which is the class
 * that produced cortagen/crystagen (freq said Daily, dosing was weekly).
 *
 *   node tools/verify-data.js          human-readable report
 *   node tools/verify-data.js --json   machine-readable
 *
 * Exit code is 1 if any ERROR-severity finding survives.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    performCalculation, defaultReconMl, toVialUnits,
    dosesPerCycle, SYRINGE_SIZES, RECON_VOLUMES
} from '../js/calculator.js';
import { parseFreqRange, parseCycleWeeks } from './freq-parse.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB = JSON.parse(readFileSync(join(ROOT, 'data/peptides.json'), 'utf8'));
const PEPTIDES = DB.peptides;

const findings = [];
const add = (sev, id, check, msg) => findings.push({ sev, id, check, msg });
const err = (...a) => add('ERROR', ...a);
const warn = (...a) => add('WARN', ...a);
const note = (...a) => add('NOTE', ...a);

const LEVELS = ['low', 'med', 'high'];

/* ------------------------------------------------------------------ *
 * Plausibility envelopes.
 *
 * Not opinions about what anyone should take -- outer bounds that no
 * record in this catalogue should ever cross. A value outside one of
 * these is a units/dimension error, not a dosing preference.
 * ------------------------------------------------------------------ */
const DOSE_ENVELOPE = {
    mcg: { min: 1, max: 20000 },       // 1mcg .. 20mg stated in mcg
    // 5mcg .. 2g. The ceiling is deliberately far above a peptide dose: NAD+ and
    // glutathione are dosed in hundreds of milligrams and are not unit errors.
    // A tighter bound flagged both and found nothing real -- a check that only
    // ever fires on the two records you already know about is not a check.
    mg: { min: 0.005, max: 2000 },
    IU: { min: 1, max: 50000 }
};

/** Vial units per ml above which the powder is unlikely to actually dissolve. */
const SOLUBILITY_WATCH_MG_PER_ML = 400;

/* ------------------------------------------------------------------ *
 * 1. Schema and enumerations
 * ------------------------------------------------------------------ */
const REQUIRED = [
    'id', 'name', 'category', 'doseUnit', 'low', 'med', 'high',
    'vialUnit', 'vialSize', 'vialSizes', 'vialSizeSource', 'reconMl',
    'f', 'wks', 'freq', 'cycle', 'evidence', 'inst'
];
const EVIDENCE = new Set(['approved', 'trial', 'convention']);
const VIAL_SRC = new Set(['label', 'mixed', 'vendor']);
const UNITS = new Set(['mcg', 'mg', 'IU']);

const seenId = new Map();
const seenName = new Map();

for (const p of PEPTIDES) {
    const id = p.id || '(no id)';

    for (const k of REQUIRED) {
        if (p[k] === undefined || p[k] === null) err(id, 'schema', `missing required field \`${k}\``);
    }
    if (!EVIDENCE.has(p.evidence)) err(id, 'schema', `evidence "${p.evidence}" is not one of ${[...EVIDENCE].join('/')}`);
    if (!VIAL_SRC.has(p.vialSizeSource)) err(id, 'schema', `vialSizeSource "${p.vialSizeSource}" is not one of ${[...VIAL_SRC].join('/')}`);
    if (!UNITS.has(p.doseUnit)) err(id, 'schema', `doseUnit "${p.doseUnit}" is not a known unit`);
    if (!UNITS.has(p.vialUnit)) err(id, 'schema', `vialUnit "${p.vialUnit}" is not a known unit`);

    if (seenId.has(p.id)) err(id, 'schema', `duplicate id, also used by "${seenId.get(p.id)}"`);
    seenId.set(p.id, p.name);
    const nk = (p.name || '').toLowerCase().trim();
    if (seenName.has(nk)) warn(id, 'schema', `duplicate display name with \`${seenName.get(nk)}\``);
    seenName.set(nk, p.id);

    if (!/^[a-z0-9_]+$/.test(p.id || '')) err(id, 'schema', `id is not url-safe lowercase`);
}

/* ------------------------------------------------------------------ *
 * 2. Units and magnitudes -- the dimension-error class
 * ------------------------------------------------------------------ */
for (const p of PEPTIDES) {
    const id = p.id;
    const env = DOSE_ENVELOPE[p.doseUnit];

    for (const lvl of LEVELS) {
        const v = p[lvl];
        if (typeof v !== 'number' || !Number.isFinite(v)) { err(id, 'dose', `${lvl} is not a finite number (${v})`); continue; }
        if (v <= 0) err(id, 'dose', `${lvl} is ${v} -- a dose cannot be zero or negative`);
        if (env && (v < env.min || v > env.max)) {
            err(id, 'dose-magnitude', `${lvl} = ${v}${p.doseUnit} is outside the plausible ${env.min}-${env.max}${p.doseUnit} envelope -- likely a unit error`);
        }
    }
    if (!(p.low <= p.med && p.med <= p.high)) {
        err(id, 'dose', `tiers are not ascending: low=${p.low} med=${p.med} high=${p.high}`);
    }
    if (p.low === p.high) note(id, 'dose', `all three tiers are identical (${p.low}${p.doseUnit}) -- the tier UI shows three copies of one number`);

    // A dose unit finer than the vial unit is fine (mcg dose from an mg vial).
    // The reverse -- an mg dose out of an IU vial, or vice versa -- cannot be
    // converted at all and is how HCG rendered "draw 0 units".
    const convertible = p.doseUnit === p.vialUnit || (p.doseUnit === 'mcg' && p.vialUnit === 'mg');
    if (!convertible) err(id, 'units', `dose is in ${p.doseUnit} but the vial is in ${p.vialUnit} -- these do not convert`);

    if (!Number.isFinite(p.vialSize) || p.vialSize <= 0) err(id, 'vial', `vialSize is ${p.vialSize}`);
    if (!Array.isArray(p.vialSizes) || !p.vialSizes.length) err(id, 'vial', `vialSizes is empty`);
    else {
        if (!p.vialSizes.includes(p.vialSize)) err(id, 'vial', `default vialSize ${p.vialSize} is not among the offered sizes [${p.vialSizes}]`);
        if (new Set(p.vialSizes).size !== p.vialSizes.length) warn(id, 'vial', `vialSizes has duplicates [${p.vialSizes}]`);
        if ([...p.vialSizes].sort((a, b) => a - b).join() !== p.vialSizes.join()) warn(id, 'vial', `vialSizes is not sorted ascending [${p.vialSizes}] -- the dropdown renders in array order`);
        for (const v of p.vialSizes) if (!Number.isFinite(v) || v <= 0) err(id, 'vial', `vialSizes contains ${v}`);
    }

    if (!p.noRecon && !RECON_VOLUMES.includes(p.reconMl)) {
        err(id, 'recon', `reconMl ${p.reconMl} is not one of the volumes the UI offers [${RECON_VOLUMES}] -- the dropdown cannot select this record's own default`);
    }
}

/* ------------------------------------------------------------------ *
 * 3. Records that contradict themselves
 * ------------------------------------------------------------------ */
for (const p of PEPTIDES) {
    const id = p.id;

    if (!Number.isFinite(p.f) || p.f <= 0) err(id, 'cycle', `f (doses per week) is ${p.f}`);
    if (!Number.isFinite(p.wks) || p.wks <= 0) err(id, 'cycle', `wks is ${p.wks}`);

    // freq prose vs the f field the maths uses
    const fr = parseFreqRange(p.freq);
    if (!fr) {
        // Not countable. Only a finding while the record still presents f as
        // though it were read off a protocol; `fAssumed` is the record owning it.
        if (p.fAssumed !== true) err(id, 'assumption-as-fact', `freq "${p.freq}" is not a countable cadence, so f=${p.f} is a house assumption -- set fAssumed so the page stops stating the cycle total flat`);
    } else if (p.f < fr.min - 0.01 || p.f > fr.max + 0.01) {
        err(id, 'self-contradiction', `freq reads "${p.freq}" (${fr.min}-${fr.max}/wk) but f = ${p.f} -- outside its own stated range; the maths uses f`);
    } else if (fr.min !== fr.max) {
        // The real finding. `f` is inside the range, so nothing is "wrong" --
        // but a range collapsed to one number is published as fact in the cycle
        // total, the vial count and the FAQ answer Google indexes.
        const declared = p.fMin !== undefined && p.fMax !== undefined;
        if (!declared) {
            err(id, 'range-as-fact', `freq is a range ("${p.freq}" = ${fr.min}-${fr.max}/wk) but only f=${p.f} is stored, so the cycle total and vial count are published at the ${p.f === fr.max ? 'ceiling' : p.f === fr.min ? 'floor' : 'midpoint'} with no range shown`);
        } else if (Math.abs(p.fMin - fr.min) > 0.001 || Math.abs(p.fMax - fr.max) > 0.001) {
            err(id, 'range-as-fact', `freq prose says ${fr.min}-${fr.max}/wk but fMin/fMax are ${p.fMin}/${p.fMax}`);
        }
    }
    if (p.fMin !== undefined || p.fMax !== undefined) {
        if (!(Number.isFinite(p.fMin) && Number.isFinite(p.fMax) && p.fMin > 0 && p.fMin <= p.fMax)) {
            err(id, 'cycle', `fMin/fMax are ${p.fMin}/${p.fMax}`);
        } else if (p.f < p.fMin || p.f > p.fMax) {
            err(id, 'cycle', `f=${p.f} sits outside its own fMin..fMax (${p.fMin}..${p.fMax})`);
        }
    }

    // cycle prose vs wks
    const cw = parseCycleWeeks(p.cycle);
    if (!cw && !p.dosesPerCycle && p.wksAssumed !== true) {
        err(id, 'assumption-as-fact', `cycle "${p.cycle}" names no dosing window, so wks=${p.wks} is a house assumption -- set wksAssumed`);
    }
    if (cw && cw.min !== cw.max && !p.dosesPerCycle && (p.wksMin !== cw.min || p.wksMax !== cw.max)) {
        err(id, 'range-as-fact', `cycle "${p.cycle}" is a ${cw.min}-${cw.max} week range but wksMin/wksMax are ${p.wksMin ?? '-'}/${p.wksMax ?? '-'}`);
    }
    if (cw && !p.dosesPerCycle) {
        if (p.wks < cw.min || p.wks > cw.max) {
            err(id, 'self-contradiction', `cycle reads "${p.cycle}" (${cw.min}-${cw.max} weeks on) but wks = ${p.wks}`);
        }
    }
    // A day-stated course must carry dosesPerCycle -- f x wks cannot express it.
    if (/\b\d+\s*days?\b/i.test(p.cycle || '') && !p.dosesPerCycle) {
        warn(id, 'cycle', `cycle "${p.cycle}" is stated in days but the record has no dosesPerCycle, so the count falls back to f x wks = ${p.f * p.wks}`);
    }
    if (p.dosesPerCycle !== undefined && (!Number.isFinite(p.dosesPerCycle) || p.dosesPerCycle <= 0)) {
        err(id, 'cycle', `dosesPerCycle is ${p.dosesPerCycle}`);
    }

    // Blend components must account for the whole vial.
    if (p.components) {
        const sum = p.components.reduce((s, c) => s + c.mg, 0);
        if (p.vialUnit === 'mg' && Math.abs(sum - p.vialSize) > 1e-6) {
            err(id, 'self-contradiction', `components sum to ${sum}mg but vialSize is ${p.vialSize}${p.vialUnit} -- the per-component split will be wrong`);
        }
        for (const c of p.components) {
            if (!c.name || !Number.isFinite(c.mg) || c.mg <= 0) err(id, 'components', `bad component ${JSON.stringify(c)}`);
        }
        if (p.components.length < 2) warn(id, 'components', `only one component listed -- a blend needs at least two`);
    }

    // Instruction prose that states a number the dose fields disagree with.
    // Strip per-kilogram figures first: "saturates near 1mcg/kg" is a threshold,
    // not a dose, and comparing it to the tiers reported a contradiction that
    // was not one.
    const instText = (p.inst || []).join(' ').replace(/\d[\d,.]*\s*mcg\s*\/\s*kg/gi, '');
    const mcgClaims = [...instText.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*mcg(?!\s*\/)/gi)].map(m => Number(m[1].replace(/,/g, '')));
    if (mcgClaims.length) {
        const doseMcg = LEVELS.map(l => p.doseUnit === 'mg' ? p[l] * 1000 : p.doseUnit === 'mcg' ? p[l] : null).filter(Boolean);
        if (doseMcg.length) {
            const lo = Math.min(...doseMcg), hi = Math.max(...doseMcg);
            // Ignore per-component figures on a blend: those are legitimately a
            // fraction of the combined tier.
            const parts = p.components ? p.components.length : 1;
            const outside = mcgClaims.filter(v => v > hi * 1.05 || v < (lo / parts) * 0.95);
            if (outside.length) {
                warn(id, 'self-contradiction', `instructions name ${outside.join(', ')}mcg but the tiers only span ${lo}-${hi}mcg${parts > 1 ? ` (${lo / parts}mcg per component)` : ''}`);
            }
        }
    }
}

/* ------------------------------------------------------------------ *
 * 4. What the calculator actually produces for every record
 *    -- every vial size x every recon volume, not just the defaults.
 * ------------------------------------------------------------------ */
let combos = 0;
for (const p of PEPTIDES) {
    const id = p.id;
    const vols = p.noRecon ? [null] : RECON_VOLUMES;

    for (const vs of p.vialSizes) {
        for (const ml of vols) {
            combos++;
            let r;
            try {
                r = performCalculation(p, { weightLbs: 180, vialSize: vs, reconMl: ml ?? undefined, syringe: 100 });
            } catch (e) {
                err(id, 'compute', `performCalculation threw at vial ${vs}, ${ml}ml: ${e.message}`);
                continue;
            }
            if (p.noRecon) continue;

            for (const lvl of LEVELS) {
                const u = r.syringeUnits[lvl];
                if (!Number.isFinite(u)) { err(id, 'compute', `${lvl} units is ${u} at vial ${vs}, ${ml}ml`); continue; }
                if (u <= 0) err(id, 'compute-zero', `${lvl} computes to ${u} units at vial ${vs}${p.vialUnit}, ${ml}ml -- a computed zero is as loud a failure as a computed 70,000`);
                else if (u < 1 && ml === defaultReconMl(p) && vs === p.vialSize) {
                    warn(id, 'unreadable-draw', `${lvl} is ${u} units at the record's own defaults -- below the smallest graduation on any insulin syringe`);
                }
                if (u > 100 && r.exceedsVial[lvl] === false && r.vialsPooled[lvl] === 1) {
                    // Over a 100u barrel but still inside one vial: a split
                    // injection. Only a finding if nothing on the record says so.
                    if (vs === p.vialSize && ml === defaultReconMl(p)) {
                        note(id, 'overflow-default', `${lvl} needs ${u} units at the record's own defaults -- more than a 100u barrel, so it is at least two injections`);
                    }
                }
            }
            if (r.exceedsVial.med && vs === p.vialSize && !r.multiVial) {
                err(id, 'exceeds-vial', `one med dose needs ${r.perDoseVials.med} vials at the default ${vs}${p.vialUnit} size, and the record has no pooling instruction -- this dose cannot be drawn`);
            }
            // A cycle that needs dozens of vials is usually a frequency or a
            // dose that was never sanity-checked against the vial it comes in.
            // The threshold sat at 60 and let cjc1295_nodac's 51 through -- a
            // figure that is itself 3x too high because `f` took the ceiling of
            // "1-3x daily". Bounds have to be tight enough to bite.
            // vialsNeeded does not depend on the water volume, so only report it
            // once rather than once per recon option.
            if (r.vialsNeeded > 25 && vs === p.vialSize && ml === defaultReconMl(p)) {
                warn(id, 'vial-count', `a full cycle at the med tier needs ${r.vialsNeeded} vials of ${vs}${p.vialUnit} (${r.dosesPerCycle} doses at f=${p.f}/wk)`);
            }
            if (p.vialUnit === 'mg' && ml && vs / ml > SOLUBILITY_WATCH_MG_PER_ML && vs === p.vialSize && ml === defaultReconMl(p)) {
                note(id, 'solubility', `the record's own default is ${vs}mg in ${ml}ml = ${Math.round(vs / ml)}mg/ml, above the ~${SOLUBILITY_WATCH_MG_PER_ML}mg/ml where lyophilised powder generally stops going into solution -- worth confirming against the vendor's own reconstitution note`);
            }
        }
    }
}

/* ------------------------------------------------------------------ *
 * 5. Evidence labelling vs the vial-size provenance
 * ------------------------------------------------------------------ */
for (const p of PEPTIDES) {
    const id = p.id;
    // approved + vendor sizes is legitimate when the approved product is not a
    // vial at all -- Vyleesi is an autoinjector, so no vendor vial can match a
    // label strength. Only a finding if labelSource does not say why.
    if (p.evidence === 'approved' && p.vialSizeSource === 'vendor'
        && !/autoinjector|pre-?filled|pen|no approved product is supplied as a vial/i.test(p.labelSource || '')) {
        warn(id, 'provenance', `labelled evidence=approved but every vial size is vendor convention, and labelSource does not explain why no size is a marketed strength`);
    }
    if (p.vialSizeSource !== 'vendor' && (!Array.isArray(p.labelSizes) || !p.labelSizes.length)) {
        err(id, 'provenance', `vialSizeSource is "${p.vialSizeSource}" but labelSizes is empty -- nothing backs the claim`);
    }
    if (Array.isArray(p.labelSizes)) {
        for (const s of p.labelSizes) {
            if (!p.vialSizes.includes(s)) warn(id, 'provenance', `labelSizes lists ${s}${p.vialUnit}, which the dropdown does not offer`);
        }
    }
    if (!p.labelSource || p.labelSource.length < 10) err(id, 'provenance', `labelSource is missing or too short to mean anything`);

    // doseAnchor is an enum -- 'label' (no dose here exceeds the label) or
    // 'protocol' (off-label figures). It is not a citation string; checking it
    // for prose length reported eight empty anchors that were all fine.
    const ANCHORS = new Set(['label', 'protocol']);
    if (p.doseAnchor !== undefined && !ANCHORS.has(p.doseAnchor)) {
        err(id, 'provenance', `doseAnchor "${p.doseAnchor}" is not one of ${[...ANCHORS].join('/')}`);
    }
    if (p.evidence === 'approved' && !p.doseAnchor) {
        err(id, 'provenance', `evidence=approved with no doseAnchor, so the badge claims label backing for doses nothing has checked`);
    }
    if (p.evidence !== 'approved' && p.doseAnchor) {
        err(id, 'provenance', `doseAnchor "${p.doseAnchor}" on a record that is not approved -- the UI ignores it, so it reads as backing that never renders`);
    }
    // A 'label' anchor promises no dose here exceeds a labelled dose. Where
    // labelled doses are actually known, hold it to that promise.
    if (p.doseAnchor === 'label' && Array.isArray(p.labelDoses) && p.labelDoses.length) {
        const ceiling = Math.max(...p.labelDoses);
        if (p.high > ceiling + 1e-9) {
            err(id, 'provenance', `doseAnchor is "label" but the high tier (${p.high}${p.doseUnit}) exceeds the highest labelled dose (${ceiling}${p.doseUnit})`);
        }
    }
}

/* ------------------------------------------------------------------ *
 * 6. Prose fields -- placeholders, truncation, encoding damage
 * ------------------------------------------------------------------ */
const PROSE = ['name', 'category', 'research', 'mechanism', 'halfLife', 'freq', 'cycle', 'labelSource', 'doseAnchor'];
const LISTS = ['pros', 'cons', 'warnings', 'inst'];
for (const p of PEPTIDES) {
    const id = p.id;
    const all = [];
    for (const k of PROSE) if (typeof p[k] === 'string') all.push([k, p[k]]);
    for (const k of LISTS) if (Array.isArray(p[k])) p[k].forEach((v, i) => all.push([`${k}[${i}]`, v]));

    for (const [k, v] of all) {
        if (typeof v !== 'string') { err(id, 'prose', `${k} is not a string`); continue; }
        if (!v.trim()) err(id, 'prose', `${k} is empty`);
        if (/\b(TODO|TBD|FIXME|XXX|lorem ipsum|placeholder)\b/i.test(v)) err(id, 'prose', `${k} still contains a placeholder: "${v.slice(0, 60)}"`);
        if (/[�]|Ã.|â€/.test(v)) err(id, 'prose', `${k} has mojibake / encoding damage: "${v.slice(0, 60)}"`);
        if (/\s{3,}/.test(v)) warn(id, 'prose', `${k} has a run of 3+ spaces -- usually a botched find-replace`);
        if (v.trim() !== v) warn(id, 'prose', `${k} has leading or trailing whitespace`);
    }
    for (const k of LISTS) {
        if (!Array.isArray(p[k]) || !p[k].length) err(id, 'prose', `${k} is empty -- the card renders a blank panel`);
        else if (new Set(p[k].map(s => s.toLowerCase().trim())).size !== p[k].length) warn(id, 'prose', `${k} has duplicate entries`);
    }
    if (!(p.warnings || []).length) err(id, 'prose', `no warnings at all on a compound that gets injected`);
}

/* ------------------------------------------------------------------ *
 * 7. Every record reachable from the UI and the generated pages
 * ------------------------------------------------------------------ */
import { existsSync } from 'node:fs';
for (const p of PEPTIDES) {
    const page = join(ROOT, 'p', p.id, 'index.html');
    if (!existsSync(page)) err(p.id, 'pages', `no generated page at p/${p.id}/`);
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
const bySev = s => findings.filter(f => f.sev === s);
const errors = bySev('ERROR'), warns = bySev('WARN'), notes = bySev('NOTE');

if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ records: PEPTIDES.length, combosChecked: combos, findings }, null, 2));
} else {
    const line = f => `  [${f.check}] ${f.id}: ${f.msg}`;
    console.log(`\nphenom-vital-labs :: independent data verification`);
    console.log(`records: ${PEPTIDES.length}   schema v${DB.schemaVersion}   vial x recon combinations computed: ${combos}\n`);
    for (const [label, list] of [['ERROR', errors], ['WARN', warns], ['NOTE', notes]]) {
        console.log(`${label} (${list.length})`);
        if (!list.length) console.log('  none');
        else list.forEach(f => console.log(line(f)));
        console.log('');
    }
}

process.exit(errors.length ? 1 : 0);

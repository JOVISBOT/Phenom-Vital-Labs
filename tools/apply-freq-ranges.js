#!/usr/bin/env node
/**
 * Give ranged cadences a range to live in.
 *
 * Thirteen records state a frequency range in prose -- "2-3x daily",
 * "Daily or 3x weekly", "Every 2-3 days" -- and store a single `f`. Everything
 * downstream then publishes the collapsed figure as fact: the injections-per-
 * cycle total, the vials-needed count, and the FAQ answer that goes into the
 * JSON-LD Google indexes. cjc1295_nodac's page said "a typical course runs
 * 12 on, 4 off, which is 252 injections" and "about 51 2mg vials" -- true only
 * for someone dosing three times a day, which is the top of a 1-3x range. At
 * once daily it is 84 injections and 17 vials.
 *
 * This writes `fMin`/`fMax` (doses per week) alongside the existing `f`, and
 * `wksMin`/`wksMax` where the cycle prose gives a week range. `f` and `wks` are
 * left untouched so no existing figure silently moves; the range is additive,
 * and the UI renders it instead of the point estimate where one exists.
 *
 * Records whose cadence is not countable at all -- "Multiple daily",
 * "As needed", "Research only", "Intermittent" -- get `fAssumed: true` so the
 * page can say the cycle total rests on an assumption rather than stating it
 * flat.
 *
 *   node tools/apply-freq-ranges.js --dry     show the diff, write nothing
 *   node tools/apply-freq-ranges.js           apply
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseFreqRange, parseCycleWeeks } from './freq-parse.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'data/peptides.json');
const DRY = process.argv.includes('--dry');

const db = JSON.parse(readFileSync(FILE, 'utf8'));
const log = [];

const r4 = n => Math.round(n * 10000) / 10000;

for (const p of db.peptides) {
    const fr = parseFreqRange(p.freq);

    if (!fr) {
        // Not a countable cadence. `f` is a working assumption, and the page
        // should say so rather than printing a total as though it were read off
        // a protocol.
        if (p.fAssumed !== true) { log.push(`${p.id}.fAssumed: -> true   (freq "${p.freq}" is not countable, f=${p.f})`); p.fAssumed = true; }
        delete p.fMin; delete p.fMax;
    } else if (fr.min !== fr.max) {
        const min = r4(fr.min), max = r4(fr.max);
        if (p.fMin !== min || p.fMax !== max) {
            log.push(`${p.id}.fMin/fMax: ${p.fMin ?? '-'}/${p.fMax ?? '-'} -> ${min}/${max}   (freq "${p.freq}", f stays ${p.f})`);
            p.fMin = min; p.fMax = max;
        }
        delete p.fAssumed;
    } else {
        // A single unambiguous cadence needs no range and no caveat.
        if (p.fMin !== undefined || p.fMax !== undefined) log.push(`${p.id}: dropping stale fMin/fMax`);
        delete p.fMin; delete p.fMax; delete p.fAssumed;
    }

    const cw = parseCycleWeeks(p.cycle);
    if (p.dosesPerCycle) {
        // A day-stated course counts its own doses; weeks do not enter into it.
        delete p.wksMin; delete p.wksMax; delete p.wksAssumed;
    } else if (!cw) {
        // "Continuous OK", "As needed", "6 months minimum" -- the prose names no
        // dosing window, so `wks` is a house assumption. Say so rather than
        // printing a cycle total as though the record stated one.
        if (p.wksAssumed !== true) { log.push(`${p.id}.wksAssumed: -> true   (cycle "${p.cycle}" names no week count, wks=${p.wks})`); p.wksAssumed = true; }
        delete p.wksMin; delete p.wksMax;
    } else if (cw.min !== cw.max) {
        if (p.wksMin !== cw.min || p.wksMax !== cw.max) {
            log.push(`${p.id}.wksMin/wksMax: ${p.wksMin ?? '-'}/${p.wksMax ?? '-'} -> ${cw.min}/${cw.max}   (cycle "${p.cycle}", wks stays ${p.wks})`);
            p.wksMin = cw.min; p.wksMax = cw.max;
        }
        delete p.wksAssumed;
    } else {
        if (p.wksMin !== undefined || p.wksMax !== undefined) log.push(`${p.id}: dropping stale wksMin/wksMax`);
        delete p.wksMin; delete p.wksMax; delete p.wksAssumed;
    }
}

db.schemaVersion = 7;

console.log(log.length ? log.join('\n') : 'no changes');
console.log(`\n${log.length} change(s)${DRY ? ' (dry run, nothing written)' : ''}`);

if (!DRY) {
    writeFileSync(FILE, JSON.stringify(db, null, 2) + '\n');
    console.log(`wrote ${FILE} at schemaVersion ${db.schemaVersion}`);
}

/**
 * Mix & cycle planner page controller.
 *
 * The calculator answers "how many units do I draw". This page answers the
 * three questions that come after it and that nothing on the site addressed:
 *
 *   1. How much water should go in, so the draw lands on a mark I can read?
 *   2. Where is this vial - how much is left, and does it run out or expire?
 *   3. How many vials does the whole run take, and when do I mix each one?
 *
 * All arithmetic lives in js/planner.js and is tested there. This file is DOM
 * only: read the form, call the pure functions, write the result.
 *
 * @module plan
 */

import { loadPeptideData } from './dataLoader.js';
import { calculateDose, defaultReconMl, splitBlendDose, SYRINGE_SIZES, DEFAULT_SYRINGE } from './calculator.js';
import {
    reconOptions, vialProjection, cyclePlan,
    toISO, addDays, daysBetween, parseDate,
    SHELF_LIFE_DAYS, TYPICAL_VIAL_CAPACITY_ML
} from './planner.js';
import * as store from './planStore.js';
import { track } from './analytics.js';
import { initThemeToggle } from './theme.js';
import { enhanceSelect } from './combobox.js';

const $ = id => document.getElementById(id);

let records = [];
let byId = new Map();

/** Escape anything written into innerHTML. */
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

/** Trim trailing zeros. */
function n(value, dp = 2) {
    return String(Number(Number(value).toFixed(dp)));
}

/** Same, with thousands separators, for totals rather than measurements. */
function big(value, dp = 2) {
    return Number(Number(value).toFixed(dp)).toLocaleString('en-GB');
}

/** Today, in the visitor's own timezone, as ISO. */
function todayISO() {
    const d = new Date();
    return toISO(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12)));
}

/**
 * A date written the way a person reads one, plus how far away it is.
 * "25 Sep 2026 (36 days)" beats an ISO string on a page about calendars.
 */
function humanDate(iso, from) {
    const dt = parseDate(iso);
    if (!dt) return '--';
    const label = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    if (!from) return label;
    const days = daysBetween(from, iso);
    if (days === null) return label;
    if (days === 0) return `${label} (today)`;
    return days > 0 ? `${label} (in ${days} day${days === 1 ? '' : 's'})`
                    : `${label} (${-days} day${days === -1 ? '' : 's'} ago)`;
}

/* ------------------------------------------------------------------ inputs */

function readForm() {
    const peptide = byId.get($('peptide').value) || null;
    const num = id => {
        const v = parseFloat($(id).value);
        return Number.isFinite(v) ? v : null;
    };
    return {
        peptide,
        peptideId: peptide ? peptide.id : '',
        vialSize: num('vialSize'),
        reconMl: num('reconMl'),
        doseAmount: num('doseAmount'),
        dosesPerWeek: num('dosesPerWeek'),
        syringe: num('syringe') || DEFAULT_SYRINGE,
        diluent: $('diluent').value === 'sterile' ? 'sterile' : 'bac',
        mixDate: $('mixDate').value || '',
        dosesTaken: $('dosesTaken').value === '' ? null : num('dosesTaken'),
        mlLeft: $('mlLeft').value === '' ? null : num('mlLeft'),
        startDate: $('startDate').value || '',
        weeksOn: num('weeksOn'),
        weeksOff: num('weeksOff') ?? 0
    };
}

function writeForm(state) {
    const set = (id, v) => { if (v !== undefined && v !== null && v !== '') $(id).value = String(v); };
    set('peptide', state.peptideId);
    set('vialSize', state.vialSize);
    set('reconMl', state.reconMl);
    set('doseAmount', state.doseAmount);
    set('dosesPerWeek', state.dosesPerWeek);
    set('syringe', state.syringe);
    set('diluent', state.diluent);
    set('mixDate', state.mixDate);
    if (state.dosesTaken !== null && state.dosesTaken !== undefined) set('dosesTaken', state.dosesTaken);
    if (state.mlLeft !== null && state.mlLeft !== undefined) set('mlLeft', state.mlLeft);
    set('startDate', state.startDate);
    set('weeksOn', state.weeksOn);
    set('weeksOff', state.weeksOff);
}

/**
 * Tell the dose box what the number in it means.
 *
 * A blend vial holds two peptides, and `vialSize` is their sum - so the dose
 * the arithmetic wants is the combined figure, while the dose a person carries
 * in their head is per peptide. 400mcg of a 5mg+5mg blend is 200mcg of each.
 * Left unsaid, someone who takes "167mcg of each" types 167 and is quietly
 * planned at half their own protocol. The calculator already splits a blend
 * dose out; this page has to say the same thing at the point of entry.
 *
 * @param {Object} peptide - record whose dose box is being labelled
 */
function setDoseContext(peptide) {
    $('doseUnit').textContent = peptide.doseUnit;
    const hint = $('doseHint');
    const parts = peptide.components || [];
    if (parts.length < 2) {
        hint.hidden = true;
        hint.textContent = '';
        return;
    }
    hint.hidden = false;
    hint.textContent = `Combined across ${parts.length === 2 ? 'both' : `all ${parts.length}`} `
        + `peptides in the vial (${parts.map(c => `${c.name} ${c.mg}mg`).join(' + ')}), `
        + `not the dose of each.`;
}

/**
 * Fill the dose, vial, water and cadence boxes from the record itself.
 *
 * A blank form on a page of eleven number inputs is a page nobody finishes.
 * These are the record's own published figures, and every one is editable -
 * the vial in the fridge is the authority, not our catalogue.
 */
function applyDefaults(peptide) {
    if (!peptide) return;
    $('doseAmount').value = calculateDose(peptide, 180, 'med');
    setDoseContext(peptide);
    $('vialSize').value = peptide.vialSize ?? '';
    $('vialUnit').textContent = peptide.vialUnit || 'mg';
    $('reconMl').value = defaultReconMl(peptide);
    $('dosesPerWeek').value = peptide.f ?? 7;
    $('weeksOn').value = peptide.wks ?? 8;
    if (!$('startDate').value) $('startDate').value = todayISO();
    if (!$('mixDate').value) $('mixDate').value = todayISO();
}

/* ----------------------------------------------------------------- render */

function card(title, body, opts = {}) {
    return `<section class="card plan-card${opts.tone ? ` tone-${opts.tone}` : ''}">
        <h2>${esc(title)}</h2>
        ${body}
    </section>`;
}

/**
 * The per-component line for a blend, so the combined dose the arithmetic used
 * is also shown the way the conventions state it. Empty string for anything
 * that is a single peptide.
 */
function blendSplit(peptide, doseAmount) {
    const parts = splitBlendDose(peptide, doseAmount);
    if (!parts || parts.length < 2) return '';
    return `<p class="note blend-split"><strong>${esc(n(doseAmount, 4))} ${esc(peptide.doseUnit)} combined</strong>
        is ${parts.map(c => `${esc(c.name)} <strong>${esc(big(c.mcg))} mcg</strong>`).join(' + ')}
        per injection. Dosing conventions for these compounds are stated per peptide, so this is
        the figure to compare them against.</p>`;
}

function renderMix(form) {
    const { peptide, doseAmount, vialSize, reconMl, syringe } = form;
    const r = reconOptions(peptide, doseAmount, { vialSize, syringe, currentMl: reconMl });

    if (!r.best) {
        return card('Mixing', `<p class="plan-warn" role="note">
            <strong>No water volume makes this dose drawable.</strong>
            ${esc(n(doseAmount))} ${esc(peptide.doseUnit)} is more peptide than a
            ${esc(n(vialSize))} ${esc(peptide.vialUnit || 'mg')} vial holds, and water dilutes
            rather than adds. This needs a larger vial or more than one vial per dose.
        </p>`, { tone: 'warn' });
    }

    const cur = r.current;
    const same = cur && cur.reconMl === r.best.reconMl;
    const lede = same
        ? `<p class="answer-lede">Your <strong>${esc(n(reconMl))} ml</strong> is already the best
             volume for this dose - it puts the draw on <strong>${esc(n(cur.drawUnits))} units</strong>${
                cur.mark === 'whole' ? ', a whole mark' : cur.mark === 'half' ? ', a half mark' : ''}.</p>`
        : `<p class="answer-lede">Mix with <strong>${esc(n(r.best.reconMl))} ml</strong> and the draw
             lands on <strong>${esc(n(r.best.drawUnits))} units</strong>.${cur
                ? ` At your ${esc(n(cur.reconMl))} ml it is ${esc(n(cur.drawUnits))} units${
                    !cur.fitsSyringe ? `, which does not fit a ${esc(syringe)}-unit barrel`
                    : !cur.solubilityOk ? ', at a concentration the powder may not reach'
                    : cur.mark === 'awkward' ? ', which is not a mark on the barrel' : ''}.` : ''}</p>`;

    const rows = r.options.map(o => {
        const flags = [];
        if (!o.fitsSyringe) flags.push(`over a ${syringe}u barrel`);
        if (!o.solubilityOk) flags.push('may not dissolve');
        if (!o.fitsTypicalVial) flags.push('may not fit the vial');
        if (o.usable && !o.readable) flags.push('too small to read');
        return `<tr class="${o.reconMl === r.best.reconMl ? 'is-featured' : ''}${o.usable ? '' : ' is-out'}">
            <th scope="row">${esc(n(o.reconMl))} ml${o.isCurrent ? ' <span class="tag">yours</span>' : ''}</th>
            <td>${esc(n(o.concentration))} ${esc(o.concentrationUnit)}</td>
            <td><strong>${esc(n(o.drawUnits))} u</strong></td>
            <td>${esc(o.dosesPerVial)}</td>
            <td>${flags.length ? `<span class="flag">${esc(flags.join('; '))}</span>` : esc(o.mark === 'whole' ? 'whole mark' : o.mark === 'half' ? 'half mark' : 'off-mark')}</td>
        </tr>`;
    }).join('');

    return card('Mixing', `${lede}
        <div class="working"><code>${esc(n(vialSize))} ${esc(peptide.vialUnit || 'mg')} &divide; ${esc(n(r.best.reconMl))} ml = ${esc(n(r.best.concentration))} ${esc(r.best.concentrationUnit)}
&rarr; ${esc(n(doseAmount, 4))} ${esc(peptide.doseUnit)} = ${esc(n(r.best.units / 100, 4))} ml = ${esc(n(r.best.drawUnits))} units</code></div>
        ${blendSplit(peptide, doseAmount)}
        <div class="table-scroll">
        <table class="data-table">
            <caption>Every water volume, for this dose on a ${esc(syringe)}-unit barrel</caption>
            <thead><tr><th scope="col">Water</th><th scope="col">Concentration</th><th scope="col">Draw</th><th scope="col">Doses/vial</th><th scope="col">Notes</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        </div>
        <p class="note">Water sets the concentration, not the amount of peptide - the vial holds
        ${esc(n(vialSize))} ${esc(peptide.vialUnit || 'mg')} however much you add. More water means a
        longer pull for the same dose, which is the one you can read. Volumes above
        ${TYPICAL_VIAL_CAPACITY_ML} ml are shown but not recommended: glass peptide vials are commonly
        2-3 ml and the water has to fit too.</p>`);
}

/** How the vial's position was arrived at, said on the figure itself. */
const SOURCE_TAG = {
    estimated: ' <span class="tag">estimated</span>',
    logged: ' <span class="tag">logged</span>',
    measured: ' <span class="tag">from the volume</span>'
};

/**
 * Say where the "doses used" figure came from, and what it cannot know.
 *
 * The measured case is the one that needs saying out loud: the millilitres are
 * a fact, but the dose COUNT printed beside them is back-calculated at the
 * current dose. If the run drifted across dose sizes, that count is not a
 * count of anything - while the volume, the empty date and the discard date
 * are all still exactly right, because none of them go through it.
 */
function sourceNote(v, dosesPerWeek) {
    if (v.dosesTakenSource === 'measured') {
        return `<p class="note">Working from the ${esc(n(v.mlLeft, 2))} ml you measured, so a
            dose change partway through this vial does not throw it off. The dose count beside it
            is worked back at the current draw - the millilitres and the dates are the figures to
            trust.</p>`;
    }
    if (v.dosesTakenSource === 'logged') {
        return `<p class="note">Working from the count you typed, at the current draw of
            ${esc(n(v.unitsPerDose))} units. If some of those doses were a different size, measure
            the millilitres left instead - a count only converts to volume at one dose size.</p>`;
    }
    if (v.dosesTakenSource === 'estimated') {
        return `<p class="note">Doses used is estimated from the mix date and
            ${esc(n(dosesPerWeek))} a week. Type the real count above to override it, or the
            millilitres left if your dose changed partway through.</p>`;
    }
    // A source with no wording says nothing rather than borrowing another's.
    return '';
}

function renderVial(form, today) {
    const { peptide, doseAmount, vialSize, reconMl, dosesPerWeek, mixDate, dosesTaken, mlLeft, diluent } = form;
    if (!mixDate) {
        return card('This vial', `<p class="note">Add the date you mixed it and this fills in.</p>`);
    }
    const v = vialProjection({
        vialSize, reconMl, doseAmount, doseUnit: peptide.doseUnit,
        dosesPerWeek, mixDate, today, dosesTaken, mlLeft, diluent
    });
    if (!v) return card('This vial', `<p class="plan-warn" role="note">
        <strong>This dose cannot be drawn from this vial.</strong> See Mixing above - one dose of
        ${esc(n(doseAmount))} ${esc(peptide.doseUnit)} is more than a ${esc(n(vialSize))}
        ${esc(peptide.vialUnit || 'mg')} vial holds, so there is no vial life to project.</p>`, { tone: 'warn' });

    const shelf = SHELF_LIFE_DAYS[diluent];
    const expiryFirst = v.limiting === 'expiry';

    const headline = v.dosesLeft === 0 && !v.expired
        ? `<p class="answer-lede"><strong>This vial is finished.</strong> All
             ${esc(v.dosesPerVial)} doses are accounted for${v.dosesTakenEstimated
                ? ', estimated from the mix date' : ''}. Time to mix the next one.</p>`
        : v.expired
        ? `<p class="answer-lede tone-bad"><strong>This vial is past its window.</strong> Mixed
             ${esc(v.ageDays)} days ago; ${esc(diluent === 'sterile' ? 'plain sterile water' : 'bacteriostatic water')}
             holds ${esc(shelf.min)}${shelf.min === shelf.max ? '' : `-${esc(shelf.max)}`} day${shelf.max === 1 ? '' : 's'}.</p>`
        : `<p class="answer-lede"><strong>${esc(v.dosesLeft)} dose${v.dosesLeft === 1 ? '' : 's'} left</strong>
             - ${esc(n(v.mlLeft, 2))} ml of ${esc(n(reconMl))} ml. Empty on ${esc(humanDate(v.emptyDate, today))}.</p>`;

    const limitLine = expiryFirst && !v.expired
        ? `<p class="plan-warn" role="note"><strong>Expiry comes first, not empty.</strong>
             At ${esc(n(v.unitsPerDose))} units a dose this vial lasts ${esc(v.dosesPerVial)} doses, but the
             ${esc(shelf.min)}-day window closes on ${esc(humanDate(v.expiryMin, today))} with about
             ${esc(v.dosesLostToExpiry)} dose${v.dosesLostToExpiry === 1 ? '' : 's'} still in it.
             Discard on the date, not when it looks empty.</p>`
        : v.expired ? ''
        : `<p class="note">It runs out before it expires, so the date is not the binding limit here -
             empty on ${esc(humanDate(v.emptyDate, today))}, window closes ${esc(humanDate(v.expiryMin, today))}.</p>`;

    return card('This vial', `${headline}
        <div class="meter" role="img" aria-label="${esc(v.pctUsed)} percent used">
            <div class="meter-fill" style="width:${esc(Math.max(2, v.pctUsed))}%"></div>
        </div>
        <dl class="facts">
            <div><dt>Mixed</dt><dd>${esc(humanDate(mixDate, today))}</dd></div>
            <div><dt>Doses used</dt><dd>${esc(v.dosesTaken)} of ${esc(v.dosesPerVial)}${SOURCE_TAG[v.dosesTakenSource] || ''}</dd></div>
            <div><dt>Runs out</dt><dd>${esc(humanDate(v.emptyDate, today))}</dd></div>
            <div><dt>Discard by</dt><dd>${esc(humanDate(v.expiryMin, today))}</dd></div>
        </dl>
        ${limitLine}
        ${sourceNote(v, dosesPerWeek)}`,
        { tone: v.expired ? 'bad' : expiryFirst ? 'warn' : '' });
}

function renderCycle(form, today) {
    const { peptide, doseAmount, vialSize, reconMl, dosesPerWeek, startDate, weeksOn, weeksOff, diluent } = form;
    if (!startDate || !weeksOn) {
        return card('The run', `<p class="note">Add a start date and a run length and this fills in.</p>`);
    }
    const c = cyclePlan({
        startDate, weeksOn, weeksOff, dosesPerWeek,
        doseAmount, doseUnit: peptide.doseUnit, vialSize, reconMl, today, diluent
    });
    if (!c) return card('The run', `<p class="plan-warn" role="note">
        <strong>This run cannot be planned.</strong> See Mixing above - a single dose of
        ${esc(n(doseAmount))} ${esc(peptide.doseUnit)} does not come out of one
        ${esc(n(vialSize))} ${esc(peptide.vialUnit || 'mg')} vial, so there is no vial count to give.</p>`, { tone: 'warn' });

    const progress = c.pctComplete === null ? '' : `
        <div class="meter" role="img" aria-label="${esc(c.pctComplete)} percent complete">
            <div class="meter-fill" style="width:${esc(Math.max(2, c.pctComplete))}%"></div>
        </div>
        <p class="note">Day ${esc(c.dayOfCycle)} of ${esc(c.daysOn)} &middot; ${esc(c.dosesDone)} of
        ${esc(c.totalDoses)} doses &middot; ${esc(c.pctComplete)}% through.</p>`;

    const rows = c.schedule.map(v => `<tr class="${v.expiresFirst ? 'is-flagged' : ''}">
        <th scope="row">Vial ${esc(v.index)}</th>
        <td>${esc(humanDate(v.mixDate))}</td>
        <td>${esc(humanDate(v.emptyDate))}</td>
        <td>${esc(v.doses)}${v.partial ? ' <span class="tag">partial</span>' : ''}</td>
        <td>${v.expiresFirst ? `<span class="flag">expires day ${esc(SHELF_LIFE_DAYS[diluent].min)}, ${esc(v.ageAtEmptyDays)} days of use</span>` : 'inside the window'}</td>
    </tr>`).join('');

    return card('The run', `
        <p class="answer-lede">${esc(c.weeksOn)} weeks from ${esc(humanDate(c.startDate))} to
        ${esc(humanDate(c.endDate))} - <strong>${esc(c.totalDoses)} doses</strong> and
        <strong>${esc(c.vialsNeeded)} vial${c.vialsNeeded === 1 ? '' : 's'}</strong>
        (${esc(big(c.totalDoseAmount))} ${esc(c.doseUnit)} in total).</p>
        ${progress}
        <dl class="facts">
            <div><dt>Doses per vial</dt><dd>${esc(c.dosesPerVial)}</dd></div>
            <div><dt>Vials to buy</dt><dd>${esc(c.vialsNeeded)}</dd></div>
            <div><dt>Midpoint</dt><dd>${esc(humanDate(c.midpointDate, today))}</dd></div>
            <div><dt>${c.nextCycleStart ? 'Next run starts' : 'Off period'}</dt><dd>${c.nextCycleStart ? esc(humanDate(c.nextCycleStart)) : 'none set'}</dd></div>
        </dl>
        <div class="table-scroll">
        <table class="data-table">
            <caption>When each vial gets mixed</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Mix</th><th scope="col">Empty</th><th scope="col">Doses</th><th scope="col">Shelf life</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        </div>
        ${c.anyExpiresFirst ? `<p class="plan-warn" role="note"><strong>At least one vial outlives its own
            preservative.</strong> Vials are mixed one after another, so a later vial's window opens when the
            previous one runs dry - and at this draw a vial takes longer to finish than the water keeps.
            Write the mix date on each vial and discard on the date.</p>`
        : `<p class="note">Every vial in this run finishes inside its shelf-life window.</p>`}
        <p class="note">The midpoint is the last point at which a mid-run change still affects the back half.
        This schedule mixes each vial the day the last one runs dry, starting from the cycle start date - so
        its dates are the plan, not a record. <strong>This vial</strong> above uses the mix date you actually
        entered, and the two will differ if the run did not go exactly to cadence.</p>`,
        { tone: c.anyExpiresFirst ? 'warn' : '' });
}

/* ----------------------------------------------------------------- actions */

function validate(form) {
    if (!form.peptide) return 'Pick a peptide first.';
    if (!(form.vialSize > 0)) return 'Enter the vial size printed on your vial.';
    if (!(form.reconMl > 0)) return 'Enter how much bacteriostatic water goes in.';
    if (!(form.doseAmount > 0)) return 'Enter the dose you take.';
    if (!(form.dosesPerWeek > 0)) return 'Enter how many doses a week.';
    if (form.mixDate && !parseDate(form.mixDate)) return 'That mix date is not a real date.';
    if (form.startDate && !parseDate(form.startDate)) return 'That start date is not a real date.';
    return null;
}

function run() {
    const form = readForm();
    const problem = validate(form);
    const out = $('planResults');

    if (problem) {
        out.innerHTML = `<p class="inline-error" role="alert">${esc(problem)}</p>`;
        return;
    }
    const today = todayISO();
    out.innerHTML = renderMix(form) + renderVial(form, today) + renderCycle(form, today);

    // The peptide id is a catalogue fact. The dose, the dates and the vial
    // state are not - they describe a named person's protocol and never leave
    // this browser.
    track('plan_generated', { peptide: form.peptideId });
}

function persist() {
    const form = readForm();
    const problem = validate(form);
    if (problem) {
        $('saveNote').textContent = problem;
        return;
    }
    const { peptide, ...state } = form;
    const ok = store.save(state);
    $('saveNote').textContent = ok
        ? 'Saved in this browser. It is not uploaded anywhere.'
        : 'This browser will not let the page store anything, so nothing was saved.';
}

function forget() {
    store.clear();
    $('saveNote').textContent = 'Cleared.';
}

/* -------------------------------------------------------------------- boot */

async function init() {
    initThemeToggle();

    const data = await loadPeptideData();
    records = Object.values(data);
    byId = new Map(records.map(p => [p.id, p]));

    const select = $('peptide');
    for (const p of [...records].sort((a, b) => a.name.localeCompare(b.name))) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    }
    try {
        enhanceSelect(select, { records, placeholder: `Search ${records.length} peptides...` });
    } catch (e) {
        console.warn('Peptide search unavailable, falling back to the plain dropdown:', e);
    }

    const syringe = $('syringe');
    for (const size of SYRINGE_SIZES) {
        const opt = document.createElement('option');
        opt.value = String(size);
        opt.textContent = `${size} unit barrel`;
        if (size === DEFAULT_SYRINGE) opt.selected = true;
        syringe.appendChild(opt);
    }

    select.addEventListener('change', () => {
        applyDefaults(byId.get(select.value));
        if ($('planResults').innerHTML.trim()) run();
    });

    $('planBtn').addEventListener('click', run);
    $('saveBtn').addEventListener('click', persist);
    $('clearBtn').addEventListener('click', forget);

    // Re-running on every keystroke would fight the person typing a date, so
    // only inputs that are picked rather than typed re-run themselves.
    for (const id of ['syringe', 'diluent']) {
        $(id).addEventListener('change', () => { if ($('planResults').innerHTML.trim()) run(); });
    }

    // A peptide in the URL lets the calculator hand a visitor straight here
    // with the compound already chosen.
    const fromUrl = new URLSearchParams(location.search).get('p');
    const saved = store.load();

    if (fromUrl && byId.has(fromUrl)) {
        select.value = fromUrl;
        applyDefaults(byId.get(fromUrl));
    } else if (saved && byId.has(saved.peptideId)) {
        writeForm(saved);
        setDoseContext(byId.get(saved.peptideId));
        $('vialUnit').textContent = byId.get(saved.peptideId).vialUnit || 'mg';
        $('saveNote').textContent = 'Loaded the plan saved in this browser.';
        run();
        return;
    }

    if (!store.isAvailable()) {
        $('saveNote').textContent = 'This browser will not let the page store anything, so Save is off.';
        $('saveBtn').disabled = true;
    }
    if (select.value) run();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}

export { humanDate, todayISO, validate };

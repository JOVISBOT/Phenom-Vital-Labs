/**
 * UI Module - DOM manipulation and rendering
 */

import { RECON_VOLUMES, SYRINGE_SIZES, DEFAULT_SYRINGE, defaultReconMl } from './calculator.js';
import { icon } from './icons.js';

export const DISCLAIMER_TITLE = 'Research information only - not medical advice';
export const DISCLAIMER_BODY =
    'Phenom Vital Labs publishes reference calculations for research peptides. Nothing here is ' +
    'a prescription, a diagnosis, or a recommendation to inject anything. Most of these compounds ' +
    'are not approved for human use, dosing conventions are drawn from community practice rather ' +
    'than controlled trials, and product identity, purity and sterility vary by supplier. ' +
    'Talk to a licensed physician before starting, changing or stopping any protocol, and ask your ' +
    'supplier for a lot-specific third-party certificate of analysis.';

/**
 * How well each record's doses are actually evidenced.
 *
 * One blanket disclaimer covered all 44 records equally, which flattens a
 * Mounjaro label strength and a forum figure for a compound that has never been
 * in a human into the same claim. The class is per record, in the data.
 */
export const EVIDENCE = {
    approved: {
        label: 'FDA-approved drug',
        blurb: 'An approved product containing this active ingredient is marketed in the US.'
    },
    trial: {
        label: 'Human trial data',
        blurb: 'Published human clinical trials exist at comparable doses. The compound is '
            + 'not approved for this use, and trial doses were given under supervision.'
    },
    convention: {
        label: 'Community convention',
        blurb: 'No human dosing study exists. Every figure is vendor and forum convention '
            + 'extrapolated from animal work.'
    }
};

/**
 * Being an approved drug and being dosed the way the label says are two
 * different claims, and the badge used to make both at once for all eight
 * approved records. Four of them carry community or off-label protocol figures
 * that no label prints - PT-141 offered a maximum 43% above the only labelled
 * dose while calling itself label-anchored.
 */
export const DOSE_ANCHOR = {
    label: {
        suffix: 'label dose',
        blurb: 'No dose offered here exceeds a strength or dose on that label.'
    },
    protocol: {
        suffix: 'off-label dose',
        blurb: 'The doses here are community and off-label protocol figures. The label '
            + 'prints different ones, for a different purpose, under supervision.'
    }
};

/**
 * Evidence class for a peptide, defaulting to the weakest claim.
 * @param {Object} peptide
 * @returns {{key: string, label: string, blurb: string, anchor: string|null}}
 */
export function evidenceFor(peptide) {
    const key = EVIDENCE[peptide.evidence] ? peptide.evidence : 'convention';
    const anchor = key === 'approved' && DOSE_ANCHOR[peptide.doseAnchor] ? peptide.doseAnchor : null;
    const base = EVIDENCE[key];
    return {
        key,
        anchor,
        label: anchor ? `FDA-approved, ${DOSE_ANCHOR[anchor].suffix}` : base.label,
        blurb: anchor ? `${base.blurb} ${DOSE_ANCHOR[anchor].blurb}` : base.blurb
    };
}

/**
 * Render a {min,max} range as text.
 *
 * A range collapsed to one number reads as a measurement. Thirteen records
 * store a cadence that the prose gives as a range -- "1-3x daily" -- and the
 * page used to print only the ceiling: "252 injections", "about 51 vials".
 * True at three a day, three times too high at one. Where min and max differ,
 * say both; where the figure rests on a house assumption rather than anything
 * the record states, mark it.
 *
 * @param {{min:number,max:number,ranged:boolean,assumed:boolean}} range
 * @param {Object} [opts] - {suffix, approx}
 * @returns {string}
 */
export function formatRange(range, opts = {}) {
    const { suffix = '', approx = false } = opts;
    if (!range) return '';
    const n = v => trim(v, 1);
    const body = range.ranged && range.max > range.min
        ? `${n(range.min)}-${n(range.max)}`
        : `${approx ? '~' : ''}${n(range.min)}`;
    return `${body}${suffix}`;
}

/** Suffix marking a figure the record does not actually state. */
export const ASSUMED_NOTE = 'assumed - the record states no fixed course';

/**
 * Where a peptide's vial-size catalogue came from.
 *
 * Letting the user type their own size took the catalogue out of the
 * arithmetic; it did not take it off the screen. A list of unmarked numbers
 * reads as equally authoritative whether a number was printed on an approved
 * carton or copied off a vendor's shop page. `vialSizeSource` says which.
 *
 * @param {Object} peptide
 * @returns {{key: string, headline: string, source: string, labelSizes: number[]}}
 */
export function vialProvenanceFor(peptide) {
    const key = ['label', 'mixed', 'vendor'].includes(peptide.vialSizeSource)
        ? peptide.vialSizeSource
        : 'vendor';
    const noun = peptide.noRecon ? 'pen' : 'vial';
    const headline = key === 'label'
        ? `Every size listed is a marketed strength.`
        : key === 'mixed'
            ? `Sizes marked ✓ are marketed strengths. The rest are vendor convention.`
            : `None of these sizes is a marketed strength.`;
    return {
        key,
        headline: `${headline} Whatever the list says, use the size printed on your own ${noun}.`,
        source: peptide.labelSource || '',
        labelSizes: peptide.labelSizes || []
    };
}

/**
 * Get timing recommendation based on peptide category
 * @param {Object} peptide - Peptide object
 * @returns {string} Timing recommendation
 */
function getTimingRecommendation(peptide) {
    const cat = peptide.category.toLowerCase();
    const name = peptide.name.toLowerCase();

    // GH-related peptides - best at night
    if (cat.includes('gh') || cat.includes('growth') ||
        name.includes('cjc') || name.includes('ipa') ||
        name.includes('sermorelin') || name.includes('tesamorelin') ||
        name.includes('ghrp') || name.includes('mod grf')) {
        return '<strong>Evening dosing preferred</strong> (aligns with natural GH pulse timing)';
    }

    // Fat loss / metabolic - morning best
    if (cat.includes('fat') || cat.includes('metabolic') ||
        cat.includes('weight') || name.includes('semaglutide') || name.includes('tirzepatide')) {
        return '<strong>Morning dosing preferred</strong> (enhances daytime metabolism)';
    }

    // Healing - morning works well
    if (cat.includes('heal') || cat.includes('recovery') ||
        name.includes('bpc') || name.includes('tb-500')) {
        return '<strong>Morning dosing acceptable</strong> (post-workout ideal for healing)';
    }

    // Cognitive - morning
    if (cat.includes('nootropic') || cat.includes('cognitive') ||
        name.includes('semax') || name.includes('selank') || name.includes('adamax')) {
        return '<strong>Morning dosing preferred</strong> (cognitive enhancement during waking hours)';
    }

    return '<strong>Take at same time daily</strong> for optimal results';
}

/**
 * Get half-life based dosing guidance
 * @param {string} halfLife - Half-life string from peptide data
 * @returns {string} Dosing guidance
 */
function getHalfLifeGuidance(halfLife) {
    const hl = halfLife.toLowerCase();

    const dayMatch = hl.match(/~(\d+)\s*day/);
    const hourMatch = hl.match(/(\d+).*hour/);
    const minMatch = hl.match(/(\d+).*min/);

    if (dayMatch) {
        const days = parseInt(dayMatch[1]);
        if (days >= 7) {
            return '<strong>Weekly dosing optimal</strong> - long half-life allows extended intervals';
        } else if (days >= 3) {
            return '<strong>2-3x per week possible</strong> - consider consolidating to once daily for simplicity';
        }
    }

    if (hourMatch) {
        const hours = parseInt(hourMatch[1]);
        if (hours >= 8) {
            return '<strong>Once daily dosing ideal</strong> - 8+ hour half-life supports 24-hour coverage';
        } else if (hours >= 4) {
            return '<strong>Twice daily optimal</strong> (AM/PM) - 4-8 hour half-life needs 12-hour spacing';
        } else if (hours >= 2) {
            return '<strong>Multiple daily doses may be needed</strong> - consider timing with meals/activity';
        }
    }

    if (minMatch) {
        return '<strong>Short-acting peptide</strong> - requires careful timing; many doses may be simplified to once daily with slight efficacy trade-off';
    }

    if (hl.includes('long')) {
        return '<strong>Once daily or less frequent dosing</strong> - extended duration of action';
    }

    if (hl.includes('short') || hl.includes('unknown')) {
        return '<strong>Standard once daily dosing</strong> is typically effective; exact timing less critical than consistency';
    }

    return '<strong>Once daily dosing recommended</strong> where possible for patient compliance';
}

/**
 * Escape text destined for innerHTML. The peptide database is first-party, but
 * error messages and URL state are not.
 * @param {*} value
 * @returns {string}
 */
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

/**
 * Trim trailing zeros from a fixed-decimal number.
 * @param {number} n
 * @param {number} dp
 * @returns {string}
 */
function trim(n, dp = 2) {
    return String(Number(n.toFixed(dp)));
}

/**
 * Format a dose with its unit.
 * @param {number} dose
 * @param {string} unit - 'mcg' | 'mg' | 'IU'
 * @returns {string}
 */
export function formatDose(dose, unit) {
    if (unit === 'mcg') return `${dose.toLocaleString()} mcg`;
    if (unit === 'IU') return `${dose.toLocaleString()} IU`;
    return `${trim(dose, 3)} mg`;
}

/**
 * Format syringe units, keeping a decimal only when there is one.
 * @param {number} units
 * @returns {string}
 */
function formatUnits(units) {
    return Number.isInteger(units) ? String(units) : units.toFixed(1);
}

/**
 * Populate weight dropdown options with smart defaults
 */
export function populateWeightOptions() {
    const select = document.getElementById('weight');
    select.innerHTML = '<option value="">Select weight...</option>';

    const commonWeights = [150, 160, 170, 180, 190, 200];
    const optgroup = document.createElement('optgroup');
    optgroup.label = 'Common';

    commonWeights.forEach(w => {
        const option = document.createElement('option');
        option.value = w;
        option.textContent = `${w} lbs`;
        if (w === 180) option.selected = true;
        optgroup.appendChild(option);
    });
    select.appendChild(optgroup);

    const allGroup = document.createElement('optgroup');
    allGroup.label = 'All Weights';
    for (let w = 100; w <= 350; w += 5) {
        if (!commonWeights.includes(w)) {
            const option = document.createElement('option');
            option.value = w;
            option.textContent = `${w} lbs`;
            allGroup.appendChild(option);
        }
    }
    select.appendChild(allGroup);
}

/**
 * Populate age dropdown options.
 *
 * These used to advertise a dose multiplier ("30-39 (+8%)") that (a) did not
 * match the multiplier the code applied (+10%), and (b) scaled GH-secretagogue
 * doses UP with age, the opposite of clinical practice. Doses are now flat
 * protocol figures, so age is recorded for the protocol sheet and nothing else.
 */
export function populateAgeOptions() {
    const select = document.getElementById('age');
    select.innerHTML = '<option value="">Select age...</option>';

    const ageOptions = [
        { age: 25, label: '18-29' },
        { age: 35, label: '30-39' },
        { age: 45, label: '40-49' },
        { age: 55, label: '50-59' },
        { age: 65, label: '60+' }
    ];

    ageOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.age;
        option.textContent = opt.label;
        if (opt.age === 35) option.selected = true;
        select.appendChild(option);
    });
}

/**
 * Display label for a peptide in the dropdown. Blends show their component
 * split, read from the `components` field rather than regex-scraped out of the
 * category string.
 * @param {Object} p
 * @returns {string}
 */
function peptideLabel(p) {
    if (p.components && p.components.length === 2) {
        const [a, b] = p.components;
        return `${a.name} ${a.mg}mg + ${b.name} ${b.mg}mg`;
    }
    return p.name;
}

/**
 * Populate peptide dropdown options - grouped by function
 * @param {Object} peptides
 */
export function populatePeptideOptions(peptides) {
    const select = document.getElementById('peptide');
    select.innerHTML = '<option value="">Select peptide...</option>';

    const healingCats = ['Healing & Recovery', 'Anti-Fibrotic Bioregulator', 'Neuropathic Pain & Tissue Repair'];
    const growthCats = ['Growth Hormone Release', 'GH Secretagogue (GHRP)', 'FDA-Approved GH Therapy', 'GH Stack', 'HGH Fragment (Fat Oxidation)', 'Myostatin Inhibitor'];
    const metabolicCats = ['Weight Management', 'AMPK Activator - Metabolic', 'Experimental Fat Targeting', 'Peptide YY Analog (Appetite)', 'Mitochondrial Health', 'Insulin Regulation'];

    // Only ids that actually exist in the database. 'semaglutide' and
    // 'ipamorelin' were listed here for months and match nothing.
    const popularIds = ['bpc157', 'tb500', 'blend_heal', 'blend_gh1', 'tirzepatide',
        'retatrutide', 'cjc1295', 'aod9604', 'melanotan2', 'pt141'];

    const buckets = { popular: [], healing: [], growth: [], metabolic: [], other: [] };

    Object.values(peptides).forEach(p => {
        if (popularIds.includes(p.id)) {
            buckets.popular.push(p);
        } else if (healingCats.some(cat => p.category.includes(cat)) || p.category.includes('Healing')) {
            buckets.healing.push(p);
        } else if (growthCats.some(cat => p.category.includes(cat)) || p.category.includes('GH') || p.category.includes('Growth') || p.category.includes('Myostatin')) {
            buckets.growth.push(p);
        } else if (metabolicCats.some(cat => p.category.includes(cat)) || p.category.includes('Metabolic') || p.category.includes('Weight') || p.category.includes('Fat')) {
            buckets.metabolic.push(p);
        } else {
            buckets.other.push(p);
        }
    });

    const groups = [
        ['⭐ Popular', buckets.popular, (a, b) => popularIds.indexOf(a.id) - popularIds.indexOf(b.id)],
        ['🩹 Healing & Repair', buckets.healing],
        ['💪 Muscle & Growth', buckets.growth],
        ['🔥 Fat Loss & Metabolic', buckets.metabolic],
        ['🧬 Other', buckets.other]
    ];

    for (const [label, list, sorter] of groups) {
        if (!list.length) continue;
        list.sort(sorter || ((a, b) => a.name.localeCompare(b.name)));

        const group = document.createElement('optgroup');
        group.label = label;
        list.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = peptideLabel(p);
            group.appendChild(opt);
        });
        select.appendChild(group);
    }
}

/**
 * Fill the vial-size dropdown from the peptide's own catalogue.
 *
 * The sizes used to live in a hardcoded map in this file, keyed by peptide id,
 * with entries for ids that do not exist and HCG's IU vials rendered as "5000mg".
 * They are now data, with an explicit unit.
 * @param {Object|null} peptide
 * @param {number} [preferred] - Size to preselect, if still available
 */
export function updateVialSizeForPeptide(peptide, preferred) {
    const select = document.getElementById('vialSize');
    const custom = document.getElementById('vialSizeCustom');
    const label = document.getElementById('vialSizeLabelText');
    const prov = document.getElementById('vialSizeProvenance');

    if (!peptide) {
        select.innerHTML = '<option value="">Select a peptide first</option>';
        select.disabled = true;
        if (prov) { prov.hidden = true; prov.textContent = ''; }
        setCustomVial(false);
        return;
    }

    const want = Number(preferred);
    const known = peptide.vialSizes.includes(want);
    const chosen = known ? want : peptide.vialSize;

    // A pen has a strength, not a vial size, and nothing is added to it.
    if (label) label.textContent = peptide.noRecon ? 'Pen Strength' : 'Vial Size';

    // A size that matches a marketed product is marked, so the list stops
    // presenting a vendor's habit and an FDA-labelled strength as the same kind
    // of number. See vialProvenanceFor.
    const provenance = vialProvenanceFor(peptide);
    if (prov) {
        prov.hidden = false;
        prov.textContent = provenance.source
            ? `${provenance.headline} ${provenance.source}.`
            : provenance.headline;
    }

    select.innerHTML = peptide.vialSizes
        .map(s => {
            const marked = provenance.labelSizes.includes(s) ? ' ✓' : '';
            return `<option value="${s}"${s === chosen ? ' selected' : ''}>${s}${peptide.vialUnit}${marked}</option>`;
        })
        .join('')
        // OPEN 2 was "fourteen of our vial sizes are convention, not evidence".
        // The honest fix is not a better guess: it is letting the user enter the
        // number printed on the vial in front of them. Vial size does not change
        // the dose, only how far up the barrel it lands - so a wrong list is a
        // legibility bug, and a typed value removes the list from the answer.
        + `<option value="custom">Other - type the size on my ${peptide.noRecon ? 'pen' : 'vial'}...</option>`;

    // A blend's ratio is fixed by the vial, but the vial can still be a size we
    // do not list, so the control stays enabled wherever a choice is meaningful.
    select.disabled = false;

    if (custom) custom.value = '';

    // A shared link can carry a size that is not in our catalogue. Restore it as
    // a typed value rather than silently snapping back to the default -- the
    // recipient of the link would otherwise see different numbers to the sender.
    const restorable = preferred !== undefined && preferred !== null && preferred !== ''
        && !known && Number(preferred) > 0;

    if (restorable) {
        select.value = 'custom';
        if (custom) custom.value = String(Number(preferred));
    }
    setCustomVial(restorable, peptide, false);
}

/**
 * Show or hide the typed vial-size input.
 * @param {boolean} on
 * @param {Object} [peptide]
 * @param {boolean} [focus] - Only when the user asked for it; not on page load
 */
export function setCustomVial(on, peptide, focus = true) {
    const custom = document.getElementById('vialSizeCustom');
    const unit = document.getElementById('vialSizeCustomUnit');
    if (!custom) return;
    custom.hidden = !on;
    if (unit) {
        unit.hidden = !on;
        if (peptide) unit.textContent = peptide.vialUnit;
    }
    if (on && focus) custom.focus();
}

/**
 * The vial size currently in force, whether picked from the list or typed in.
 * @returns {number} NaN when the custom box is empty or not a number
 */
export function readVialSize() {
    const select = document.getElementById('vialSize');
    if (select.value !== 'custom') return parseFloat(select.value);
    return parseFloat(document.getElementById('vialSizeCustom').value);
}

/**
 * Fill the reconstitution-volume dropdown.
 *
 * This was hardcoded to 3 ml in two separate files with no control at all, while
 * being the single biggest determinant of how far up the barrel you draw.
 * @param {Object|null} peptide
 * @param {number} [preferred]
 */
export function updateReconOptions(peptide, preferred) {
    const select = document.getElementById('reconMl');
    const fallback = peptide ? defaultReconMl(peptide) : 3;
    const chosen = RECON_VOLUMES.includes(Number(preferred)) ? Number(preferred) : fallback;

    // Nothing is mixed into a pre-filled pen, so offering it a water volume
    // invites the user to answer a question that has no answer.
    if (peptide && peptide.noRecon) {
        select.innerHTML = '<option value="0">Not reconstituted - pre-filled</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;
    select.innerHTML = RECON_VOLUMES
        .map(v => `<option value="${v}"${v === chosen ? ' selected' : ''}>${v} ml${v === fallback ? ' (recommended)' : ''}</option>`)
        .join('');
}

/**
 * Fill the syringe-size dropdown.
 * @param {number} [preferred]
 */
export function populateSyringeOptions(preferred, peptide) {
    const select = document.getElementById('syringe');
    const chosen = SYRINGE_SIZES.includes(Number(preferred)) ? Number(preferred) : DEFAULT_SYRINGE;

    if (peptide && peptide.noRecon) {
        select.innerHTML = '<option value="0">Not drawn - built into the pen</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;
    select.innerHTML = SYRINGE_SIZES
        .map(s => `<option value="${s}"${s === chosen ? ' selected' : ''}>${s}U (${s / 100} ml)</option>`)
        .join('');
}

/**
 * Show loading state
 */
export function showLoading() {
    const btn = document.getElementById('calculateBtn');
    btn.disabled = true;
    btn.innerHTML = `
        <svg class="spinner" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="60" stroke-dashoffset="20"/>
        </svg>
        Calculating...
    `;
}

/**
 * Hide loading state
 */
export function hideLoading() {
    const btn = document.getElementById('calculateBtn');
    btn.disabled = false;
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
        Generate Protocol
    `;
}

/**
 * Show inline error message
 * @param {string} message
 */
export function showInlineError(message) {
    const existing = document.querySelector('.inline-error');
    if (existing) existing.remove();

    const error = document.createElement('div');
    error.className = 'inline-error';
    error.setAttribute('role', 'alert');
    error.innerHTML = `<span aria-hidden="true">⚠️</span><span>${esc(message)}</span>`;

    const card = document.querySelector('.card');
    card.insertBefore(error, card.firstChild);

    setTimeout(() => error.remove(), 6000);
}

/**
 * One dose card.
 * @param {string} level
 * @param {Object} cfg
 * @param {Object} results
 * @returns {string}
 */
function doseCard(level, cfg, results) {
    const dose = results.doses[level];
    const units = results.syringeUnits[level];
    const overflow = results.overflow[level];
    const exceedsVial = results.exceedsVial[level];
    const pooled = (results.vialsPooled && results.vialsPooled[level]) || 1;
    const parts = results.components[level];

    const componentHtml = parts ? `
        <div class="component-split">
            ${parts.map(c => `<div><span>${esc(c.name)}</span><strong>${c.mcg.toLocaleString()} mcg</strong></div>`).join('')}
        </div>` : '';

    // Order matters. "Exceeds the vial" is the harder failure and has to win:
    // the syringe advice below tells you to use less water, which raises
    // concentration and lowers the unit count -- useless when the vial simply
    // does not contain this much peptide.
    const drawHtml = results.noRecon ? `
        <div class="draw-label">Pen strength</div>
        <div class="draw-value ${level}">${esc(formatDose(dose, results.doseUnit))}</div>
        <div class="draw-hint">Pre-filled &mdash; nothing to mix, nothing to draw</div>
    ` : pooled > 1 ? `
        <div class="draw-label">Pooled from ${pooled} vials</div>
        <div class="draw-value ${level}">${formatUnits(units)} units</div>
        <div class="draw-hint">Mix vial 1 with ${results.reconMl} ml, draw it back up and use that same liquid to dissolve the other ${pooled - 1} &mdash; the sequential method on the label. The volume does not grow: ${results.volumeMl[level]} ml total.</div>
    ` : exceedsVial ? `
        <div class="draw-label overflow">⚠️ More than one ${results.vialSize}${results.vialUnit} vial holds</div>
        <div class="draw-value overflow">${results.perDoseVials[level]} vials</div>
        <div class="draw-hint">This dose needs ${results.perDoseVials[level]} vials per injection. No reconstitution volume fixes it &mdash; water dilutes, it does not add peptide. Pick a larger vial size, or treat this tier as unverified.</div>
    ` : overflow ? `
        <div class="draw-label overflow">⚠️ Does not fit a ${results.syringe}U syringe</div>
        <div class="draw-value overflow">${formatUnits(units)} units</div>
        <div class="draw-hint">${results.volumeMl[level]} ml total &middot; ${Math.ceil(units / results.syringe)} draws, or pick a smaller reconstitution volume</div>
    ` : `
        <div class="draw-label">Draw</div>
        <div class="draw-value ${level}">${formatUnits(units)} units</div>
        <div class="draw-hint">${results.volumeMl[level]} ml on a ${results.syringe}U syringe</div>
    `;

    return `
        <div class="dose-card ${level} ${cfg.featured ? 'featured' : ''} animate-in" style="animation-delay: ${cfg.delay}s;">
            ${cfg.featured ? `<div class="recommended-badge">${esc(cfg.badge || 'Recommended')}</div>` : ''}
            <div class="dose-label ${level}">${cfg.label}</div>
            <div class="mcg-box">
                <div class="mcg-label">${cfg.sublabel}</div>
                <div class="mcg-value">${esc(formatDose(dose, results.doseUnit))}</div>
                ${componentHtml}
            </div>
            <div class="draw-box${(overflow || exceedsVial) && pooled === 1 && !results.noRecon ? ' overflow' : ''}">${drawHtml}</div>
            ${cfg.hint ? `<div class="dose-hint">${cfg.hint}</div>` : ''}
        </div>
    `;
}

/**
 * Render calculation results
 * @param {Object} peptide
 * @param {Object} results
 * @param {Object} inputs
 */
export function renderResults(peptide, results, inputs) {
    const container = document.getElementById('results');
    const u = results.vialUnit;

    // Three tiers are a ladder for 43 records and are not for tesamorelin,
    // whose low/med/high are the labelled daily doses of three different
    // formulations. Its own instructions said "not an escalating ladder" while
    // the cards above them read CONSERVATIVE / Best for first-time users ->
    // ADVANCED / For experienced users. The data says which it is.
    const variants = peptide.tiersAreVariants === true;
    const vLabel = peptide.tierLabels || {};
    const cards = (variants
        ? [
            ['low', { label: vLabel.low || 'Variant', sublabel: 'Labelled Dose', delay: 0.2 }],
            // "Recommended" would contradict the note directly above it, which
            // says moving up one is not a stronger protocol.
            ['med', { label: vLabel.med || 'Variant', sublabel: 'Labelled Dose', delay: 0.3, featured: true, badge: 'Shown above' }],
            ['high', { label: vLabel.high || 'Variant', sublabel: 'Labelled Dose', delay: 0.4 }]
        ]
        : [
            ['low', { label: 'Conservative', sublabel: 'Starting Dose', delay: 0.2, hint: 'Best for first-time users' }],
            ['med', { label: 'Standard', sublabel: 'Recommended Dose', delay: 0.3, featured: true }],
            ['high', { label: 'Advanced', sublabel: 'Maximum Dose', delay: 0.4, hint: 'For experienced users' }]
        ]).map(([level, cfg]) => doseCard(level, cfg, results)).join('');

    // An arrow between the three doses reads as escalation. For a variant set
    // that is the same contradiction the cards had: the note directly below
    // says "not a low-to-high ladder" while the row above draws one.
    const rung = variants ? '&middot;' : '&rarr;';
    const tierNote = variants && peptide.tierNote
        ? `<p class="blend-note tier-note">${esc(peptide.tierNote)}</p>` : '';

    const medPooled = (results.vialsPooled && results.vialsPooled.med) || 1;
    const medConc = (results.concentrationAt && results.concentrationAt.med) || results.concentration;

    const ev = evidenceFor(peptide);
    const evidenceHtml = `
        <div class="evidence-badge evidence-${ev.key}" role="note">
            <strong>${esc(ev.label)}</strong>
            <span>${esc(ev.blurb)}</span>
        </div>`;

    const deviceNote = results.noRecon ? `
        <p class="blend-note device-note">${esc(peptide.deviceNote || 'This product is supplied ready to inject.')}</p>` : '';

    const multiVialNote = results.multiVial ? `
        <p class="blend-note">${esc(peptide.multiVialNote || '')}</p>` : '';

    const componentNote = peptide.components ? `
        <p class="blend-note">
            This is a fixed blend: ${peptide.components.map(c => `${esc(c.name)} ${c.mg}mg`).join(' + ')} in one vial.
            The ratio cannot be changed, and the figures above are the <strong>combined</strong> dose &mdash;
            the per-peptide amount is shown under each.
        </p>` : '';

    // Water volume is the one control that fixes this, and it is a control the
    // visitor has right above the result -- so name the volume rather than just
    // flagging the number. Same class as the syringe-overflow warning: a figure
    // that computes cleanly and cannot actually be carried out.
    const sol = results.solubility;
    const solubilityNote = sol && sol.applies && sol.overCeiling ? `
        <p class="blend-note solubility-note">
            <strong>&#9888; ${trim(sol.concentration, 1)} ${u}/ml may not dissolve.</strong>
            ${results.vialSize} ${u} in ${results.reconMl} ml puts this above the
            ~${sol.ceiling} ${u}/ml where lyophilised powder generally stops going into
            solution. Use <strong>at least ${sol.mlToClear} ml</strong> of bacteriostatic water,
            or confirm the concentration against the vendor's own reconstitution note.
            The units below are arithmetically correct for a solution that fully dissolves.
        </p>` : '';

    // The number a visitor came for, first and at a size you can read holding a
    // vial. It used to sit ~1,400px down a 4,100px page on desktop and past
    // 3,000px on a phone, under the form, the protocol summary and three tier
    // cards. Nothing below changed; this is the same med-tier figure promoted.
    const heroOverflow = !results.noRecon && (results.overflow.med || results.exceedsVial.med);
    const heroSplit = results.components && results.components.med
        ? `<div class="answer-hero-split">${results.components.med
            .map(c => `<span>${esc(c.name)} ${trim(c.mcg, 1)} mcg</span>`).join('')}</div>`
        : '';
    const heroHtml = results.noRecon
        ? `
            <div class="answer-hero" id="answer">
                <div class="answer-hero-label">Your dose</div>
                <div class="answer-hero-value">${esc(formatDose(results.doses.med, results.doseUnit))}</div>
                <div class="answer-hero-dose">pre-filled ${esc(results.device)} &mdash; nothing to draw</div>
                <div class="answer-hero-meta">
                    ${results.vialSize}${u} per ${esc(results.device)} &middot; ${esc(peptide.freq)}
                </div>
                ${heroSplit}
            </div>`
        : `
            <div class="answer-hero${heroOverflow ? ' is-overflow' : ''}" id="answer">
                <div class="answer-hero-label">Draw</div>
                <div class="answer-hero-value">${formatUnits(results.syringeUnits.med)}<span class="unit">units</span></div>
                <div class="answer-hero-dose">= ${esc(formatDose(results.doses.med, results.doseUnit))} of ${esc(peptide.name)}</div>
                ${heroSplit}
                <div class="answer-hero-meta">
                    ${medPooled > 1 ? `${medPooled} &times; ` : ''}${results.vialSize}${u} vial${medPooled > 1 ? 's pooled' : ''}
                    &middot; ${results.reconMl} ml bacteriostatic water
                    &middot; ${trim(medConc, 2)} ${u}/ml
                    &middot; ${results.syringe}U syringe
                </div>
                ${heroOverflow ? `<div class="answer-hero-warn">${results.exceedsVial.med
                    ? 'This dose needs more peptide than one vial holds - adding water will not fix it.'
                    : `More than a ${results.syringe}U barrel holds - split it into more than one injection.`}</div>` : ''}
            </div>`;

    const html = `
        <div class="results" style="display: block;">
            <div class="peptide-header animate-in">
                <h2>${esc(peptide.name)}</h2>
                <p>${esc(peptide.category)}</p>
                ${evidenceHtml}
            </div>

            ${heroHtml}

            <div class="summary-card animate-in" style="animation-delay: 0.03s;">
                <div class="summary-header">
                    <div class="summary-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                    </div>
                    <div class="summary-title">
                        <h3>Protocol</h3>
                        <p>${results.noRecon
        ? `${results.vialSize}${u} pre-filled ${esc(results.device)} &middot; no reconstitution`
        : `${medPooled > 1 ? `${medPooled} &times; ` : ''}${results.vialSize}${u} vial${medPooled > 1 ? 's pooled' : ''} &middot; ${results.reconMl} ml bacteriostatic water &middot; ${trim(medConc, 2)} ${u}/ml`}</p>
                    </div>
                </div>

                <div class="dose-range">
                    <span class="dose-badge low">${esc(formatDose(results.doses.low, results.doseUnit))}</span>
                    <span class="dose-arrow" aria-hidden="true">${rung}</span>
                    <span class="dose-badge med">${esc(formatDose(results.doses.med, results.doseUnit))}</span>
                    <span class="dose-arrow" aria-hidden="true">${rung}</span>
                    <span class="dose-badge high">${esc(formatDose(results.doses.high, results.doseUnit))}</span>
                </div>

                <p class="scaling-note">
                    These are standard protocol doses for ${esc(peptide.name)}. They are <strong>not</strong> scaled to
                    body weight or age &mdash; almost no peptide in this class is dosed per kilogram. Your
                    ${inputs.weight} lbs / ${inputs.age} years are recorded on the protocol sheet for reference only.
                </p>
                ${deviceNote}
                ${multiVialNote}
                ${componentNote}
                ${solubilityNote}
                ${tierNote}
            </div>

            <div class="dose-grid">${cards}</div>

            ${results.noRecon ? `
            <div class="calc-box animate-in" style="animation-delay: 0.14s;">
                <h4>${icon('syringe')} No draw to calculate</h4>
                <p class="calc-footnote">
                    ${esc(peptide.name)} is dispensed as a pre-filled ${esc(results.device)} at a fixed strength.
                    There is no powder to reconstitute, no bacteriostatic water to add and no syringe to pull to
                    &mdash; the dose <em>is</em> the ${esc(results.device)} you were dispensed.
                    This page shows the marketed strengths and the cycle arithmetic; everything about
                    reconstitution volume and syringe units belongs to lyophilised vials and does not apply here.
                </p>
            </div>` : `
            <div class="syringe-visual animate-in" style="animation-delay: 0.14s;">
                <h4>${icon('syringe')} Syringe draw guide (${variants ? esc(vLabel.med || 'shown above') : 'recommended dose'})</h4>
                ${generateSyringeSVG(results.syringeUnits.med, results.syringe)}
                <p class="syringe-caption">
                    Pull to <strong>${formatUnits(results.syringeUnits.med)} units</strong>
                    on a ${results.syringe}U syringe for ${esc(formatDose(results.doses.med, results.doseUnit))}
                </p>
            </div>

            <div class="calc-box animate-in" style="animation-delay: 0.15s;">
                <h4>${icon('calculator')} Your calculation</h4>
                <ol class="calc-steps">
                    <li>Reconstitute: <strong>${medPooled > 1 ? `${medPooled} &times; ${results.vialSize}${u}` : `${results.vialSize}${u}`}</strong> ${medPooled > 1 ? 'pooled' : 'vial'} &divide; <strong>${results.reconMl} ml</strong> water = <strong>${trim(medConc, 2)} ${u}/ml</strong>${medPooled > 1 ? ' <em>(the same water dissolves every vial)</em>' : ''}</li>
                    <li>Dose: <strong>${esc(formatDose(results.doses.med, results.doseUnit))}</strong>${results.doseUnit === 'mcg' ? ` = ${trim(results.doses.med / 1000, 4)} mg` : ''}</li>
                    <li>Volume: &divide; ${trim(medConc, 2)} ${u}/ml = <strong>${results.volumeMl.med} ml</strong></li>
                    <li>Units: &times; 100 units/ml = <strong class="calc-answer">${formatUnits(results.syringeUnits.med)} units</strong></li>
                </ol>
                <p class="calc-footnote">
                    An insulin syringe is U-100: <strong>100 units per ml</strong>, whether the barrel holds 30, 50 or 100 units.
                    Barrel size limits how much you can draw at once &mdash; it does not change the reading.
                </p>
            </div>`}

            <div class="pdf-buttons animate-in" style="animation-delay: 0.16s;">
                <button class="btn" id="previewPDFTop" type="button">Preview PDF</button>
                <button class="btn" id="downloadPDFTop" type="button">Download PDF</button>
                <button class="btn btn-secondary" id="copyLink" type="button">Copy link</button>
            </div>

            <div class="info-grid animate-in" style="animation-delay: 0.18s;">
                <div class="info-card">
                    <div class="info-card-icon" aria-hidden="true">${icon('clock')}</div>
                    <h4>Half-Life</h4>
                    <p class="highlight">${esc(peptide.halfLife || 'N/A')}</p>
                    <small>Time in body</small>
                </div>
                <div class="info-card">
                    <div class="info-card-icon" aria-hidden="true">${icon('repeat')}</div>
                    <h4>Frequency</h4>
                    <p class="highlight">${esc(peptide.freq || 'N/A')}</p>
                    <small>${results.weeklyFreqRange.assumed
                        ? `taken as ${formatRange(results.weeklyFreqRange)}x per week`
                        : `${formatRange(results.weeklyFreqRange)}x per week`}</small>
                </div>
                <div class="info-card">
                    <div class="info-card-icon" aria-hidden="true">${icon('cycle')}</div>
                    <h4>Cycle</h4>
                    <p class="highlight">${esc(peptide.cycle || peptide.wks + ' weeks')}</p>
                    <small>${formatRange(results.dosesPerCycleRange)} injections in full${
                        results.dosesPerCycleRange.assumed ? ` (${ASSUMED_NOTE})` : ''}</small>
                </div>
                <div class="info-card highlight">
                    <div class="info-card-icon" aria-hidden="true">${icon('box')}</div>
                    <h4>${results.noRecon ? 'Pens Needed' : 'Vials Needed'}</h4>
                    <p class="big">${formatRange(results.vialsRange)}</p>
                    <small>${results.vialSize}${u} ${results.noRecon ? 'single-dose pens' : ''} for the full cycle${
                        results.vialsRange.ranged ? ', depending where in that range you dose' : ` (${trim(results.totalCycle, 2)}${u} total)`}</small>
                </div>
            </div>

            <div class="pros-cons-grid animate-in" style="animation-delay: 0.19s;">
                <div class="pc-card pros">
                    <div class="pc-title pros">Benefits</div>
                    <ul class="pc-list pros">
                        ${peptide.pros.slice(0, 6).map(p => `<li>${esc(p)}</li>`).join('')}
                    </ul>
                </div>
                <div class="pc-card cons">
                    <div class="pc-title cons">Considerations</div>
                    <ul class="pc-list cons">
                        ${peptide.cons.slice(0, 6).map(c => `<li>${esc(c)}</li>`).join('')}
                    </ul>
                </div>
            </div>

            ${peptide.warnings && peptide.warnings.length ? `
                <div class="pc-card warnings animate-in" style="animation-delay: 0.22s;">
                    <div class="pc-title warnings">Important Warnings</div>
                    <ul class="pc-list warnings">
                        ${peptide.warnings.map(w => `<li>${esc(w)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            <!-- Three collapsed prose folds, stacked, were three full-width rows of
                 nothing. Side by side above 1180px; still stacked on a phone. -->
            <div class="fold-pair">
            <details class="fold animate-in" style="animation-delay: 0.11s;">
                <summary>Research overview</summary>
                <div class="fold-body"><div class="research-box" style="margin:0">
                    <p>${esc(peptide.research)}</p>
                </div></div>
            </details>

            <details class="fold animate-in" style="animation-delay: 0.12s;">
                <summary>How it works</summary>
                <div class="fold-body"><div class="mechanism-box" style="margin:0">
                    <p>${esc(peptide.mechanism)}</p>
                </div></div>
            </details>

            <details class="fold animate-in" style="animation-delay: 0.12s;">
                <summary>Clinical dosing notes</summary>
                <div class="fold-body">
            <div class="clinical-box" style="margin:0">
                <ul class="clinical-list">
                    <li><strong>Bioavailability:</strong> 40-90% via subcutaneous route | Peak plasma: 2-6 hours post-injection</li>
                    <li><strong>Timing Strategy:</strong> Consistent daily timing reduces variability. ${getTimingRecommendation(peptide)}</li>
                    ${peptide.halfLife && peptide.halfLife !== 'Unknown' ? `<li><strong>Half-Life Guidance (${esc(peptide.halfLife)}):</strong> ${getHalfLifeGuidance(peptide.halfLife)}</li>` : ''}
                    <li><strong>Storage:</strong> ${results.noRecon
        ? 'Pre-filled pens are stored refrigerated at 2-8&deg;C in the original carton until use. Nothing is mixed, so there is no reconstitution clock to track.'
        : 'Reconstituted vials keep roughly 4-6 weeks refrigerated at 2-8&deg;C in bacteriostatic water, and about 24 hours in plain sterile water. Write the mixing date on the vial.'}</li>
                    <li class="renal-warning"><strong>Renal Function:</strong> Patients with GFR &lt;60 may require 25-50% dose reduction. Peptides under 5 kDa are cleared renally.</li>
                </ul>
            </div>
                </div>
            </details>
            </div>

            <div class="protocol-box animate-in" style="animation-delay: 0.13s;">
                <h3>Administration Instructions</h3>
                <ul class="protocol-list">
                    ${peptide.inst.map(i => `<li>${esc(i)}</li>`).join('')}
                </ul>
            </div>

            <!-- A second, identical Preview/Download pair used to sit here. Two action
                 bars for two actions on one page: whichever one a visitor found, the
                 other was dead weight. main.js binds both id sets in a loop, so the
                 remaining bar above the info tiles carries the buttons on its own. -->
        </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';

    // Deliberately does not scroll. This ran on every render, including the
    // re-render triggered by nudging the BAC-water or vial dropdown -- which
    // pulled the page out from under someone who was standing on that control
    // watching the number move. Whether a render deserves to move the viewport
    // depends on what caused it, which only the caller knows, so main.js owns
    // it and scrolls to #answer on a deliberate Generate.
}

/**
 * The safety disclaimer, as markup. `.footer-disclaimer` was styled in styles.css
 * back in April and rendered nowhere, so a public page emitting personalised
 * injection protocols carried no medical language at all. It is now static in
 * index.html, directly below the results container; this helper exists so the
 * PDF and any future surface use exactly the same wording.
 * @returns {string}
 */
export function disclaimerHTML() {
    return `
        <div class="footer-disclaimer animate-in" style="animation-delay: 0.34s;" role="note">
            <strong>${DISCLAIMER_TITLE}</strong>
            <p>${DISCLAIMER_BODY}</p>
        </div>
    `;
}

/**
 * Generate SVG syringe visualization
 * @param {number} units - Units to draw
 * @param {number} syringeSize - Barrel size (30, 50, or 100)
 * @returns {string} SVG markup
 */
export function generateSyringeSVG(units, syringeSize) {
    const width = 400;
    const height = 130;
    const barrelY = 45;
    const barrelHeight = 40;
    const barrelStartX = 60;
    const barrelWidth = 280;
    const endX = barrelStartX + barrelWidth;

    // The plunger used to be unbounded, so an overflowing dose drew the fill,
    // plunger and rod straight through the needle tip and off the graphic.
    const overflow = units > syringeSize;
    const fraction = Math.min(Math.max(units / syringeSize, 0), 1);
    const plungerX = barrelStartX + fraction * barrelWidth;

    const steps = syringeSize <= 30 ? 5 : 10;
    let ticks = '';
    let labels = '';
    for (let i = 0; i <= syringeSize; i += steps) {
        const x = barrelStartX + (i / syringeSize) * barrelWidth;
        ticks += `<line x1="${x}" y1="${barrelY}" x2="${x}" y2="${barrelY + barrelHeight}" stroke="#cbd5e1" stroke-width="1"/>`;
        labels += `<text x="${x}" y="${barrelY + barrelHeight + 18}" text-anchor="middle" font-size="11" fill="#64748b">${i}</text>`;
    }

    let fillColor = '#3b82f6';
    if (fraction > 0.75) fillColor = '#f59e0b';
    if (overflow) fillColor = '#ef4444';

    const readout = overflow
        ? `<text x="${width / 2}" y="20" text-anchor="middle" font-size="13" font-weight="bold" fill="#dc2626">
               ${formatUnits(units)} units - exceeds this ${syringeSize}U syringe
           </text>
           <text x="${width / 2}" y="34" text-anchor="middle" font-size="10" fill="#64748b">
               needs ${Math.ceil(units / syringeSize)} draws, a larger barrel, or less bacteriostatic water
           </text>`
        : `<line x1="${plungerX}" y1="${barrelY - 12}" x2="${plungerX}" y2="${barrelY - 6}" stroke="#1e40af" stroke-width="2"/>
           <text x="${plungerX}" y="${barrelY - 26}" text-anchor="middle" font-size="14" font-weight="bold" fill="#1e40af">${formatUnits(units)}</text>
           <text x="${plungerX}" y="${barrelY - 15}" text-anchor="middle" font-size="10" fill="#64748b">units</text>`;

    return `
    <div class="syringe-container">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
             role="img" aria-label="Draw ${formatUnits(units)} units on a ${syringeSize} unit insulin syringe">
            ${readout}

            <rect x="${barrelStartX}" y="${barrelY}" width="${barrelWidth}" height="${barrelHeight}"
                  fill="#f8fafc" stroke="#1e40af" stroke-width="3" rx="4"/>
            ${ticks}
            ${labels}

            <rect x="${barrelStartX + 2}" y="${barrelY + 2}"
                  width="${Math.max(0, plungerX - barrelStartX - 4)}" height="${barrelHeight - 4}"
                  fill="${fillColor}" opacity="0.8" rx="2"/>

            ${overflow ? '' : `
            <rect x="${plungerX - 2}" y="${barrelY - 5}" width="4" height="${barrelHeight + 10}" fill="#1e3a8a" rx="2"/>
            <rect x="${plungerX - 8}" y="${barrelY - 8}" width="16" height="4" fill="#1e3a8a" rx="2"/>`}

            <polygon points="${endX},${barrelY + 15} ${endX + 15},${barrelY + 20} ${endX},${barrelY + 25}" fill="#94a3b8"/>

            <text x="${barrelStartX + barrelWidth / 2}" y="${barrelY + barrelHeight / 2 + 5}"
                  text-anchor="middle" font-size="10" fill="#94a3b8" opacity="0.7">
                ${syringeSize}U Insulin Syringe
            </text>
        </svg>
    </div>
    `;
}

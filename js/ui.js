/**
 * UI Module - DOM manipulation and rendering
 */

import { RECON_VOLUMES, SYRINGE_SIZES, DEFAULT_SYRINGE, defaultReconMl } from './calculator.js';

export const DISCLAIMER_TITLE = 'Research information only - not medical advice';
export const DISCLAIMER_BODY =
    'Phenom Vital Labs publishes reference calculations for research peptides. Nothing here is ' +
    'a prescription, a diagnosis, or a recommendation to inject anything. Most of these compounds ' +
    'are not approved for human use, dosing conventions are drawn from community practice rather ' +
    'than controlled trials, and product identity, purity and sterility vary by supplier. ' +
    'Talk to a licensed physician before starting, changing or stopping any protocol, and ask your ' +
    'supplier for a lot-specific third-party certificate of analysis.';

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

    if (!peptide) {
        select.innerHTML = '<option value="">Select a peptide first</option>';
        select.disabled = true;
        return;
    }

    const chosen = peptide.vialSizes.includes(Number(preferred)) ? Number(preferred) : peptide.vialSize;

    select.innerHTML = peptide.vialSizes
        .map(s => `<option value="${s}"${s === chosen ? ' selected' : ''}>${s}${peptide.vialUnit}</option>`)
        .join('');
    // A blend's ratio is fixed by the vial, so there is nothing to choose.
    select.disabled = peptide.vialSizes.length === 1;
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

    select.innerHTML = RECON_VOLUMES
        .map(v => `<option value="${v}"${v === chosen ? ' selected' : ''}>${v} ml${v === fallback ? ' (recommended)' : ''}</option>`)
        .join('');
}

/**
 * Fill the syringe-size dropdown.
 * @param {number} [preferred]
 */
export function populateSyringeOptions(preferred) {
    const select = document.getElementById('syringe');
    const chosen = SYRINGE_SIZES.includes(Number(preferred)) ? Number(preferred) : DEFAULT_SYRINGE;

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
    const parts = results.components[level];

    const componentHtml = parts ? `
        <div class="component-split">
            ${parts.map(c => `<div><span>${esc(c.name)}</span><strong>${c.mcg.toLocaleString()} mcg</strong></div>`).join('')}
        </div>` : '';

    // Order matters. "Exceeds the vial" is the harder failure and has to win:
    // the syringe advice below tells you to use less water, which raises
    // concentration and lowers the unit count -- useless when the vial simply
    // does not contain this much peptide.
    const drawHtml = exceedsVial ? `
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
            ${cfg.featured ? '<div class="recommended-badge">Recommended</div>' : ''}
            <div class="dose-label ${level}">${cfg.label}</div>
            <div class="mcg-box">
                <div class="mcg-label">${cfg.sublabel}</div>
                <div class="mcg-value">${esc(formatDose(dose, results.doseUnit))}</div>
                ${componentHtml}
            </div>
            <div class="draw-box${overflow || exceedsVial ? ' overflow' : ''}">${drawHtml}</div>
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

    const cards = [
        ['low', { label: 'Conservative', sublabel: 'Starting Dose', delay: 0.2, hint: 'Best for first-time users' }],
        ['med', { label: 'Standard', sublabel: 'Recommended Dose', delay: 0.3, featured: true }],
        ['high', { label: 'Advanced', sublabel: 'Maximum Dose', delay: 0.4, hint: 'For experienced users' }]
    ].map(([level, cfg]) => doseCard(level, cfg, results)).join('');

    const componentNote = peptide.components ? `
        <p class="blend-note">
            This is a fixed blend: ${peptide.components.map(c => `${esc(c.name)} ${c.mg}mg`).join(' + ')} in one vial.
            The ratio cannot be changed, and the figures above are the <strong>combined</strong> dose &mdash;
            the per-peptide amount is shown under each.
        </p>` : '';

    const html = `
        <div class="results" style="display: block;">
            <div class="peptide-header animate-in">
                <h2>${esc(peptide.name)}</h2>
                <p>${esc(peptide.category)}</p>
            </div>

            <div class="summary-card animate-in" style="animation-delay: 0.1s;">
                <div class="summary-header">
                    <div class="summary-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                    </div>
                    <div class="summary-title">
                        <h3>Protocol</h3>
                        <p>${results.vialSize}${u} vial &middot; ${results.reconMl} ml bacteriostatic water &middot; ${trim(results.concentration, 2)} ${u}/ml</p>
                    </div>
                </div>

                <div class="dose-range">
                    <span class="dose-badge low">${esc(formatDose(results.doses.low, results.doseUnit))}</span>
                    <span class="dose-arrow" aria-hidden="true">→</span>
                    <span class="dose-badge med">${esc(formatDose(results.doses.med, results.doseUnit))}</span>
                    <span class="dose-arrow" aria-hidden="true">→</span>
                    <span class="dose-badge high">${esc(formatDose(results.doses.high, results.doseUnit))}</span>
                </div>

                <p class="scaling-note">
                    These are standard protocol doses for ${esc(peptide.name)}. They are <strong>not</strong> scaled to
                    body weight or age &mdash; almost no peptide in this class is dosed per kilogram. Your
                    ${inputs.weight} lbs / ${inputs.age} years are recorded on the protocol sheet for reference only.
                </p>
                ${componentNote}
            </div>

            <div class="dose-grid">${cards}</div>

            <div class="syringe-visual animate-in" style="animation-delay: 0.45s;">
                <h4>💉 Syringe Draw Guide (Recommended Dose)</h4>
                ${generateSyringeSVG(results.syringeUnits.med, results.syringe)}
                <p class="syringe-caption">
                    Pull to <strong>${formatUnits(results.syringeUnits.med)} units</strong>
                    on a ${results.syringe}U syringe for ${esc(formatDose(results.doses.med, results.doseUnit))}
                </p>
            </div>

            <div class="calc-box animate-in" style="animation-delay: 0.48s;">
                <h4>🧮 Your Calculation</h4>
                <ol class="calc-steps">
                    <li>Reconstitute: <strong>${results.vialSize}${u}</strong> vial &divide; <strong>${results.reconMl} ml</strong> water = <strong>${trim(results.concentration, 2)} ${u}/ml</strong></li>
                    <li>Dose: <strong>${esc(formatDose(results.doses.med, results.doseUnit))}</strong>${results.doseUnit === 'mcg' ? ` = ${trim(results.doses.med / 1000, 4)} mg` : ''}</li>
                    <li>Volume: &divide; ${trim(results.concentration, 2)} ${u}/ml = <strong>${results.volumeMl.med} ml</strong></li>
                    <li>Units: &times; 100 units/ml = <strong class="calc-answer">${formatUnits(results.syringeUnits.med)} units</strong></li>
                </ol>
                <p class="calc-footnote">
                    An insulin syringe is U-100: <strong>100 units per ml</strong>, whether the barrel holds 30, 50 or 100 units.
                    Barrel size limits how much you can draw at once &mdash; it does not change the reading.
                </p>
            </div>

            <div class="pdf-buttons animate-in" style="animation-delay: 0.5s;">
                <button class="btn" id="previewPDFTop" type="button">Preview PDF</button>
                <button class="btn" id="downloadPDFTop" type="button">Download PDF</button>
                <button class="btn btn-secondary" id="copyLink" type="button">Copy link</button>
            </div>

            <div class="info-grid animate-in" style="animation-delay: 0.55s;">
                <div class="info-card">
                    <div class="info-card-icon" aria-hidden="true">⏱️</div>
                    <h4>Half-Life</h4>
                    <p class="highlight">${esc(peptide.halfLife || 'N/A')}</p>
                    <small>Time in body</small>
                </div>
                <div class="info-card">
                    <div class="info-card-icon" aria-hidden="true">📅</div>
                    <h4>Frequency</h4>
                    <p class="highlight">${esc(peptide.freq || 'N/A')}</p>
                    <small>${peptide.f}x per week</small>
                </div>
                <div class="info-card">
                    <div class="info-card-icon" aria-hidden="true">🔄</div>
                    <h4>Cycle</h4>
                    <p class="highlight">${esc(peptide.cycle || peptide.wks + ' weeks')}</p>
                    <small>${results.dosesPerCycle} injections in full</small>
                </div>
                <div class="info-card highlight">
                    <div class="info-card-icon" aria-hidden="true">📦</div>
                    <h4>Vials Needed</h4>
                    <p class="big">${results.vialsNeeded}</p>
                    <small>${results.vialSize}${u} for the full cycle (${trim(results.totalCycle, 2)}${u} total)</small>
                </div>
            </div>

            <div class="pros-cons-grid animate-in" style="animation-delay: 0.6s;">
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
                <div class="pc-card warnings animate-in" style="animation-delay: 0.7s;">
                    <div class="pc-title warnings">Important Warnings</div>
                    <ul class="pc-list warnings">
                        ${peptide.warnings.map(w => `<li>${esc(w)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            <div class="research-box animate-in" style="animation-delay: 0.8s;">
                <h4>Research Overview</h4>
                <p>${esc(peptide.research)}</p>
            </div>

            <div class="mechanism-box animate-in" style="animation-delay: 0.9s;">
                <h4>How It Works</h4>
                <p>${esc(peptide.mechanism)}</p>
            </div>

            <div class="clinical-box animate-in" style="animation-delay: 0.95s;">
                <h4>Clinical Dosing Notes</h4>
                <ul class="clinical-list">
                    <li><strong>Bioavailability:</strong> 40-90% via subcutaneous route | Peak plasma: 2-6 hours post-injection</li>
                    <li><strong>Timing Strategy:</strong> Consistent daily timing reduces variability. ${getTimingRecommendation(peptide)}</li>
                    ${peptide.halfLife && peptide.halfLife !== 'Unknown' ? `<li><strong>Half-Life Guidance (${esc(peptide.halfLife)}):</strong> ${getHalfLifeGuidance(peptide.halfLife)}</li>` : ''}
                    <li><strong>Storage:</strong> Reconstituted vials keep roughly 4-6 weeks refrigerated at 2-8&deg;C in bacteriostatic water, and about 24 hours in plain sterile water. Write the mixing date on the vial.</li>
                    <li class="renal-warning"><strong>Renal Function:</strong> Patients with GFR &lt;60 may require 25-50% dose reduction. Peptides under 5 kDa are cleared renally.</li>
                </ul>
            </div>

            <div class="protocol-box animate-in" style="animation-delay: 1s;">
                <h3>Administration Instructions</h3>
                <ul class="protocol-list">
                    ${peptide.inst.map(i => `<li>${esc(i)}</li>`).join('')}
                </ul>
            </div>

            <div class="pdf-buttons animate-in" style="animation-delay: 1.1s;">
                <button class="btn" id="previewPDF" type="button">Preview Protocol PDF</button>
                <button class="btn" id="downloadPDF" type="button">Download PDF</button>
            </div>
        </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';

    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
        <div class="footer-disclaimer animate-in" style="animation-delay: 1.05s;" role="note">
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

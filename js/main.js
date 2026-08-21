/**
 * Main Entry Point - Peptide Calculator
 * Initializes UI and handles user interactions
 */

import { loadPeptideData, getPeptide } from './dataLoader.js';
import { validateInputs, performCalculation, DEFAULT_SYRINGE } from './calculator.js';
import {
    renderResults, populateWeightOptions, populateAgeOptions, populatePeptideOptions,
    populateSyringeOptions, updateReconOptions, showLoading, hideLoading,
    showInlineError, updateVialSizeForPeptide, setCustomVial, readVialSize
} from './ui.js';
import { generatePDF } from './pdfGenerator.js';
import { track } from './analytics.js';
import { requestEmail } from './emailCapture.js';
import { initThemeToggle } from './theme.js';
import { enhanceSelect } from './combobox.js';

let currentPeptide = null;
let peptideCombo = null;
let lastResults = null;
let lastInputs = null;

const $ = id => document.getElementById(id);

/**
 * Initialize the application
 */
async function init() {
    try {
        const peptidesData = await loadPeptideData();

        populatePeptideOptions(peptidesData);
        populateWeightOptions();
        populateAgeOptions();

        initThemeToggle();
        // Type-ahead over the 44 options. The <select> stays the source of
        // truth, so a failure here leaves a working native dropdown rather
        // than an unusable page.
        // loadPeptideData returns a map keyed by id, not an array.
        const records = Object.values(peptidesData);
        try {
            peptideCombo = enhanceSelect($('peptide'), { records, placeholder: `Search ${records.length} peptides...` });
        } catch (e) {
            console.warn('Peptide search unavailable, falling back to the plain dropdown:', e);
        }

        $('calculateBtn').addEventListener('click', () => handleCalculate(true));
        // Switching peptide has to move the result with it. It did not: after
        // calculating BPC-157 and then picking Tirzepatide, the dropdown read
        // Tirzepatide while the card below still read "BPC 157 - 500 mcg". The
        // vial and water controls already re-ran for exactly this reason; the
        // one control that changes the compound did not.
        $('peptide').addEventListener('change', () => {
            handlePeptideChange();
            if (currentPeptide) track('peptide_selected', { peptide: currentPeptide.id });
            if (!lastResults) return;
            if (currentPeptide) handleCalculate(true);
            else clearResults();
        });

        // Changing the vial or the water changes the answer, so re-run rather
        // than leaving a stale result on screen next to the new inputs.
        for (const id of ['vialSize', 'reconMl', 'syringe']) {
            $(id).addEventListener('change', () => { if (lastResults) handleCalculate(); });
        }

        // "Other" reveals a box for the number printed on the user's own vial.
        // Our catalogue is a convenience, not the authority on what is sold.
        $('vialSize').addEventListener('change', e => {
            if (e.target.value === 'custom') setCustomVial(true, currentPeptide);
            else setCustomVial(false, currentPeptide);
        });
        $('vialSizeCustom').addEventListener('input', () => {
            if (lastResults && readVialSize() > 0) handleCalculate();
        });

        // Weight and age moved behind a disclosure because they cannot change the
        // answer. Folded away is not the same as hidden: the summary keeps
        // showing what they are currently set to.
        syncOptionalSummary();
        for (const id of ['weight', 'age']) {
            $(id).addEventListener('change', () => {
                syncOptionalSummary();
                if (lastResults) handleCalculate();
            });
        }

        restoreFromUrl();
    } catch (error) {
        console.error('Failed to initialize:', error);
        showInlineError('Failed to load peptide data. Please refresh the page.');
    }
}

/**
 * Echo the folded-away weight and age onto the disclosure summary.
 */
function syncOptionalSummary() {
    const out = $('optionalValues');
    if (!out) return;
    const w = $('weight'), a = $('age');
    const wText = w && w.value ? `${w.options[w.selectedIndex].text}` : null;
    const aText = a && a.value ? `${a.options[a.selectedIndex].text}` : null;
    out.textContent = [wText, aText].filter(Boolean).join(' · ');
}

/**
 * Handle peptide selection change
 * @param {Object} [prefs] - Previously selected vial size / recon volume to keep
 */
function handlePeptideChange(prefs = {}) {
    const peptideId = $('peptide').value;
    currentPeptide = peptideId ? getPeptide(peptideId) : null;

    updateVialSizeForPeptide(currentPeptide, prefs.vialSize);
    updateReconOptions(currentPeptide, prefs.reconMl);
    populateSyringeOptions(prefs.syringe, currentPeptide);
}

/**
 * Drop a stale result rather than leave it under an empty selection.
 */
function clearResults() {
    lastResults = null;
    lastInputs = null;
    document.getElementById('results').innerHTML = '';
    document.body.classList.remove('has-results');
    hideAnswerDock();
    history.replaceState(null, '', window.location.pathname);
}

/**
 * Read the current form state.
 * @returns {Object}
 */
function readInputs() {
    return {
        peptide: currentPeptide,
        weight: parseInt($('weight').value, 10),
        age: parseInt($('age').value, 10),
        vialSize: readVialSize(),
        reconMl: parseFloat($('reconMl').value),
        syringe: parseInt($('syringe').value, 10)
    };
}

/**
 * Handle calculate button click
 */
async function handleCalculate(scrollToAnswer = false) {
    if (!currentPeptide) {
        showInlineError('Please select a peptide first');
        return;
    }

    const inputs = readInputs();
    const validation = validateInputs(inputs);
    if (!validation.valid) {
        showInlineError(validation.errors.join(', '));
        return;
    }

    showLoading();
    await new Promise(r => setTimeout(r, 200));

    lastResults = performCalculation(currentPeptide, {
        weightLbs: inputs.weight,
        vialSize: inputs.vialSize,
        reconMl: inputs.reconMl,
        syringe: inputs.syringe
    });
    lastInputs = inputs;

    hideLoading();
    renderResults(currentPeptide, lastResults, inputs);
    document.body.classList.add('has-results');
    updateAnswerDock(currentPeptide, lastResults);

    // Put the answer on screen. Re-running because a vial or water volume
    // changed must NOT scroll -- the user is standing at that control watching
    // the number move, and yanking the page away from them is worse than not
    // scrolling at all.
    if (scrollToAnswer) {
        const answer = document.getElementById('answer');
        if (answer) {
            const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            // 'instant' when the answer arrived with the page: a shared link is
            // opened FOR the protocol, so landing on it reads as where the page
            // starts. Animating there instead looks like the page moved on its own.
            answer.scrollIntoView({
                behavior: scrollToAnswer === 'instant' || reduce ? 'instant' : 'smooth',
                block: 'start'
            });
        }
    }

    // What was asked for, not who asked. Weight and age are deliberately absent.
    track('calculate', {
        peptide: currentPeptide.id,
        category: currentPeptide.category,
        reconMl: inputs.reconMl,
        syringe: inputs.syringe,
        overflow: lastResults.overflow.med ? 'yes' : 'no'
    });
    writeUrl(inputs);
    wireResultButtons();
}

/**
 * The answer bar that rides down the page.
 *
 * A result page is ~4,900px on a desktop and ~6,900px on a phone, and the units
 * a visitor came for sit in the top 12% of it. Everything below - the syringe
 * guide, the warnings, the administration notes - is read with the number off
 * screen. The bar mirrors the hero and reveals itself only once the hero has
 * actually scrolled out, so on a short result (or before anything is
 * calculated) it never appears at all.
 *
 * Uses IntersectionObserver where it exists and simply stays hidden where it
 * does not - a missing convenience bar is not a broken page.
 */
let dockObserver = null;

function updateAnswerDock(peptide, results) {
    const dock = $('answerDock');
    if (!dock) return;

    if (dockObserver) { dockObserver.disconnect(); dockObserver = null; }

    const hero = document.getElementById('answer');
    // A pre-filled pen has no draw at all, so there is no number to carry.
    if (!hero || !results || results.noRecon) { hideAnswerDock(); return; }

    const units = formatDockUnits(results.syringeUnits.med);
    $('dockName').textContent = peptide.name;
    $('dockDose').textContent = dockDoseText(results);
    $('dockUnits').textContent = units;
    $('dockUnitWord').textContent = units === '1' ? 'unit' : 'units';
    dock.classList.toggle('is-overflow', !!(results.overflow && results.overflow.med));

    if (typeof IntersectionObserver !== 'function') return;
    dockObserver = new IntersectionObserver(([entry]) => {
        // Only reveal once the hero is above the viewport. Scrolling back up
        // past it, or landing on it, leaves the bar out of the way.
        const gone = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        dock.hidden = !gone;
        document.body.classList.toggle('dock-visible', gone);
    }, { threshold: 0 });
    dockObserver.observe(hero);
}

function hideAnswerDock() {
    const dock = $('answerDock');
    if (dock) dock.hidden = true;
    document.body.classList.remove('dock-visible');
    if (dockObserver) { dockObserver.disconnect(); dockObserver = null; }
}

/** Trailing '.0' reads as false precision on a bar this small. */
function formatDockUnits(n) {
    return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : '--';
}

function dockDoseText(results) {
    const d = results.doses.med;
    const u = results.doseUnit || 'mcg';
    return `${Number.isInteger(d) ? d : Math.round(d * 100) / 100} ${u}`;
}

/**
 * Attach handlers to the buttons that only exist once results are rendered.
 */
function wireResultButtons() {
    const pdf = preview => async () => {
        track(preview ? 'pdf_preview' : 'pdf_download', { peptide: currentPeptide.id });

        // Preview stays frictionless; the ask rides the download only.
        if (!preview) {
            const { proceed } = await requestEmail({ source: 'pdf', peptide: currentPeptide.id });
            if (!proceed) return;
        }

        generatePDF(currentPeptide, lastResults, lastInputs, preview);
    };

    for (const id of ['downloadPDF', 'downloadPDFTop']) {
        const btn = $(id);
        if (btn) btn.onclick = pdf(false);
    }
    for (const id of ['previewPDF', 'previewPDFTop']) {
        const btn = $(id);
        if (btn) btn.onclick = pdf(true);
    }

    const copy = $('copyLink');
    if (copy) {
        copy.onclick = async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                track('copy_link', { peptide: currentPeptide.id });
                copy.textContent = 'Link copied';
                setTimeout(() => { copy.textContent = 'Copy link'; }, 2000);
            } catch {
                showInlineError('Could not copy - select the address bar instead.');
            }
        };
    }
}

/**
 * Mirror the current selection into the URL so a protocol can be bookmarked or
 * shared. Uses replaceState so the back button still leaves the page.
 * @param {Object} inputs
 */
function writeUrl(inputs) {
    const params = new URLSearchParams({
        p: inputs.peptide.id,
        w: inputs.weight,
        a: inputs.age,
        v: inputs.vialSize,
        r: inputs.reconMl,
        s: inputs.syringe
    });
    history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

/**
 * Restore a shared protocol from the URL, then recalculate it.
 */
function restoreFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('p');
    if (!id || !getPeptide(id)) {
        handlePeptideChange();
        return;
    }

    $('peptide').value = id;
    // Setting .value fires no change event, so the search box that now sits in
    // front of the select never hears about it. A shared link therefore drew a
    // full protocol under a peptide box still reading "Search 44 peptides...",
    // and every CTA from the 44 static pages lands on exactly this path.
    if (peptideCombo) peptideCombo.refresh();
    setIfPresent('weight', params.get('w'));
    setIfPresent('age', params.get('a'));

    handlePeptideChange({
        vialSize: params.get('v'),
        reconMl: params.get('r'),
        syringe: params.get('s') || DEFAULT_SYRINGE
    });

    handleCalculate('instant');
}

function setIfPresent(id, value) {
    if (value === null) return;
    const select = $(id);
    if ([...select.options].some(o => o.value === value)) select.value = value;
}

document.addEventListener('DOMContentLoaded', init);

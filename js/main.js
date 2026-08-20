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

let currentPeptide = null;
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

        $('calculateBtn').addEventListener('click', handleCalculate);
        $('peptide').addEventListener('change', () => handlePeptideChange());

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

        restoreFromUrl();
    } catch (error) {
        console.error('Failed to initialize:', error);
        showInlineError('Failed to load peptide data. Please refresh the page.');
    }
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
async function handleCalculate() {
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
    writeUrl(inputs);
    wireResultButtons();
}

/**
 * Attach handlers to the buttons that only exist once results are rendered.
 */
function wireResultButtons() {
    const pdf = preview => () => generatePDF(currentPeptide, lastResults, lastInputs, preview);

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
    setIfPresent('weight', params.get('w'));
    setIfPresent('age', params.get('a'));

    handlePeptideChange({
        vialSize: params.get('v'),
        reconMl: params.get('r'),
        syringe: params.get('s') || DEFAULT_SYRINGE
    });

    handleCalculate();
}

function setIfPresent(id, value) {
    if (value === null) return;
    const select = $(id);
    if ([...select.options].some(o => o.value === value)) select.value = value;
}

document.addEventListener('DOMContentLoaded', init);

/**
 * Main Entry Point - Peptide Calculator
 * Initializes UI and handles user interactions
 */

import { loadPeptideData, getPeptide } from './dataLoader.js';
import { validateInputs, performCalculation } from './calculator.js';
import { renderResults, populateWeightOptions, populateAgeOptions, populatePeptideOptions, showLoading, hideLoading, showInlineError, updateVialSizeForPeptide } from './ui.js';
import { generatePDF } from './pdfGenerator.js';

// Global state
let currentPeptide = null;
let peptidesData = null;

/**
 * Initialize the application
 */
async function init() {
    try {
        // Load peptide data
        peptidesData = await loadPeptideData();
        
        // Populate dropdowns
        populatePeptideOptions(peptidesData);
        populateWeightOptions();
        populateAgeOptions();
        
        // Setup event listeners
        document.getElementById('calculateBtn').addEventListener('click', handleCalculate);
        document.getElementById('peptide').addEventListener('change', handlePeptideChange);
        
        console.log('Peptide Calculator initialized successfully');
    } catch (error) {
        console.error('Failed to initialize:', error);
        showInlineError('Failed to load peptide data. Please refresh the page.');
    }
}

/**
 * Handle peptide selection change
 */
function handlePeptideChange(e) {
    const peptideId = e.target.value;
    currentPeptide = peptideId ? getPeptide(peptideId) : null;
    
    // Update vial size based on peptide type
    updateVialSizeForPeptide(currentPeptide);
}

/**
 * Handle calculate button click
 */
async function handleCalculate() {
    if (!currentPeptide) {
        showInlineError('Please select a peptide first');
        return;
    }
    
    const weight = parseInt(document.getElementById('weight').value);
    const age = parseInt(document.getElementById('age').value);
    
    if (!weight || !age) {
        showInlineError('Please select both weight and age');
        return;
    }
    
    showLoading();
    
    // Small delay for UX
    await new Promise(r => setTimeout(r, 300));
    
    const inputs = {
        weight,
        age,
        peptide: currentPeptide,
        vialSize: parseInt(document.getElementById('vialSize').value),
        syringe: 50 // Default to 50U for all calculations
    };
    
    // Validate
    const validation = validateInputs(inputs);
    if (!validation.valid) {
        hideLoading();
        showInlineError(validation.errors.join(', '));
        return;
    }
    
    // Perform calculation
    const results = performCalculation(
        inputs.peptide,
        inputs.weight,
        inputs.age,
        inputs.vialSize,
        inputs.syringe
    );
    
    hideLoading();
    
    // Render results
    renderResults(currentPeptide, results, {
        weight: inputs.weight,
        age: inputs.age,
        vialSize: inputs.vialSize,
        syringe: inputs.syringe
    });
    
    // Setup PDF buttons
    const downloadBtn = document.getElementById('downloadPDF');
    const previewBtn = document.getElementById('previewPDF');
    
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            generatePDF(currentPeptide, results, {
                weight: inputs.weight,
                age: inputs.age,
                vialSize: inputs.vialSize,
                syringe: inputs.syringe
            });
        };
    }
    
    if (previewBtn) {
        previewBtn.onclick = () => {
            generatePDF(currentPeptide, results, {
                weight: inputs.weight,
                age: inputs.age,
                vialSize: inputs.vialSize,
                syringe: inputs.syringe
            }, true); // true = preview mode
        };
    }
}



// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

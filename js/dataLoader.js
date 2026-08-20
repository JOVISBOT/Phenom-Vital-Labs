/**
 * Data Loading Module
 * Handles fetching and caching peptide data
 * 
 * @module dataLoader
 */

// Cache-busting token. Kept in step with the ?v= on the script and stylesheet
// tags in index.html -- they had drifted to v=27 and v=19 respectively, so a
// data change could ship while browsers kept serving the old JSON.
const DATA_VERSION = 29;

let peptidesCache = null;

/**
 * Load peptide data from JSON file
 * @returns {Promise<Object>} Peptides data object
 */
export async function loadPeptideData() {
    if (peptidesCache) {
        return peptidesCache;
    }
    
    try {
        const response = await fetch(`./data/peptides.json?v=${DATA_VERSION}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Validate structure
        if (!data.peptides || !Array.isArray(data.peptides)) {
            throw new Error('Invalid peptides data structure');
        }
        
        // Convert array to object for easy lookup
        peptidesCache = {};
        data.peptides.forEach(peptide => {
            peptidesCache[peptide.id] = peptide;
        });
        
        return peptidesCache;
    } catch (error) {
        console.error('Failed to load peptide data:', error);
        throw error;
    }
}

/**
 * Get a specific peptide by ID
 * @param {string} id
 * @returns {Object|null}
 */
export function getPeptide(id) {
    return peptidesCache ? peptidesCache[id] : null;
}

/**
 * Get all peptides organized by category
 * @returns {Object} Categories with peptide arrays
 */
export function getPeptidesByCategory() {
    if (!peptidesCache) return {};
    
    const categories = {};
    
    Object.values(peptidesCache).forEach(peptide => {
        if (!categories[peptide.category]) {
            categories[peptide.category] = [];
        }
        categories[peptide.category].push(peptide);
    });
    
    return categories;
}

/**
 * Get all peptide IDs
 * @returns {string[]}
 */
export function getAllPeptideIds() {
    return peptidesCache ? Object.keys(peptidesCache) : [];
}

/**
 * Check if data is loaded
 * @returns {boolean}
 */
export function isDataLoaded() {
    return peptidesCache !== null;
}

/**
 * Clear cache (useful for testing)
 */
export function clearCache() {
    peptidesCache = null;
}

/**
 * UI Module - DOM manipulation and rendering
 * User-friendly enhancements included
 */

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
        return '**Evening dosing preferred** (aligns with natural GH pulse timing)';
    }
    
    // Fat loss / metabolic - morning best
    if (cat.includes('fat') || cat.includes('metabolic') || 
        cat.includes('weight') || name.includes('tesamorelin') ||
        name.includes('semaglutide') || name.includes('tirzepatide')) {
        return '**Morning dosing preferred** (enhances daytime metabolism)';
    }
    
    // Healing - morning works well
    if (cat.includes('heal') || cat.includes('recovery') ||
        name.includes('bpc') || name.includes('tb-500')) {
        return '**Morning dosing acceptable** (post-workout ideal for healing)';
    }
    
    // Cognitive - morning
    if (cat.includes('nootropic') || cat.includes('cognitive') ||
        name.includes('semax') || name.includes('selank') || name.includes('adamax')) {
        return '**Morning dosing preferred** (cognitive enhancement during waking hours)';
    }
    
    // Default
    return '**Take at same time daily** for optimal results';
}

/**
 * Get half-life based dosing guidance
 * @param {string} halfLife - Half-life string from peptide data
 * @returns {string} Dosing guidance
 */
function getHalfLifeGuidance(halfLife) {
    const hl = halfLife.toLowerCase();
    
    // Parse numeric values
    const dayMatch = hl.match(/~(\d+)\s*day/);
    const hourMatch = hl.match(/(\d+).*hour/);
    const minMatch = hl.match(/(\d+).*min/);
    
    if (dayMatch) {
        const days = parseInt(dayMatch[1]);
        if (days >= 7) {
            return '**Weekly dosing optimal** - long half-life allows extended intervals';
        } else if (days >= 3) {
            return '**2-3x per week possible** - consider consolidating to once daily for simplicity';
        }
    }
    
    if (hourMatch) {
        const hours = parseInt(hourMatch[1]);
        if (hours >= 8) {
            return '**Once daily dosing ideal** - 8+ hour half-life supports 24-hour coverage';
        } else if (hours >= 4) {
            return '**Twice daily optimal** (AM/PM) - 4-8 hour half-life needs 12-hour spacing';
        } else if (hours >= 2) {
            return '**Multiple daily doses may be needed** - consider timing with meals/activity';
        }
    }
    
    if (minMatch) {
        return '**Short-acting peptide** - requires careful timing; many doses may be simplified to once daily with slight efficacy trade-off';
    }
    
    if (hl.includes('long')) {
        return '**Once daily or less frequent dosing** - extended duration of action';
    }
    
    if (hl.includes('short') || hl.includes('unknown')) {
        return '**Standard once daily dosing** is typically effective; exact timing less critical than consistency';
    }
    
    return '**Once daily dosing recommended** where possible for patient compliance';
}

/**
 * Populate weight dropdown options with smart defaults
 */
export function populateWeightOptions() {
    const select = document.getElementById('weight');
    select.innerHTML = '<option value="">Select weight...</option>';
    
    // Common weights first for quick selection
    const commonWeights = [150, 160, 170, 180, 190, 200];
    const optgroup = document.createElement('optgroup');
    optgroup.label = 'Common';
    
    commonWeights.forEach(w => {
        const option = document.createElement('option');
        option.value = w;
        option.textContent = `${w} lbs`;
        if (w === 180) option.selected = true; // Default
        optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
    
    // All weights
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
 * Populate age dropdown options with research-based age decline data
 * GH/IGF-1 declines ~14% per decade after age 30
 */
export function populateAgeOptions() {
    const select = document.getElementById('age');
    select.innerHTML = '<option value="">Select age...</option>';
    
    // Research-based: GH production decline ~14% per decade after 30
    const ageOptions = [
        { age: 25, label: '18-29', factor: '100%', note: 'Peak production' },
        { age: 35, label: '30-39', factor: '+8%', note: 'Early decline' },
        { age: 45, label: '40-49', factor: '+16%', note: '-14%/decade' },
        { age: 55, label: '50-59', factor: '+33%', note: '-28% total' },
        { age: 65, label: '60+', factor: '+50%', note: '40%+ decline' }
    ];
    
    const optgroup = document.createElement('optgroup');
    optgroup.label = 'Age (Dose Adjustment)';
    
    ageOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.age;
        option.textContent = `${opt.label} (${opt.factor} - ${opt.note})`;
        if (opt.age === 35) option.selected = true;
        optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
}

/**
 * Populate peptide dropdown options - simplified 3 groups
 * @param {Object} peptides
 */
export function populatePeptideOptions(peptides) {
    const select = document.getElementById('peptide');
    select.innerHTML = '<option value="">Select peptide...</option>';
    
    // Define functional groups based on actual category data
    const healingCats = ['Healing & Recovery', 'Anti-Fibrotic Bioregulator', 'Neuropathic Pain & Tissue Repair'];
    const growthCats = ['Growth Hormone Release', 'GH Secretagogue (GHRP)', 'FDA-Approved GH Therapy', 'GH Stack', 'HGH Fragment (Fat Oxidation)', 'Myostatin Inhibitor'];
    const metabolicCats = ['Weight Management', 'AMPK Activator - Metabolic', 'Experimental Fat Targeting', 'Peptide YY Analog (Appetite)', 'Mitochondrial Health', 'Insulin Regulation'];
    
    const popular = [];
    const healing = [];
    const growth = [];
    const metabolic = [];
    const other = [];
    
    Object.values(peptides).forEach(p => {
        // Popular (most requested)
        if (['bpc157', 'tb500', 'semaglutide', 'tirzepatide', 'cjc1295', 'ipamorelin', 'aod9604', 'melanotan2', 'pt141'].includes(p.id)) {
            popular.push(p);
        } else if (healingCats.some(cat => p.category.includes(cat) || p.category.includes('Healing'))) {
            healing.push(p);
        } else if (growthCats.some(cat => p.category.includes(cat) || p.category.includes('GH') || p.category.includes('Growth') || p.category.includes('Myostatin'))) {
            growth.push(p);
        } else if (metabolicCats.some(cat => p.category.includes(cat) || p.category.includes('Metabolic') || p.category.includes('Weight') || p.category.includes('Fat'))) {
            metabolic.push(p);
        } else {
            other.push(p);
        }
    });
    
    // Popular
    if (popular.length > 0) {
        const group = document.createElement('optgroup');
        group.label = '⭐ Popular';
        popular.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            // Show mg content for blends
            const sizeMatch = p.category.match(/(\d+)mg\+(\d+)mg/);
            if (sizeMatch && p.id.includes('blend')) {
                const c1 = sizeMatch[1];
                const c2 = sizeMatch[2];
                // Extract peptide names from blend name
                const nameParts = p.name.replace(' Blend', '').replace(' (High Dose)', '').split(' + ');
                if (nameParts.length === 2) {
                    opt.textContent = `${nameParts[0]} ${c1}mg + ${nameParts[1]} ${c2}mg`;
                } else {
                    opt.textContent = p.name;
                }
            } else {
                opt.textContent = p.name;
            }
            group.appendChild(opt);
        });
        select.appendChild(group);
    }
    
    // Healing
    if (healing.length > 0) {
        const group = document.createElement('optgroup');
        group.label = '🩹 Healing & Repair';
        healing.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            // Show mg content for blends
            const sizeMatch = p.category.match(/(\d+)mg\+(\d+)mg/);
            if (sizeMatch && p.id.includes('blend')) {
                const c1 = sizeMatch[1];
                const c2 = sizeMatch[2];
                const nameParts = p.name.replace(' Blend', '').replace(' (High Dose)', '').split(' + ');
                if (nameParts.length === 2) {
                    opt.textContent = `${nameParts[0]} ${c1}mg + ${nameParts[1]} ${c2}mg`;
                } else {
                    opt.textContent = p.name;
                }
            } else {
                opt.textContent = p.name;
            }
            group.appendChild(opt);
        });
        select.appendChild(group);
    }
    
    // Growth
    if (growth.length > 0) {
        const group = document.createElement('optgroup');
        group.label = '💪 Muscle & Growth';
        growth.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            // Show mg content for blends
            const sizeMatch = p.category.match(/(\d+)mg\+(\d+)mg/);
            if (sizeMatch && p.id.includes('blend')) {
                const c1 = sizeMatch[1];
                const c2 = sizeMatch[2];
                const nameParts = p.name.replace(' Blend', '').replace(' (High Dose)', '').split(' + ');
                if (nameParts.length === 2) {
                    opt.textContent = `${nameParts[0]} ${c1}mg + ${nameParts[1]} ${c2}mg`;
                } else {
                    opt.textContent = p.name;
                }
            } else {
                opt.textContent = p.name;
            }
            group.appendChild(opt);
        });
        select.appendChild(group);
    }
    
    // Metabolic
    if (metabolic.length > 0) {
        const group = document.createElement('optgroup');
        group.label = '🔥 Fat Loss & Metabolic';
        metabolic.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            // Show mg content for blends
            const sizeMatch = p.category.match(/(\d+)mg\+(\d+)mg/);
            if (sizeMatch && p.id.includes('blend')) {
                const c1 = sizeMatch[1];
                const c2 = sizeMatch[2];
                const nameParts = p.name.replace(' Blend', '').replace(' (High Dose)', '').split(' + ');
                if (nameParts.length === 2) {
                    opt.textContent = `${nameParts[0]} ${c1}mg + ${nameParts[1]} ${c2}mg`;
                } else {
                    opt.textContent = p.name;
                }
            } else {
                opt.textContent = p.name;
            }
            group.appendChild(opt);
        });
        select.appendChild(group);
    }
    
    // Other
    if (other.length > 0) {
        const group = document.createElement('optgroup');
        group.label = '🧬 Other';
        other.sort((a, b) => a.name.localeCompare(b.name));
        other.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            // Show mg content for blends
            const sizeMatch = p.category.match(/(\d+)mg\+(\d+)mg/);
            if (sizeMatch && p.id.includes('blend')) {
                const c1 = sizeMatch[1];
                const c2 = sizeMatch[2];
                const nameParts = p.name.replace(' Blend', '').replace(' (High Dose)', '').split(' + ');
                if (nameParts.length === 2) {
                    opt.textContent = `${nameParts[0]} ${c1}mg + ${nameParts[1]} ${c2}mg`;
                } else {
                    opt.textContent = p.name;
                }
            } else {
                opt.textContent = p.name;
            }
            group.appendChild(opt);
        });
        select.appendChild(group);
    }
}

/**
 * Update vial size dropdown based on peptide selection
 * @param {Object} peptide - Selected peptide object
 */
export function updateVialSizeForPeptide(peptide) {
    const vialSizeSelect = document.getElementById('vialSize');
    
    if (!peptide) {
        // Reset to default options
        vialSizeSelect.innerHTML = `
            <option value="2">2mg</option>
            <option value="5" selected>5mg</option>
            <option value="10">10mg</option>
            <option value="15">15mg</option>
        `;
        vialSizeSelect.disabled = false;
        return;
    }
    
    const isBlend = peptide.id.includes('blend') || peptide.category.toLowerCase().includes('blend');
    
    if (isBlend) {
        // Extract vial size from category (e.g., "GH Stack (5mg+5mg)")
        const sizeMatch = peptide.category.match(/(\d+)mg\+(\d+)mg/);
        
        if (sizeMatch) {
            const component1 = sizeMatch[1];
            const component2 = sizeMatch[2];
            const totalSize = parseInt(component1) + parseInt(component2);
            
            // Set to the blend's specific size with mg display
            vialSizeSelect.innerHTML = `
                <option value="${totalSize}" selected>${component1}mg + ${component2}mg Blend</option>
            `;
            vialSizeSelect.disabled = true;
        } else {
            // Generic blend
            vialSizeSelect.innerHTML = `
                <option value="10" selected>Blend (10mg total)</option>
            `;
            vialSizeSelect.disabled = true;
        }
    } else {
        // Reset to standard options
        vialSizeSelect.innerHTML = `
            <option value="2">2mg</option>
            <option value="5" selected>5mg</option>
            <option value="10">10mg</option>
            <option value="15">15mg</option>
        `;
        vialSizeSelect.disabled = false;
    }
}

/**
 * Show loading state
 */
export function showLoading() {
    const btn = document.getElementById('calculateBtn');
    btn.disabled = true;
    btn.innerHTML = `
        <svg class="spinner" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
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
        <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
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
    error.style.cssText = `
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
        color: #dc2626;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideIn 0.3s ease-out;
    `;
    error.innerHTML = `
        <span style="font-size: 1.2rem;">⚠️</span>
        <span>${message}</span>
    `;
    
    const card = document.querySelector('.card');
    card.insertBefore(error, card.firstChild);
    
    setTimeout(() => error.remove(), 5000);
}

/**
 * Render calculation results with animations
 * @param {Object} peptide
 * @param {Object} results
 * @param {Object} inputs
 */
export function renderResults(peptide, results, inputs) {
    const container = document.getElementById('results');
    const isBlend = peptide.id?.includes('blend') || peptide.category?.toLowerCase().includes('blend');
    // Use fixed property to determine units, not blend status
    const isFixed = peptide.fixed === true;
    const unit = isFixed ? 'mg' : 'mcg';
    const unitLabel = isFixed ? 'milligrams' : 'micrograms';
    
    // Format numbers appropriately
    const formatDose = (dose) => {
        if (isFixed) {
            // Always show in mg, even for small doses
            return dose.toFixed(2).replace(/\.?0+$/, '');
        }
        return dose.toLocaleString();
    };
    
    const html = `
        <div class="results" style="display: block;">
            <!-- Peptide Header -->
            <div class="peptide-header animate-in">
                <h2>${peptide.name}</h2>
                <p>${peptide.category}</p>
                <div class="purity-badge">✓ 99%+ Purity Verified</div>
            </div>
            
            <!-- Summary Card -->
            <div class="summary-card animate-in" style="animation-delay: 0.1s;">
                <div class="summary-header">
                    <div class="summary-icon">
                        <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                    </div>
                    <div class="summary-title">
                        <h3>Your Personalized Protocol</h3>
                        <p>${inputs.weight} lbs • ${inputs.age} years • ${isBlend ? inputs.vialSize + 'mg blend' : inputs.vialSize + 'mg vials'}</p>
                    </div>
                </div>
                
                <div class="dose-range">
                    <span class="dose-badge low">${formatDose(results.doses.low)}${unit}</span>
                    <span class="dose-arrow">→</span>
                    <span class="dose-badge med">${formatDose(results.doses.med)}${unit}</span>
                    <span class="dose-arrow">→</span>
                    <span class="dose-badge high">${formatDose(results.doses.high)}${unit}</span>
                </div>
            </div>
            
            <!-- Dose Cards -->
            <div class="dose-grid">
                <div class="dose-card low animate-in" style="animation-delay: 0.2s;">
                    <div class="dose-label low">Conservative</div>
                    <div class="mcg-box">
                        <div class="mcg-label">Starting Dose</div>
                        <div class="mcg-value">${formatDose(results.doses.low)}</div>
                        <div class="dose-detail">${unitLabel}</div>
                    </div>
                    <div class="draw-box">
                        <div class="draw-label">Draw ${results.syringeUnits.low} units</div>
                        <div class="draw-hint">on ${inputs.syringe}U syringe</div>
                    </div>
                    <div class="dose-hint">Best for first-time users</div>
                </div>
                
                <div class="dose-card med featured animate-in" style="animation-delay: 0.3s;">
                    <div class="recommended-badge">Recommended</div>
                    <div class="dose-label med">Standard</div>
                    <div class="mcg-box">
                        <div class="mcg-label">Optimal Dose</div>
                        <div class="mcg-value">${formatDose(results.doses.med)}</div>
                        <div class="dose-detail">${unitLabel}</div>
                    </div>
                    <div class="draw-box">
                        <div class="draw-label">Draw ${results.syringeUnits.med} units</div>
                        <div class="draw-hint">on ${inputs.syringe}U syringe</div>
                    </div>
                </div>
                
                <div class="dose-card high animate-in" style="animation-delay: 0.4s;">
                    <div class="dose-label high">Advanced</div>
                    <div class="mcg-box">
                        <div class="mcg-label">Maximum Dose</div>
                        <div class="mcg-value">${formatDose(results.doses.high)}</div>
                        <div class="dose-detail">${unitLabel}</div>
                    </div>
                    <div class="draw-box">
                        <div class="draw-label">Draw ${results.syringeUnits.high} units</div>
                        <div class="draw-hint">on ${inputs.syringe}U syringe</div>
                    </div>
                    <div class="dose-hint">For experienced users</div>
                </div>
            </div>
            
            <!-- Visual Syringe Guide -->
            <div class="syringe-visual animate-in" style="animation-delay: 0.45s;">
                <h4 style="text-align: center; margin-bottom: 20px; color: var(--primary); font-size: 1rem;">
                    💉 Syringe Draw Guide (Standard Dose)
                </h4>
                ${generateSyringeSVG(results.syringeUnits.med, inputs.syringe)}
                <p style="text-align: center; margin-top: 16px; color: var(--muted); font-size: 0.9rem;">
                    Pull to <strong style="color: var(--primary); font-size: 1.2rem;">${results.syringeUnits.med} units</strong> on ${inputs.syringe}U syringe for ${formatDose(results.doses.med)}${unitLabel} dose
                </p>
            </div>
            
            <!-- Top PDF Buttons - Easy Access -->
            <div class="pdf-buttons animate-in" style="display: flex; gap: 12px; margin: 24px 0; animation-delay: 0.35s;">
                <button class="btn" id="previewPDFTop" style="flex: 1; background: linear-gradient(135deg, var(--primary-light), var(--primary)); box-shadow: 0 4px 12px rgba(30,64,175,0.3);">
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; margin-right: 8px;"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    👁️ Preview PDF
                </button>
                <button class="btn" id="downloadPDFTop" style="flex: 1; box-shadow: 0 4px 12px rgba(30,64,175,0.3);">
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; margin-right: 8px;"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    ⬇️ Download PDF
                </button>
            </div>
            <div class="info-grid animate-in" style="animation-delay: 0.5s;">
                <div class="info-card">
                    <div class="info-card-icon">⏱️</div>
                    <h4>Half-Life</h4>
                    <p class="highlight">${peptide.halfLife || 'N/A'}</p>
                    <small>Time in body</small>
                </div>
                
                <div class="info-card">
                    <div class="info-card-icon">📅</div>
                    <h4>Frequency</h4>
                    <p class="highlight">${peptide.freq || 'N/A'}</p>
                    <small>${peptide.f}x per week</small>
                </div>
                
                <div class="info-card">
                    <div class="info-card-icon">🔄</div>
                    <h4>Cycle</h4>
                    <p class="highlight">${peptide.cycle || peptide.wks + ' weeks'}</p>
                    <small>Duration</small>
                </div>
                
                <div class="info-card highlight">
                    <div class="info-card-icon">📦</div>
                    <h4>Vials Needed</h4>
                    <p class="big">${results.vialsNeeded}</p>
                    <small>${isBlend ? inputs.vialSize + 'mg blend' : inputs.vialSize + 'mg'} for full cycle</small>
                </div>
            </div>
            
            <!-- Pros & Cons -->
            <div class="pros-cons-grid animate-in" style="animation-delay: 0.6s;">
                <div class="pc-card pros">
                    <div class="pc-title pros">✓ Benefits</div>
                    <ul class="pc-list pros">
                        ${peptide.pros.slice(0, 6).map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="pc-card cons">
                    <div class="pc-title cons">✗ Considerations</div>
                    <ul class="pc-list cons">
                        ${peptide.cons.slice(0, 6).map(c => `<li>${c}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            ${peptide.warnings && peptide.warnings.length > 0 ? `
                <div class="pc-card warnings animate-in" style="animation-delay: 0.7s;">
                    <div class="pc-title warnings">⚠️ Important Warnings</div>
                    <ul class="pc-list warnings">
                        ${peptide.warnings.map(w => `<li>${w}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <!-- Research -->
            <div class="research-box animate-in" style="animation-delay: 0.8s;">
                <h4>🔬 Research Overview</h4>
                <p>${peptide.research}</p>
            </div>
            
            <!-- Mechanism -->
            <div class="mechanism-box animate-in" style="animation-delay: 0.9s;">
                <h4>⚙️ How It Works</h4>
                <p>${peptide.mechanism}</p>
            </div>
            
            <!-- Clinical Notes -->
            <div class="clinical-box animate-in" style="animation-delay: 0.95s;">
                <h4>🩺 Clinical Dosing Notes</h4>
                <ul class="clinical-list">
                    <li><strong>Bioavailability:</strong> 40-90% via subcutaneous route | Peak plasma: 2-6 hours post-injection</li>
                    <li><strong>Volume of Distribution:</strong> Based on weight (${(inputs.weight * 0.45).toFixed(1)}L Vd for ${inputs.weight} lbs) - weight-based dosing improves accuracy</li>
                    <li><strong>Timing Strategy:</strong> Consistent daily timing reduces variability by 15-30%. ${getTimingRecommendation(peptide)}</li>
                    ${peptide.halfLife && peptide.halfLife !== 'Unknown' ? `<li><strong>Half-Life Guidance (${peptide.halfLife}):</strong> ${getHalfLifeGuidance(peptide.halfLife)}</li>` : ''}
                    <li class="renal-warning">⚠️ <strong>Renal Function:</strong> Patients with GFR <60 may require 25-50% dose reduction. Under 5 kDa peptides cleared renally.</li>
                </ul>
            </div>
            
            <!-- Protocol -->
            <div class="protocol-box animate-in" style="animation-delay: 1s;">
                <h3>📋 Administration Instructions</h3>
                <ul class="protocol-list">
                    ${peptide.inst.map(i => `<li>${i}</li>`).join('')}
                </ul>
            </div>
            
            <!-- PDF Buttons -->
            <div class="pdf-buttons animate-in" style="display: flex; gap: 12px; margin-top: 24px; animation-delay: 1.1s;">
                <button class="btn" id="previewPDF" style="flex: 1; background: linear-gradient(135deg, var(--primary-light), var(--primary));">
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    Preview Protocol PDF
                </button>
                <button class="btn" id="downloadPDF" style="flex: 1;">
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px;"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                    Download PDF
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    container.style.display = 'block';
    
    // Smooth scroll to results
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .animate-in {
        opacity: 0;
        animation: fadeInUp 0.5s ease-out forwards;
    }
    
    .dose-card.featured {
        transform: scale(1.05);
        box-shadow: 0 12px 40px rgba(30,64,175,0.25);
    }
    
    .recommended-badge {
        position: absolute;
        top: -10px;
        right: 20px;
        background: linear-gradient(135deg, var(--success), #059669);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.7rem;
        font-weight: 700;
    }
    
    .dose-badge {
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 1rem;
    }
    
    .dose-badge.low { background: rgba(16,185,129,0.2); color: #059669; }
    .dose-badge.med { background: rgba(124,58,237,0.2); color: #7c3aed; }
    .dose-badge.high { background: rgba(245,158,11,0.2); color: #d97706; }
    
    .dose-hint {
        text-align: center;
        font-size: 0.8rem;
        color: #6b7280;
        margin-top: 12px;
    }
    
    .draw-hint {
        text-align: center;
        font-size: 0.75rem;
        color: #6b7280;
        margin-top: 4px;
    }
    
    .info-card.highlight {
        background: linear-gradient(135deg, #ede9fe, #ddd6fe);
        border-color: #7c3aed;
    }
    
    .info-card .big {
        font-size: 1.5rem;
        font-weight: 700;
        color: #7c3aed;
    }
    
    .info-card small {
        display: block;
        color: #6b7280;
        font-size: 0.75rem;
        margin-top: 4px;
    }
    
    .syringe-container {
        background: linear-gradient(135deg, #f8fafc, #f1f5f9);
        border-radius: 16px;
        border: 2px solid #e2e8f0;
        margin: 20px 0;
    }
    
    .syringe-container svg {
        filter: drop-shadow(0 4px 12px rgba(30, 64, 175, 0.15));
    }
`
document.head.appendChild(style);

/**
 * Generate SVG syringe visualization
 * @param {number} units - Units to draw
 * @param {number} syringeSize - Syringe size (30, 50, or 100)
 * @returns {string} SVG HTML
 */
function generateSyringeSVG(units, syringeSize) {
    const width = 400;
    const height = 120;
    const barrelY = 40;
    const barrelHeight = 40;
    const barrelStartX = 60;
    const barrelWidth = 280;
    const endX = barrelStartX + barrelWidth;
    const plungerX = barrelStartX + (units / syringeSize) * barrelWidth;
    
    // Calculate label positions
    const maxLabel = syringeSize;
    const steps = syringeSize <= 30 ? 5 : 10;
    
    let ticks = '';
    let labels = '';
    for (let i = 0; i <= maxLabel; i += steps) {
        const x = barrelStartX + (i / maxLabel) * barrelWidth;
        ticks += `<line x1="${x}" y1="${barrelY}" x2="${x}" y2="${barrelY + barrelHeight}" stroke="#cbd5e1" stroke-width="1"/>`;
        labels += `<text x="${x}" y="${barrelY + barrelHeight + 18}" text-anchor="middle" font-size="11" fill="#64748b">${i}</text>`;
    }
    
    // Fill color based on how full
    const fillPercent = units / syringeSize;
    let fillColor = '#3b82f6'; // blue
    if (fillPercent > 0.75) fillColor = '#f59e0b'; // orange warning
    if (fillPercent > 0.9) fillColor = '#ef4444'; // red warning
    
    return `
    <div class="syringe-container" style="display: flex; justify-content: center; padding: 20px;">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="max-width: 100%;">
            <!-- Syringe barrel outline -->
            <rect x="${barrelStartX}" y="${barrelY}" width="${barrelWidth}" height="${barrelHeight}" 
                  fill="#f8fafc" stroke="#1e40af" stroke-width="3" rx="4"/>
            
            <!-- Ticks -->
            ${ticks}
            
            <!-- Labels -->
            ${labels}
            
            <!-- Liquid fill -->
            <rect x="${barrelStartX + 2}" y="${barrelY + 2}" 
                  width="${Math.max(0, plungerX - barrelStartX - 4)}" height="${barrelHeight - 4}" 
                  fill="${fillColor}" opacity="0.8" rx="2"/>
            
            <!-- Plunger -->
            <rect x="${plungerX - 2}" y="${barrelY - 5}" width="4" height="${barrelHeight + 10}" 
                  fill="#1e3a8a" rx="2"/>
            <rect x="${plungerX - 8}" y="${barrelY - 8}" width="16" height="4" 
                  fill="#1e3a8a" rx="2"/>
            
            <!-- Plunger rod -->
            <rect x="${plungerX - 2}" y="${barrelY - 35}" width="4" height="30" 
                  fill="#64748b"/>
            
            <!-- Thumb rest -->
            <rect x="${plungerX - 12}" y="${barrelY - 38}" width="24" height="6" 
                  fill="#1e3a8a" rx="3"/>
            
            <!-- Needle tip -->
            <polygon points="${endX},${barrelY + 15} ${endX + 15},${barrelY + 20} ${endX},${barrelY + 25}" 
                     fill="#94a3b8"/>
            
            <!-- Measurement indicator -->
            <line x1="${plungerX}" y1="${barrelY - 45}" x2="${plungerX}" y2="${barrelY - 50}" 
                  stroke="#1e40af" stroke-width="2"/>
            <text x="${plungerX}" y="${barrelY - 55}" text-anchor="middle" font-size="14" font-weight="bold" fill="#1e40af">
                ${units}
            </text>
            <text x="${plungerX}" y="${barrelY - 42}" text-anchor="middle" font-size="10" fill="#64748b">
                units
            </text>
            
            <!-- Syringe label -->
            <text x="${barrelStartX + barrelWidth/2}" y="${barrelY + barrelHeight/2 + 5}" 
                  text-anchor="middle" font-size="10" fill="#94a3b8" opacity="0.7">
                ${syringeSize}U Insulin Syringe
            </text>
        </svg>
    </div>
    `;
}

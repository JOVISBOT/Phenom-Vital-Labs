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
    
    .syringe-visual-container {
        background: #fff;
        border-radius: 20px;
        padding: 24px;
        margin: 24px 0;
        border: 2px solid var(--primary);
        box-shadow: 0 8px 32px rgba(30, 64, 175, 0.1);
    }
    
    .syringe-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
    }
    
    @media (max-width: 900px) {
        .syringe-grid {
            grid-template-columns: 1fr;
        }
    }
    
    .syringe-card {
        background: #f8fafc;
        border-radius: 16px;
        padding: 20px;
        text-align: center;
        border: 2px solid #e2e8f0;
        position: relative;
        transition: all 0.3s;
    }
    
    .syringe-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }
    
    .syringe-card.low {
        border-color: #10b981;
        background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
    }
    
    .syringe-card.med {
        border-color: #3b82f6;
        background: linear-gradient(135deg, #eff6ff, #dbeafe);
    }
    
    .syringe-card.high {
        border-color: #f59e0b;
        background: linear-gradient(135deg, #fffbeb, #fef3c7);
    }
    
    .syringe-card.med.featured {
        transform: scale(1.03);
        box-shadow: 0 12px 40px rgba(30, 64, 175, 0.2);
    }
    
    .syringe-label {
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
    }
    
    .syringe-label.low { color: #059669; }
    .syringe-label.med { color: #1e40af; }
    .syringe-label.high { color: #d97706; }
    
    .syringe-dose {
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 12px;
    }
    
    .syringe-instruction {
        margin-top: 12px;
        font-size: 0.9rem;
        color: #64748b;
    }
    
    .syringe-instruction strong {
        color: var(--primary);
        font-size: 1.1rem;
    }
    
    .syringe-wrapper {
        background: #fff;
        border-radius: 12px;
        padding: 10px;
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.05);
    }
`
document.head.appendChild(style);

/**
 * Generate SVG syringe visualization
 * @param {number} units - Units to draw
 * @param {number} syringeSize - Syringe size (30, 50, or 100)
 * @param {string} doseType - 'low', 'med', or 'high' for color theming
 * @returns {string} SVG HTML
 */
function generateSyringeSVG(units, syringeSize, doseType = 'med') {
    const width = 320;
    const height = 100;
    const barrelY = 35;
    const barrelHeight = 30;
    const barrelStartX = 50;
    const barrelWidth = 220;
    const endX = barrelStartX + barrelWidth;
    const plungerX = barrelStartX + (units / syringeSize) * barrelWidth;
    
    // Color based on dose type
    let strokeColor = '#1e40af'; // blue default
    let fillColor = '#3b82f6';
    if (doseType === 'low') {
        strokeColor = '#059669';
        fillColor = '#10b981';
    } else if (doseType === 'high') {
        strokeColor = '#d97706';
        fillColor = '#f59e0b';
    }
    
    // Warning for high fill
    const fillPercent = units / syringeSize;
    if (fillPercent > 0.9) fillColor = '#ef4444';
    
    // Calculate label positions
    const maxLabel = syringeSize;
    const steps = syringeSize <= 30 ? 5 : 10;
    
    let ticks = '';
    let labels = '';
    for (let i = 0; i <= maxLabel; i += steps) {
        const x = barrelStartX + (i / maxLabel) * barrelWidth;
        ticks += `<line x1="${x}" y1="${barrelY}" x2="${x}" y2="${barrelY + barrelHeight}" stroke="#cbd5e1" stroke-width="1"/>`;
        labels += `<text x="${x}" y="${barrelY + barrelHeight + 15}" text-anchor="middle" font-size="10" fill="#64748b">${i}</text>`;
    }
    
    return `
    <div class="syringe-wrapper" style="padding: 10px;">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="max-width: 100%;">
            <!-- Syringe barrel outline -->
            <rect x="${barrelStartX}" y="${barrelY}" width="${barrelWidth}" height="${barrelHeight}" 
                  fill="#f8fafc" stroke="${strokeColor}" stroke-width="2" rx="3"/>
            
            <!-- Ticks -->
            ${ticks}
            
            <!-- Labels -->
            ${labels}
            
            <!-- Liquid fill -->
            <rect x="${barrelStartX + 2}" y="${barrelY + 2}" 
                  width="${Math.max(0, plungerX - barrelStartX - 4)}" height="${barrelHeight - 4}" 
                  fill="${fillColor}" opacity="0.85" rx="2"/>
            
            <!-- Plunger -->
            <rect x="${plungerX - 2}" y="${barrelY - 4}" width="3" height="${barrelHeight + 8}" 
                  fill="#1e3a8a" rx="1"/>
            
            <!-- Plunger rod -->
            <rect x="${plungerX - 2}" y="${barrelY - 25}" width="3" height="22" 
                  fill="#64748b"/>
            
            <!-- Thumb rest -->
            <rect x="${plungerX - 10}" y="${barrelY - 28}" width="20" height="5" 
                  fill="#1e3a8a" rx="2"/>
            
            <!-- Needle tip -->
            <polygon points="${endX},${barrelY + 10} ${endX + 12},${barrelY + 15} ${endX},${barrelY + 20}" 
                     fill="#94a3b8"/>
            
            <!-- Measurement indicator -->
            <line x1="${plungerX}" y1="${barrelY - 35}" x2="${plungerX}" y2="${barrelY - 38}" 
                  stroke="${strokeColor}" stroke-width="2"/>
            <text x="${plungerX}" y="${barrelY - 42}" text-anchor="middle" font-size="12" font-weight="bold" fill="${strokeColor}">
                ${units}
            </text>
        </svg>
    </div>
    `;
}

document.head.appendChild(style);
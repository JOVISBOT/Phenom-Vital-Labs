/**
 * PDF Generator Module - Executive Report Style
 * Creates professional executive summary protocol reports
 * 
 * @module pdfGenerator
 */

/**
 * Generate executive-style protocol PDF
 * @param {Object} peptide
 * @param {Object} results
 * @param {Object} inputs
 * @param {boolean} previewMode - If true, opens in new tab instead of downloading
 */
export function generatePDF(peptide, results, inputs, previewMode = false) {
    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF library not loaded');
        alert('PDF generation failed: library not loaded');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Check dosing type
    const isFixed = peptide.fixed === true;
    const unit = isFixed ? 'mg' : 'mcg';
    
    // Colors - Professional blue theme
    const primaryBlue = [30, 64, 175];
    const darkBlue = [30, 58, 138];
    const lightBlue = [219, 234, 254];
    const bgBlue = [239, 246, 255];
    const cream = [254, 252, 243];
    const gray = [107, 114, 128];
    const darkGray = [55, 65, 81];
    const successGreen = [16, 185, 129];
    const warningOrange = [245, 158, 11];
    
    // Page dimensions
    const pageWidth = 210;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    let y = 10;
    
    // ========== HEADER SECTION ==========
    // Dark blue header bar
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Logo area
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('PHENOM VITAL LABS', margin, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Premium Peptide Protocol | Research Compounds', margin, 35);
    
    // Date badge on right
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth - margin - 50, 12, 50, 22, 3, 3, 'F');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('GENERATED', pageWidth - margin - 25, 20, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(date, pageWidth - margin - 25, 30, { align: 'center' });
    
    // ========== TITLE SECTION ==========
    y = 50;
    doc.setFillColor(bgBlue[0], bgBlue[1], bgBlue[2]);
    doc.roundedRect(margin, y, contentWidth, 30, 4, 4, 'F');
    
    doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PEPTIDE PROTOCOL', margin + 5, y + 12);
    
    doc.setFontSize(12);
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text(peptide.name.toUpperCase(), margin + 5, y + 23);
    
    // Category badge
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.roundedRect(pageWidth - margin - 70, y + 5, 65, 20, 3, 3, 'F');
    doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(peptide.category.toUpperCase(), pageWidth - margin - 37, y + 17, { align: 'center' });
    
    // ========== PATIENT OVERVIEW BOX ==========
    y = 85;
    doc.setFillColor(cream[0], cream[1], cream[2]);
    doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 35, 3, 3, 'FD');
    
    // Section title
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT INFORMATION', margin + 5, y + 6);
    
    // Patient details grid
    y += 12;
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const col1 = margin + 5;
    const col2 = margin + 70;
    const col3 = margin + 130;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Weight:', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(inputs.weight + ' lbs', col1 + 25, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Age:', col2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(inputs.age + ' years', col2 + 20, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Vial Size:', col3, y);
    doc.setFont('helvetica', 'normal');
    doc.text(inputs.vialSize + 'mg', col3 + 28, y);
    
    // ========== DOSING PROTOCOL SECTION ==========
    y = 125;
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DOSING PROTOCOL', margin + 5, y + 7);
    
    // Three column layout for doses
    y += 15;
    const colW = contentWidth / 3;
    
    ['CONSERVATIVE', 'STANDARD (RECOMMENDED)', 'ADVANCED'].forEach((label, i) => {
        const x = margin + (i * colW);
        const isRec = i === 1;
        
        // Card
        if (isRec) {
            doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
            doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
            doc.setLineWidth(1);
        } else {
            doc.setFillColor(250, 250, 250);
            doc.setDrawColor(gray[0], gray[1], gray[2]);
            doc.setLineWidth(0.3);
        }
        doc.roundedRect(x + 2, y, colW - 4, 55, 3, 3, 'FD');
        
        // Label
        doc.setTextColor(isRec ? primaryBlue[0] : gray[0], gray[1], gray[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(label, x + colW/2, y + 8, { align: 'center' });
        
        // Dose values
        const dose = i === 0 ? results.doses.low : i === 1 ? results.doses.med : results.doses.high;
        const units = i === 0 ? results.syringeUnits.low : i === 1 ? results.syringeUnits.med : results.syringeUnits.high;
        
        // Primary dose
        doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
        doc.setFontSize(isRec ? 16 : 14);
        doc.setFont('helvetica', 'bold');
        
        if (isFixed) {
            // Show mg primary
            const mgValue = dose.toFixed(2).replace(/\.?0+$/, '');
            doc.text(mgValue + ' mg', x + colW/2, y + 22, { align: 'center' });
            
            // Secondary mcg
            doc.setFontSize(8);
            doc.setTextColor(gray[0], gray[1], gray[2]);
            const mcgValue = (dose * 1000).toFixed(0);
            doc.text('(' + mcgValue + ' mcg)', x + colW/2, y + 30, { align: 'center' });
        } else {
            doc.text(dose.toLocaleString() + ' mcg', x + colW/2, y + 25, { align: 'center' });
        }
        
        // Syringe units
        doc.setFillColor(bgBlue[0], bgBlue[1], bgBlue[2]);
        doc.roundedRect(x + 10, y + 35, colW - 24, 15, 2, 2, 'F');
        doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Draw ' + units + ' units', x + colW/2, y + 45, { align: 'center' });
    });
    
    // ========== PROJECT DETAILS TABLE ==========
    y += 65;
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PROTOCOL SPECIFICATIONS', margin + 5, y + 7);
    
    y += 12;
    
    // Table rows
    const rowH = 12;
    const specs = [
        ['Half-Life', peptide.halfLife || 'N/A', 'Frequency', peptide.freq || 'N/A'],
        ['Cycle Duration', peptide.wks + ' weeks', 'Injections/Week', peptide.f.toString()],
        ['Timing', getTimingNote(peptide), 'Category', peptide.category]
    ];
    
    specs.forEach((row, i) => {
        // Alternate row colors
        if (i % 2 === 0) {
            doc.setFillColor(250, 250, 250);
        } else {
            doc.setFillColor(255, 255, 255);
        }
        doc.rect(margin, y + (i * rowH), contentWidth, rowH, 'F');
        
        // Labels and values
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(row[0] + ':', margin + 5, y + 8 + (i * rowH));
        
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(row[1], margin + 50, y + 8 + (i * rowH));
        
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(row[2] + ':', margin + 105, y + 8 + (i * rowH));
        
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(row[3], margin + 145, y + 8 + (i * rowH));
    });
    
    // ========== TIMELINE VISUAL ==========
    y += 45;
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CYCLE TIMELINE', margin + 5, y + 7);
    
    y += 18;
    
    // Timeline bar
    const weeks = peptide.wks;
    const barW = contentWidth - 20;
    const weekW = barW / weeks;
    
    // Background bar
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(margin + 10, y, barW, 15, 3, 3, 'F');
    
    // Active weeks (colored)
    doc.setFillColor(successGreen[0], successGreen[1], successGreen[2]);
    doc.roundedRect(margin + 10, y, barW, 15, 3, 3, 'F');
    
    // Week markers
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(6);
    for (let i = 0; i <= weeks; i += Math.ceil(weeks / 6)) {
        const x = margin + 10 + (i * weekW);
        doc.line(x, y - 2, x, y + 17);
        doc.text('W' + i, x, y + 22, { align: 'center' });
    }
    
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(weeks + '-WEEK CYCLE', margin + 10 + barW/2, y + 8, { align: 'center' });
    
    // ========== KEY METRICS ==========
    y += 35;
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('KEY METRICS', margin + 5, y + 7);
    
    y += 15;
    
    // Metrics boxes
    const metrics = [
        ['Total Injections', (peptide.f * peptide.wks).toString()],
        ['Vials Needed', results.vialsNeeded.toString()],
        ['Days on Cycle', (peptide.wks * 7).toString() + ' days'],
        ['Protocol Type', isFixed ? 'Fixed Dose' : 'Weight-Based']
    ];
    
    const metricW = contentWidth / 4;
    metrics.forEach((m, i) => {
        const x = margin + (i * metricW) + 2;
        
        // Box
        doc.setFillColor(bgBlue[0], bgBlue[1], bgBlue[2]);
        doc.roundedRect(x, y, metricW - 4, 25, 2, 2, 'F');
        
        // Label
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(m[0].toUpperCase(), x + (metricW - 4)/2, y + 8, { align: 'center' });
        
        // Value
        doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(m[1], x + (metricW - 4)/2, y + 20, { align: 'center' });
    });
    
    // ========== SAFETY SECTION ==========
    y += 35;
    doc.setFillColor(warningOrange[0], warningOrange[1], warningOrange[2]);
    doc.setDrawColor(warningOrange[0], warningOrange[1], warningOrange[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 40, 3, 3, 'FD');
    
    // Header
    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 2, y + 2, contentWidth - 4, 8, 'F');
    doc.setTextColor(warningOrange[0], warningOrange[1], warningOrange[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SAFETY & WARNINGS', margin + 8, y + 8);
    
    // Content
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    
    const warnings = [
        '• Consult healthcare provider before starting any peptide protocol',
        '• Start with Conservative dose if new to peptides',
        '• Store reconstituted peptides refrigerated (2-8°C)',
        '• Use sterile technique for all injections',
        '• This calculator is for research purposes only - not medical advice'
    ];
    
    warnings.forEach((w, i) => {
        doc.text(w, margin + 5, y + 18 + (i * 5));
    });
    
    // ========== FOOTER ==========
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(0, 285, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by Phenom Vital Labs Peptide Calculator | For research purposes only | Not medical advice', pageWidth/2, 292, { align: 'center' });
    
    // Output
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    if (previewMode) {
        window.open(pdfUrl, '_blank');
    } else {
        doc.save(`${peptide.name.replace(/\s+/g, '_')}_Protocol.pdf`);
    }
}

// Helper function for timing notes
function getTimingNote(peptide) {
    const name = peptide.name.toLowerCase();
    const cat = peptide.category.toLowerCase();
    
    if (name.includes('gh') || name.includes('cjc') || name.includes('ipa') || cat.includes('gh')) {
        return 'Evening (before bed)';
    }
    if (name.includes('metabolic') || name.includes('tirze') || name.includes('sema') || cat.includes('metabolic')) {
        return 'Morning (before breakfast)';
    }
    if (name.includes('heal') || name.includes('bpc') || name.includes('tb')) {
        return 'Post-workout or PM';
    }
    return 'As directed';
}

export default { generatePDF };

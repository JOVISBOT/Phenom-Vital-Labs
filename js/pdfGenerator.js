/**
 * PDF Generator Module - Executive Report Style v2
 * Professional medical/executive summary format
 * 
 * @module pdfGenerator
 */

/**
 * Generate executive protocol PDF - Clean medical report style
 * @param {Object} peptide
 * @param {Object} results
 * @param {Object} inputs
 * @param {boolean} previewMode
 */
export function generatePDF(peptide, results, inputs, previewMode = false) {
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF library not loaded');
        alert('PDF generation failed: library not loaded');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const isFixed = peptide.fixed === true;
    const unit = isFixed ? 'mg' : 'mcg';
    
    // Professional color palette
    const navy = [23, 37, 84];
    const blue = [37, 99, 235];
    const lightBlue = [219, 234, 254];
    const bgGray = [248, 250, 252];
    const textGray = [71, 85, 105];
    const mutedGray = [148, 163, 184];
    const green = [22, 163, 74];
    const amber = [245, 158, 11];
    const red = [220, 38, 38];
    
    const pageW = 210;
    const margin = 15;
    const contentW = pageW - (margin * 2);
    
    let y = 10;
    
    // ========== HEADER ==========
    // Navy header bar
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 0, pageW, 40, 'F');
    
    // Logo
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PHENOM VITAL LABS', margin, 22);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Peptide Protocol Report', margin, 32);
    
    // Date badge
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageW - margin - 55, 10, 55, 20, 3, 3, 'F');
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORT DATE', pageW - margin - 27, 17, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(date, pageW - margin - 27, 26, { align: 'center' });
    
    // ========== EXECUTIVE SUMMARY BOX ==========
    y = 48;
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.setDrawColor(blue[0], blue[1], blue[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentW, 38, 4, 4, 'FD');
    
    // Summary header
    doc.setFillColor(blue[0], blue[1], blue[2]);
    doc.roundedRect(margin + 2, y + 2, contentW - 4, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE SUMMARY', margin + 6, y + 9);
    
    // Summary content
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(peptide.name.toUpperCase(), margin + 5, y + 22);
    
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const recDose = isFixed ? 
        `${results.doses.med} mg (${(results.doses.med * 1000).toFixed(0)} mcg)` : 
        `${results.doses.med.toLocaleString()} mcg`;
    doc.text(`Recommended: ${recDose} | ${results.syringeUnits.med} units | ${peptide.freq}`, margin + 5, y + 30);
    
    // ========== PATIENT INFO ==========
    y = 92;
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT INFORMATION', margin, y);
    
    // Info grid
    y += 8;
    const infoItems = [
        ['Weight', inputs.weight + ' lbs'],
        ['Age', inputs.age + ' years'],
        ['Vial Size', inputs.vialSize + 'mg'],
        ['Syringe', inputs.syringe + 'U']
    ];
    
    const colWidth = contentW / 4;
    infoItems.forEach((item, i) => {
        const x = margin + (i * colWidth);
        
        // Box
        doc.setFillColor(bgGray[0], bgGray[1], bgGray[2]);
        doc.roundedRect(x, y, colWidth - 5, 22, 3, 3, 'F');
        
        // Label
        doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(item[0].toUpperCase(), x + 5, y + 8);
        
        // Value
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(item[1], x + 5, y + 18);
    });
    
    // ========== DOSING PROTOCOL ==========
    y = 130;
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DOSING PROTOCOL', margin, y);
    
    y += 10;
    const doseColW = contentW / 3;
    const doses = [
        { label: 'CONSERVATIVE', val: results.doses.low, units: results.syringeUnits.low, color: green, rec: false },
        { label: 'STANDARD', val: results.doses.med, units: results.syringeUnits.med, color: blue, rec: true },
        { label: 'ADVANCED', val: results.doses.high, units: results.syringeUnits.high, color: amber, rec: false }
    ];
    
    doses.forEach((d, i) => {
        const x = margin + (i * doseColW);
        
        // Card background - clean like UI
        if (d.rec) {
            // Featured card - light blue background
            doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
            doc.setDrawColor(blue[0], blue[1], blue[2]);
            doc.setLineWidth(1.5);
        } else {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.5);
        }
        doc.roundedRect(x + 2, y, doseColW - 4, 55, 6, 6, 'FD');
        
        // Color strip at top
        doc.setFillColor(d.color[0], d.color[1], d.color[2]);
        doc.rect(x + 2, y, doseColW - 4, 5, 'F');
        
        // Label
        doc.setTextColor(d.rec ? blue[0] : textGray[0], d.rec ? blue[1] : textGray[1], d.rec ? blue[2] : textGray[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(d.label, x + doseColW/2, y + 12, { align: 'center' });
        
        // RECOMMENDED pill badge (cleaner)
        if (d.rec) {
            const badgeW = 38;
            const badgeH = 6;
            const badgeX = x + (doseColW - badgeW) / 2;
            doc.setFillColor(blue[0], blue[1], blue[2]);
            doc.roundedRect(badgeX, y + 15, badgeW, badgeH, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(5);
            doc.setFont('helvetica', 'bold');
            doc.text('RECOMMENDED', x + doseColW/2, y + 19, { align: 'center' });
        }
        
        // Dose value - large
        const valY = d.rec ? y + 35 : y + 30;
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(d.rec ? 16 : 13);
        doc.setFont('helvetica', 'bold');
        
        if (isFixed) {
            doc.text(d.val.toFixed(2).replace(/\.?0+$/, '') + ' mg', x + doseColW/2, valY, { align: 'center' });
            doc.setFontSize(8);
            doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
            doc.text('(' + (d.val * 1000).toFixed(0) + ' mcg)', x + doseColW/2, valY + 7, { align: 'center' });
        } else {
            doc.text(d.val.toLocaleString() + ' mcg', x + doseColW/2, valY, { align: 'center' });
        }
        
        // Units box at bottom
        const boxY = y + 47;
        doc.setFillColor(bgGray[0], bgGray[1], bgGray[2]);
        doc.roundedRect(x + 10, boxY, doseColW - 24, 7, 3, 3, 'F');
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('Draw ' + d.units + ' units', x + doseColW/2, boxY + 5, { align: 'center' });
    });
    
    // ========== PROTOCOL DETAILS TABLE ==========
    y = 195;
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PROTOCOL DETAILS', margin, y);
    
    y += 8;
    
    // Table header
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(margin, y, contentW, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PARAMETER', margin + 5, y + 7);
    doc.text('VALUE', margin + 100, y + 7);
    doc.text('NOTES', margin + 150, y + 7);
    
    // Table rows
    const tableData = [
        ['Half-Life', peptide.halfLife || 'N/A', 'Time in body'],
        ['Frequency', peptide.freq || 'N/A', peptide.f + 'x per week'],
        ['Cycle Length', peptide.wks + ' weeks', peptide.wks * 7 + ' days total'],
        ['Vials Needed', results.vialsNeeded.toString(), 'For full cycle'],
        ['Total Injections', (peptide.f * peptide.wks).toString(), 'Over ' + peptide.wks + ' weeks'],
        ['Timing', getTimingNote(peptide), 'Optimal time of day'],
        ['Category', peptide.category, isFixed ? 'Fixed dose' : 'Weight-based']
    ];
    
    y += 10;
    tableData.forEach((row, i) => {
        // Alternating row colors
        if (i % 2 === 0) {
            doc.setFillColor(250, 250, 250);
        } else {
            doc.setFillColor(255, 255, 255);
        }
        doc.rect(margin, y + (i * 12), contentW, 12, 'F');
        
        // Border lines
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(margin, y + (i * 12) + 12, margin + contentW, y + (i * 12) + 12);
        
        // Data
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(row[0], margin + 5, y + 8 + (i * 12));
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.text(row[1], margin + 100, y + 8 + (i * 12));
        
        doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
        doc.text(row[2], margin + 150, y + 8 + (i * 12));
    });
    
    // ========== CYCLE TIMELINE ==========
    y += 100;
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CYCLE TIMELINE', margin, y);
    
    y += 10;
    
    // Timeline bar
    const weeks = peptide.wks;
    const barW = contentW - 20;
    
    // Background
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(margin + 10, y, barW, 18, 4, 4, 'F');
    
    // Progress (full cycle)
    doc.setFillColor(green[0], green[1], green[2]);
    doc.roundedRect(margin + 10, y, barW, 18, 4, 4, 'F');
    
    // Week markers
    const markerCount = Math.min(weeks, 8);
    for (let i = 0; i <= markerCount; i++) {
        const weekNum = Math.round((i / markerCount) * weeks);
        const x = margin + 10 + (i / markerCount) * barW;
        
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);
        doc.line(x, y + 2, x, y + 16);
        
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(6);
        doc.text('W' + weekNum, x, y + 24, { align: 'center' });
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(weeks + '-WEEK CYCLE', margin + 10 + barW/2, y + 12, { align: 'center' });
    
    // ========== IMPORTANT NOTES ==========
    y += 35;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(red[0], red[1], red[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentW, 35, 4, 4, 'FD');
    
    // Header
    doc.setFillColor(red[0], red[1], red[2]);
    doc.roundedRect(margin + 2, y + 2, contentW - 4, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('IMPORTANT NOTES', margin + 6, y + 8);
    
    // Content
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const notes = [
        '• Consult healthcare provider before starting any peptide protocol',
        '• Start with Conservative dose if new to peptides',
        '• Store reconstituted peptides refrigerated (2-8°C)',
        '• This calculator is for research purposes only - not medical advice'
    ];
    notes.forEach((note, i) => {
        doc.text(note, margin + 5, y + 17 + (i * 5));
    });
    
    // ========== FOOTER ==========
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 285, pageW, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by Phenom Vital Labs | For research purposes only', pageW/2, 290, { align: 'center' });
    doc.text('Page 1 of 1', pageW - margin - 5, 290, { align: 'right' });
    
    // Output
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    if (previewMode) {
        window.open(pdfUrl, '_blank');
    } else {
        doc.save(`${peptide.name.replace(/[^a-zA-Z0-9]/g, '_')}_Protocol.pdf`);
    }
}

// Helper for timing
function getTimingNote(peptide) {
    const name = peptide.name.toLowerCase();
    const cat = peptide.category.toLowerCase();
    
    if (name.includes('gh') || name.includes('cjc') || name.includes('ipa') || cat.includes('gh')) {
        return 'Evening (before bed)';
    }
    if (name.includes('metabolic') || name.includes('tirze') || name.includes('sema') || cat.includes('metabolic')) {
        return 'Morning (fasted)';
    }
    if (name.includes('heal') || name.includes('bpc') || name.includes('tb')) {
        return 'Post-workout';
    }
    return 'As directed';
}

export default { generatePDF };

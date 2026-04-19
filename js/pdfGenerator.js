/**
 * PDF Generator Module - Executive Report Style v3
 * Professional medical/executive summary format with perfect spacing
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
    const margin = 12;
    const contentW = pageW - (margin * 2);
    
    let y = 8;
    const lineH = 5;
    
    // ========== HEADER ==========
    // Navy header bar - compact
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 0, pageW, 30, 'F');
    
    // Logo
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PHENOM VITAL LABS', margin, 18);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Peptide Protocol Report', margin, 26);
    
    // Date badge - right side
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageW - margin - 45, 8, 45, 16, 2, 2, 'F');
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORT DATE', pageW - margin - 22, 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(date, pageW - margin - 22, 21, { align: 'center' });
    
    y = 36;
    
    // ========== PEPTIDE TITLE ==========
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(peptide.name.toUpperCase(), margin, y);
    
    doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(peptide.category, margin, y + lineH);
    
    y += 14;
    
    // ========== QUICK INFO BAR ==========
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.roundedRect(margin, y, contentW, 18, 3, 3, 'F');
    
    const recDose = isFixed ? 
        `${results.doses.med} mg (${(results.doses.med * 1000).toFixed(0)} mcg)` : 
        `${results.doses.med.toLocaleString()} mcg`;
    
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Recommended:', margin + 5, y + 6);
    doc.text(recDose, margin + 5, y + 13);
    
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('•', margin + 70, y + 10);
    doc.text(`${results.syringeUnits.med} units`, margin + 74, y + 10);
    doc.text('•', margin + 105, y + 10);
    doc.text(peptide.freq, margin + 109, y + 10);
    
    y += 24;
    
    // ========== PATIENT INFO ==========
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT INFO', margin, y);
    
    y += 6;
    
    const infoItems = [
        ['WEIGHT', inputs.weight + ' lbs'],
        ['AGE', inputs.age + ' years'],
        ['VIAL', inputs.vialSize + 'mg'],
        ['SYRINGE', inputs.syringe + 'U']
    ];
    
    const colWidth = contentW / 4;
    infoItems.forEach((item, i) => {
        const x = margin + (i * colWidth);
        
        doc.setFillColor(bgGray[0], bgGray[1], bgGray[2]);
        doc.roundedRect(x, y, colWidth - 4, 16, 2, 2, 'F');
        
        doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(item[0], x + 4, y + 5);
        
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(item[1], x + 4, y + 13);
    });
    
    y += 22;
    
    // ========== DOSING CARDS ==========
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DOSING OPTIONS', margin, y);
    
    y += 6;
    
    const doseColW = contentW / 3;
    const cardH = 42;
    const doses = [
        { label: 'CONSERVATIVE', val: results.doses.low, units: results.syringeUnits.low, color: green, rec: false },
        { label: 'STANDARD', val: results.doses.med, units: results.syringeUnits.med, color: blue, rec: true },
        { label: 'ADVANCED', val: results.doses.high, units: results.syringeUnits.high, color: amber, rec: false }
    ];
    
    doses.forEach((d, i) => {
        const x = margin + (i * doseColW);
        
        // Card
        if (d.rec) {
            doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
            doc.setDrawColor(blue[0], blue[1], blue[2]);
            doc.setLineWidth(1);
        } else {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.3);
        }
        doc.roundedRect(x + 1, y, doseColW - 3, cardH, 4, 4, 'FD');
        
        // Color strip
        doc.setFillColor(d.color[0], d.color[1], d.color[2]);
        doc.rect(x + 1, y, doseColW - 3, 4, 'F');
        
        // Label
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(d.label, x + doseColW/2 - 1, y + 9, { align: 'center' });
        
        // Recommended badge
        if (d.rec) {
            doc.setFillColor(blue[0], blue[1], blue[2]);
            doc.roundedRect(x + (doseColW - 34)/2, y + 11, 34, 5, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(5);
            doc.text('RECOMMENDED', x + doseColW/2 - 1, y + 15, { align: 'center' });
        }
        
        // Dose value
        const valY = d.rec ? y + 27 : y + 24;
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(d.rec ? 14 : 12);
        doc.setFont('helvetica', 'bold');
        
        if (isFixed) {
            doc.text(d.val.toFixed(2).replace(/\.?0+$/, '') + ' mg', x + doseColW/2 - 1, valY, { align: 'center' });
            doc.setFontSize(6);
            doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
            doc.text('(' + (d.val * 1000).toFixed(0) + ' mcg)', x + doseColW/2 - 1, valY + 5, { align: 'center' });
        } else {
            doc.text(d.val.toLocaleString() + ' mcg', x + doseColW/2 - 1, valY, { align: 'center' });
        }
        
        // Units
        doc.setFillColor(bgGray[0], bgGray[1], bgGray[2]);
        doc.roundedRect(x + 6, y + 34, doseColW - 15, 6, 2, 2, 'F');
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text('Draw ' + d.units + ' units', x + doseColW/2 - 1, y + 38, { align: 'center' });
    });
    
    y += cardH + 6;
    
    // ========== PROTOCOL DETAILS (Compact 2-column) ==========
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PROTOCOL DETAILS', margin, y);
    
    y += 5;
    
    const leftCol = [
        ['Half-Life:', peptide.halfLife || 'N/A'],
        ['Frequency:', peptide.freq],
        ['Cycle Length:', peptide.wks + ' weeks'],
        ['Vials Needed:', results.vialsNeeded.toString()]
    ];
    
    const rightCol = [
        ['Total Injections:', (peptide.f * peptide.wks).toString()],
        ['Timing:', getTimingNote(peptide)],
        ['Dose Type:', isFixed ? 'Fixed' : 'Weight-based'],
        ['Category:', peptide.category]
    ];
    
    const colW = contentW / 2;
    
    // Draw compact table
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(margin, y, contentW, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('PARAMETER', margin + 3, y + 4.5);
    doc.text('VALUE', margin + colW + 3, y + 4.5);
    
    y += 6;
    
    for (let i = 0; i < leftCol.length; i++) {
        if (i % 2 === 0) {
            doc.setFillColor(250, 250, 250);
        } else {
            doc.setFillColor(255, 255, 255);
        }
        doc.rect(margin, y + (i * 5), contentW, 5, 'F');
        
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(leftCol[i][0], margin + 3, y + 3.5 + (i * 5));
        
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(leftCol[i][1], margin + 35, y + 3.5 + (i * 5));
        
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(rightCol[i][0], margin + colW + 3, y + 3.5 + (i * 5));
        
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(rightCol[i][1], margin + colW + 35, y + 3.5 + (i * 5));
    }
    
    y += 28;
    
    // ========== TIMELINE (Compact) ==========
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(peptide.wks + '-WEEK CYCLE TIMELINE', margin, y);
    
    y += 5;
    
    const weeks = peptide.wks;
    const barW = contentW;
    
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(margin, y, barW, 10, 2, 2, 'F');
    
    doc.setFillColor(green[0], green[1], green[2]);
    doc.roundedRect(margin, y, barW, 10, 2, 2, 'F');
    
    // Week markers
    const markerCount = Math.min(weeks, 6);
    for (let i = 0; i <= markerCount; i++) {
        const weekNum = Math.round((i / markerCount) * weeks);
        const x = margin + (i / markerCount) * barW;
        
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.3);
        doc.line(x, y + 1, x, y + 9);
        
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(5);
        doc.text('W' + weekNum, x + 1, y + 14);
    }
    
    y += 18;
    
    // ========== NOTES ==========
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(red[0], red[1], red[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 16, 2, 2, 'FD');
    
    doc.setFillColor(red[0], red[1], red[2]);
    doc.roundedRect(margin + 1, y + 1, contentW - 2, 4, 1, 1, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('IMPORTANT', margin + 4, y + 4);
    
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('• Consult healthcare provider • Start with Conservative dose • Store refrigerated (2-8°C)', margin + 4, y + 10);
    doc.text('• This calculator is for research purposes only - not medical advice', margin + 4, y + 14);
    
    // ========== FOOTER ==========
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 287, pageW, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by Phenom Vital Labs | For research purposes only', pageW/2, 293, { align: 'center' });
    
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

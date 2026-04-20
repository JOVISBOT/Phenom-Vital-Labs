/**
 * PDF Generator Module - Clean Medical Report v7
 * Simple, compact, professional layout
 * 
 * @module pdfGenerator
 */

export function generatePDF(peptide, results, inputs, previewMode = false) {
    if (!peptide || !results || !inputs) {
        alert('PDF generation failed: Missing data');
        return;
    }
    
    if (typeof window.jspdf === 'undefined') {
        alert('PDF generation failed: library not loaded');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    
    const isFixed = peptide.fixed === true;
    
    // Colors
    const navy = [30, 41, 59];
    const blue = [59, 130, 246];
    const slate = [71, 85, 105];
    const gray = [148, 163, 184];
    const lightGray = [241, 245, 249];
    const green = [34, 197, 94];
    const amber = [245, 158, 11];
    const red = [239, 68, 68];
    const white = [255, 255, 255];
    
    const pageW = 210;
    const margin = 14;
    const contentW = pageW - (margin * 2);
    
    let y = 8;
    
    // ===== HEADER =====
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 0, pageW, 26, 'F');
    
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PHENOM VITAL LABS', margin, 18);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Peptide Protocol Report', margin, 24);
    
    // Date
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.setFillColor(white[0], white[1], white[2]);
    doc.roundedRect(pageW - margin - 40, 8, 40, 14, 2, 2, 'F');
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE', pageW - margin - 20, 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(date, pageW - margin - 20, 18, { align: 'center' });
    
    y = 32;
    
    // ===== PEPTIDE NAME =====
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text((peptide.name || 'Unknown').toUpperCase(), margin, y);
    
    // Category badge
    const cat = peptide.category || 'Unknown';
    const catW = doc.getTextWidth(cat.toUpperCase()) + 8;
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(pageW - margin - catW, y - 4, catW, 7, 2, 2, 'F');
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(cat.toUpperCase(), pageW - margin - catW/2, y, { align: 'center' });
    
    y += 10;
    
    // ===== SUMMARY BOX =====
    const recDose = isFixed 
        ? `${results.doses.med} mg (${(results.doses.med * 1000).toFixed(0)} mcg)`
        : `${(results.doses.med || 0).toLocaleString()} mcg`;
    
    doc.setFillColor(224, 242, 254);
    doc.setDrawColor(blue[0], blue[1], blue[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 20, 3, 3, 'FD');
    
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Recommended: ${recDose}  |  ${results.syringeUnits?.med || 'N/A'} units  |  ${peptide.freq || ''}`, margin + 5, y + 7);
    
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${inputs.weight || 'N/A'} lbs  •  ${inputs.age || 'N/A'} years  •  ${inputs.vialSize || 'N/A'}mg vial`, margin + 5, y + 15);
    
    y += 26;
    
    // ===== DOSING CARDS =====
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DOSING OPTIONS', margin, y);
    y += 6;
    
    const cardW = contentW / 3;
    const cardH = 44;
    
    const configs = [
        { label: 'Conservative', val: results.doses?.low || 0, units: results.syringeUnits?.low || 0, color: green, rec: false },
        { label: 'Standard', val: results.doses?.med || 0, units: results.syringeUnits?.med || 0, color: blue, rec: true },
        { label: 'Advanced', val: results.doses?.high || 0, units: results.syringeUnits?.high || 0, color: amber, rec: false }
    ];
    
    configs.forEach((c, i) => {
        const x = margin + (i * cardW) + 2;
        
        // Card
        if (c.rec) {
            doc.setFillColor(239, 246, 255);
            doc.setDrawColor(blue[0], blue[1], blue[2]);
        } else {
            doc.setFillColor(white[0], white[1], white[2]);
            doc.setDrawColor(220, 220, 220);
        }
        doc.roundedRect(x, y, cardW - 4, cardH, 3, 3, 'FD');
        
        // Top bar
        doc.setFillColor(c.color[0], c.color[1], c.color[2]);
        doc.roundedRect(x, y, cardW - 4, 4, 3, 3, 'F');
        doc.rect(x, y + 2, cardW - 4, 2, 'F');
        
        // Label
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(c.label.toUpperCase(), x + (cardW - 4)/2, y + 10, { align: 'center' });
        
        // Rec badge
        if (c.rec) {
            doc.setFillColor(blue[0], blue[1], blue[2]);
            doc.roundedRect(x + (cardW - 4)/2 - 18, y + 12, 36, 5, 2, 2, 'F');
            doc.setTextColor(white[0], white[1], white[2]);
            doc.setFontSize(5);
            doc.text('RECOMMENDED', x + (cardW - 4)/2, y + 15.5, { align: 'center' });
        }
        
        // Dose value
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(c.rec ? 12 : 11);
        doc.setFont('helvetica', 'bold');
        const val = Number(c.val) || 0;
        if (isFixed) {
            doc.text(val.toFixed(2).replace(/\.?0+$/, '') + ' mg', x + (cardW - 4)/2, y + 26, { align: 'center' });
            doc.setFontSize(5);
            doc.setTextColor(gray[0], gray[1], gray[2]);
            doc.text('(' + (val * 1000).toFixed(0) + ' mcg)', x + (cardW - 4)/2, y + 30, { align: 'center' });
        } else {
            doc.text(val.toLocaleString() + ' mcg', x + (cardW - 4)/2, y + 26, { align: 'center' });
        }
        
        // Units box
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.roundedRect(x + 6, y + 34, cardW - 16, 6, 2, 2, 'F');
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text('Draw ' + c.units + ' units', x + (cardW - 4)/2, y + 38, { align: 'center' });
    });
    
    y += cardH + 8;
    
    // ===== CALCULATION =====
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(margin, y, contentW, 22, 3, 3, 'F');
    
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('CALCULATION', margin + 5, y + 5);
    
    const doseMg = isFixed ? (results.doses?.med || 0) : (results.doses?.med || 0) / 1000;
    const vialSize = Number(inputs.vialSize) || 5;
    const conc = vialSize / 3;
    const ml = doseMg / conc;
    
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${vialSize}mg ÷ 3ml = ${conc.toFixed(2)}mg/ml  •  ${doseMg.toFixed(2)}mg ÷ ${conc.toFixed(2)}mg/ml = ${ml.toFixed(2)}ml  •  ${ml.toFixed(2)}ml × 50U = ${Math.round(ml * 50)} units`, margin + 5, y + 12);
    
    if (ml * 50 > 50) {
        doc.setTextColor(red[0], red[1], red[2]);
        doc.text(`⚠ Requires ${Math.ceil(ml * 50 / 50)} syringe draws`, margin + 5, y + 18);
    }
    
    y += 28;
    
    // ===== PROTOCOL DETAILS =====
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PROTOCOL DETAILS', margin, y);
    y += 6;
    
    const details = [
        ['Half-Life', peptide.halfLife || 'N/A', 'Frequency', peptide.freq || 'N/A'],
        ['Cycle Length', (peptide.wks || 0) + ' weeks', 'Total Injections', ((peptide.f || 1) * (peptide.wks || 0)).toString()],
        ['Vials Needed', (results.vialsNeeded || 0).toString(), 'Timing', getTiming(peptide)],
        ['Category', peptide.category || 'N/A', 'Type', isFixed ? 'Fixed dose' : 'Weight-based']
    ];
    
    const colW = contentW / 2;
    const rowH = 7;
    
    details.forEach((row, i) => {
        if (i % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(margin, y + (i * rowH), contentW, rowH, 'F');
        }
        
        // Left
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(row[0], margin + 3, y + 4 + (i * rowH));
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(row[1], margin + 28, y + 4 + (i * rowH));
        
        // Right
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(row[2], margin + colW + 3, y + 4 + (i * rowH));
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(row[3], margin + colW + 28, y + 4 + (i * rowH));
    });
    
    y += 32;
    
    // ===== TIMELINE =====
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text((peptide.wks || 0) + '-WEEK CYCLE', margin, y);
    y += 5;
    
    const barW = contentW;
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(margin, y, barW, 7, 2, 2, 'F');
    doc.setFillColor(green[0], green[1], green[2]);
    doc.roundedRect(margin, y, barW, 7, 2, 2, 'F');
    
    const weeks = peptide.wks || 0;
    const markers = Math.min(weeks, 6);
    for (let i = 0; i <= markers; i++) {
        const wk = Math.round((i / markers) * weeks);
        const x = margin + (i / markers) * barW;
        doc.setDrawColor(white[0], white[1], white[2]);
        doc.setLineWidth(0.3);
        doc.line(x, y + 1, x, y + 6);
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(5);
        doc.text('W' + wk, x + 1, y + 10);
    }
    
    y += 16;
    
    // ===== NOTES =====
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(red[0], red[1], red[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 12, 2, 2, 'FD');
    
    doc.setFillColor(red[0], red[1], red[2]);
    doc.roundedRect(margin + 1, y + 1, contentW - 2, 4, 1, 1, 'F');
    
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'bold');
    doc.text('IMPORTANT', margin + 4, y + 4);
    
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text('Consult healthcare provider • Start with Conservative dose • Store refrigerated (2-8°C)', margin + 4, y + 9);
    
    // ===== FOOTER =====
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 285, pageW, 10, 'F');
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by Phenom Vital Labs | For research purposes only', pageW/2, 290, { align: 'center' });
    
    // Output
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    if (previewMode) {
        window.open(pdfUrl, '_blank');
    } else {
        doc.save(`${(peptide.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_')}_Protocol.pdf`);
    }
}

function getTiming(peptide) {
    const name = (peptide.name || '').toLowerCase();
    const cat = (peptide.category || '').toLowerCase();
    
    if (name.includes('gh') || name.includes('cjc') || cat.includes('gh')) return 'Evening';
    if (name.includes('metabolic') || name.includes('tirze') || name.includes('sema')) return 'Morning';
    if (name.includes('heal') || name.includes('bpc') || name.includes('tb')) return 'Post-workout';
    return 'As directed';
}

export default { generatePDF };

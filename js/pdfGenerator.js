/**
 * PDF Generator Module - Professional Medical Report v3
 * Clean, modern, perfectly spaced
 * 
 * @module pdfGenerator
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
    
    // Color palette
    const navy = [15, 23, 42];
    const blue = [37, 99, 235];
    const lightBlue = [239, 246, 255];
    const gray = [107, 114, 128];
    const lightGray = [243, 244, 246];
    const green = [22, 163, 74];
    const amber = [245, 158, 11];
    const red = [239, 68, 68];
    const white = [255, 255, 255];
    
    const pageW = 210;
    const margin = 14;
    const contentW = pageW - (margin * 2);
    
    let y = 8;
    const lh = 4.5;
    
    // ===== HEADER =====
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 0, pageW, 28, 'F');
    
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PHENOM VITAL LABS', margin, 18);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Peptide Protocol Report', margin, 24);
    
    // Date badge
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.setFillColor(white[0], white[1], white[2]);
    doc.roundedRect(pageW - margin - 42, 8, 42, 14, 2, 2, 'F');
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORT DATE', pageW - margin - 21, 13, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(date, pageW - margin - 21, 19, { align: 'center' });
    
    y = 34;
    
    // ===== PEPTIDE HEADER =====
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(peptide.name.toUpperCase(), margin, y);
    
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(peptide.category, margin, y + lh + 1);
    
    y += 14;
    
    // ===== QUICK INFO BOX =====
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.setDrawColor(blue[0], blue[1], blue[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 16, 2, 2, 'FD');
    
    const recDose = isFixed ? 
        `${results.doses.med} mg (${(results.doses.med * 1000).toFixed(0)} mcg)` : 
        `${results.doses.med.toLocaleString()} mcg`;
    
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Recommended: ${recDose}  •  ${results.syringeUnits.med} units  •  ${peptide.freq}`, margin + 4, y + 6);
    
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${inputs.weight} lbs  •  ${inputs.age} years  •  ${inputs.vialSize}mg vial  •  ${inputs.syringe}U syringe`, margin + 4, y + 12);
    
    y += 22;
    
    // ===== DOSING CARDS =====
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DOSING OPTIONS', margin, y);
    
    y += 5;
    
    const cardW = contentW / 3;
    const cardH = 40;
    const doses = [
        { label: 'CONSERVATIVE', val: results.doses.low, units: results.syringeUnits.low, color: green },
        { label: 'STANDARD', val: results.doses.med, units: results.syringeUnits.med, color: blue, rec: true },
        { label: 'ADVANCED', val: results.doses.high, units: results.syringeUnits.high, color: amber }
    ];
    
    doses.forEach((d, i) => {
        const x = margin + (i * cardW);
        
        // Card bg
        if (d.rec) {
            doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
            doc.setDrawColor(blue[0], blue[1], blue[2]);
        } else {
            doc.setFillColor(white[0], white[1], white[2]);
            doc.setDrawColor(220, 220, 220);
        }
        doc.roundedRect(x + 1, y, cardW - 3, cardH, 3, 3, 'FD');
        
        // Color strip
        doc.setFillColor(d.color[0], d.color[1], d.color[2]);
        doc.rect(x + 1, y, cardW - 3, 3, 'F');
        
        // Label
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(d.label, x + cardW/2 - 1, y + 8, { align: 'center' });
        
        // Rec badge
        if (d.rec) {
            doc.setFillColor(blue[0], blue[1], blue[2]);
            doc.roundedRect(x + (cardW - 32)/2, y + 10, 32, 5, 2, 2, 'F');
            doc.setTextColor(white[0], white[1], white[2]);
            doc.setFontSize(5);
            doc.text('RECOMMENDED', x + cardW/2 - 1, y + 14, { align: 'center' });
        }
        
        // Dose value
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(d.rec ? 13 : 11);
        doc.setFont('helvetica', 'bold');
        
        if (isFixed) {
            doc.text(d.val.toFixed(2).replace(/\.?0+$/, '') + ' mg', x + cardW/2 - 1, y + 25, { align: 'center' });
            doc.setFontSize(6);
            doc.setTextColor(gray[0], gray[1], gray[2]);
            doc.text('(' + (d.val * 1000).toFixed(0) + ' mcg)', x + cardW/2 - 1, y + 30, { align: 'center' });
        } else {
            doc.text(d.val.toLocaleString() + ' mcg', x + cardW/2 - 1, y + 25, { align: 'center' });
        }
        
        // Units box
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.roundedRect(x + 5, y + 32, cardW - 13, 6, 2, 2, 'F');
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(`Draw ${d.units} units`, x + cardW/2 - 1, y + 36, { align: 'center' });
    });
    
    y += cardH + 6;
    
    // ===== CALCULATION BREAKDOWN =====
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(margin, y, contentW, 18, 2, 2, 'F');
    
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('CALCULATION', margin + 4, y + 5);
    
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    const doseMg = isFixed ? results.doses.med : results.doses.med / 1000;
    const conc = inputs.vialSize / 3;
    doc.text(`${inputs.vialSize}mg ÷ 3ml = ${conc.toFixed(2)}mg/ml  •  ${doseMg.toFixed(2)}mg ÷ ${conc.toFixed(2)}mg/ml = ${(doseMg/conc).toFixed(2)}ml  •  ${(doseMg/conc).toFixed(2)}ml × 50U = ${results.syringeUnits.med} units`, margin + 4, y + 11);
    
    const draws = Math.ceil(results.syringeUnits.med / 50);
    if (draws > 1) {
        doc.setTextColor(red[0], red[1], red[2]);
        doc.text(`⚠️ Requires ${draws} syringe draws`, margin + 4, y + 16);
    }
    
    y += 22;
    
    // ===== PROTOCOL DETAILS (2-COLUMN) =====
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PROTOCOL DETAILS', margin, y);
    
    y += 5;
    
    const details = [
        ['Half-Life', peptide.halfLife || 'N/A', 'Frequency', peptide.freq],
        ['Cycle Length', peptide.wks + ' weeks', 'Total Injections', (peptide.f * peptide.wks).toString()],
        ['Vials Needed', results.vialsNeeded.toString(), 'Timing', getTimingNote(peptide)],
        ['Category', peptide.category, 'Type', isFixed ? 'Fixed dose' : 'Weight-based']
    ];
    
    const col1W = contentW * 0.5;
    
    details.forEach((row, i) => {
        if (i % 2 === 0) {
            doc.setFillColor(250, 250, 250);
        } else {
            doc.setFillColor(white[0], white[1], white[2]);
        }
        doc.rect(margin, y + (i * 5), contentW, 5, 'F');
        
        // Left pair
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(row[0], margin + 3, y + 3.5 + (i * 5));
        
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(row[1], margin + 30, y + 3.5 + (i * 5));
        
        // Right pair
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(row[2], margin + col1W + 3, y + 3.5 + (i * 5));
        
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(row[3], margin + col1W + 30, y + 3.5 + (i * 5));
    });
    
    y += 24;
    
    // ===== TIMELINE BAR =====
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${peptide.wks}-WEEK CYCLE`, margin, y);
    
    y += 5;
    
    const barW = contentW;
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(margin, y, barW, 8, 2, 2, 'F');
    doc.setFillColor(green[0], green[1], green[2]);
    doc.roundedRect(margin, y, barW, 8, 2, 2, 'F');
    
    const weeks = peptide.wks;
    const markers = Math.min(weeks, 6);
    for (let i = 0; i <= markers; i++) {
        const wk = Math.round((i / markers) * weeks);
        const x = margin + (i / markers) * barW;
        doc.setDrawColor(white[0], white[1], white[2]);
        doc.setLineWidth(0.3);
        doc.line(x, y + 1, x, y + 7);
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(5);
        doc.text('W' + wk, x + 1, y + 12);
    }
    
    y += 18;
    
    // ===== NOTES =====
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(red[0], red[1], red[2]);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');
    
    doc.setFillColor(red[0], red[1], red[2]);
    doc.roundedRect(margin + 1, y + 1, contentW - 2, 4, 1, 1, 'F');
    
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('IMPORTANT', margin + 4, y + 4);
    
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('• Consult healthcare provider  • Start with Conservative dose  • Store refrigerated (2-8°C)', margin + 4, y + 9);
    doc.text('• This calculator is for research purposes only - not medical advice', margin + 4, y + 12);
    
    // ===== FOOTER =====
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 287, pageW, 10, 'F');
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by Phenom Vital Labs | Page 1 of 1', pageW/2, 293, { align: 'center' });
    
    // Output
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    if (previewMode) {
        window.open(pdfUrl, '_blank');
    } else {
        doc.save(`${peptide.name.replace(/[^a-zA-Z0-9]/g, '_')}_Protocol.pdf`);
    }
}

function getTimingNote(peptide) {
    const name = peptide.name.toLowerCase();
    const cat = peptide.category.toLowerCase();
    
    if (name.includes('gh') || name.includes('cjc') || name.includes('ipa') || cat.includes('gh')) {
        return 'Evening';
    }
    if (name.includes('metabolic') || name.includes('tirze') || name.includes('sema') || cat.includes('metabolic')) {
        return 'Morning';
    }
    if (name.includes('heal') || name.includes('bpc') || name.includes('tb')) {
        return 'Post-workout';
    }
    return 'As directed';
}

export default { generatePDF };

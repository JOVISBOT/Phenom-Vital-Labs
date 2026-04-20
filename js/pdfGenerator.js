/**
 * PDF Generator - Simple & Detailed One Page
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
    const blue = [37, 99, 235];
    const slate = [71, 85, 105];
    const gray = [148, 163, 184];
    const lightGray = [241, 245, 249];
    const green = [22, 163, 74];
    const amber = [217, 119, 6];
    const red = [220, 38, 38];
    const white = [255, 255, 255];
    
    const pageW = 210;
    const margin = 12;
    const contentW = pageW - (margin * 2);
    
    let y = 6;
    
    // ===== HEADER =====
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 0, pageW, 22, 'F');
    
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PHENOM VITAL LABS', margin, 14);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Peptide Protocol Report', margin, 19);
    
    // Date
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.setFillColor(white[0], white[1], white[2]);
    doc.roundedRect(pageW - margin - 32, 6, 32, 10, 2, 2, 'F');
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(7);
    doc.text(date, pageW - margin - 16, 12, { align: 'center' });
    
    y = 28;
    
    // ===== PEPTIDE NAME & CATEGORY =====
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text((peptide.name || 'Unknown').toUpperCase(), margin, y);
    
    const cat = peptide.category || 'Unknown';
    const catW = doc.getTextWidth(cat.toUpperCase()) + 6;
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(pageW - margin - catW, y - 4, catW, 6, 1, 1, 'F');
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'bold');
    doc.text(cat.toUpperCase(), pageW - margin - catW/2, y, { align: 'center' });
    
    y += 8;
    
    // ===== DOSING OPTIONS (3 Columns) =====
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DOSING OPTIONS', margin, y);
    y += 5;
    
    const cardW = contentW / 3;
    
    const configs = [
        { label: 'Conservative', val: results.doses?.low || 0, units: results.syringeUnits?.low || 0, color: green },
        { label: 'Standard', val: results.doses?.med || 0, units: results.syringeUnits?.med || 0, color: blue, rec: true },
        { label: 'Advanced', val: results.doses?.high || 0, units: results.syringeUnits?.high || 0, color: amber }
    ];
    
    configs.forEach((c, i) => {
        const x = margin + (i * cardW) + 1;
        const isRec = c.rec;
        
        // Card background
        if (isRec) {
            doc.setFillColor(224, 242, 254);
            doc.setDrawColor(blue[0], blue[1], blue[2]);
        } else {
            doc.setFillColor(white[0], white[1], white[2]);
            doc.setDrawColor(200, 200, 200);
        }
        doc.roundedRect(x, y, cardW - 2, 28, 2, 2, 'FD');
        
        // Color bar
        doc.setFillColor(c.color[0], c.color[1], c.color[2]);
        doc.roundedRect(x, y, cardW - 2, 3, 2, 2, 'F');
        doc.rect(x, y + 2, cardW - 2, 1, 'F');
        
        // Label
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.text(c.label.toUpperCase(), x + (cardW - 2)/2, y + 7, { align: 'center' });
        
        // Rec badge
        if (isRec) {
            doc.setFillColor(blue[0], blue[1], blue[2]);
            doc.roundedRect(x + (cardW - 2)/2 - 14, y + 9, 28, 4, 1, 1, 'F');
            doc.setTextColor(white[0], white[1], white[2]);
            doc.setFontSize(4);
            doc.text('RECOMMENDED', x + (cardW - 2)/2, y + 11.5, { align: 'center' });
        }
        
        // Dose
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(isRec ? 10 : 9);
        doc.setFont('helvetica', 'bold');
        const val = Number(c.val) || 0;
        if (isFixed) {
            doc.text(val + ' mg', x + (cardW - 2)/2, y + 18, { align: 'center' });
        } else {
            doc.text(val.toLocaleString() + ' mcg', x + (cardW - 2)/2, y + 18, { align: 'center' });
        }
        
        // Units
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.roundedRect(x + 4, y + 21, cardW - 10, 5, 1, 1, 'F');
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text(c.units + ' units', x + (cardW - 2)/2, y + 24.5, { align: 'center' });
    });
    
    y += 32;
    
    // ===== TWO COLUMN LAYOUT =====
    const leftW = contentW * 0.55;
    const rightW = contentW * 0.42;
    const leftX = margin;
    const rightX = margin + leftW + 4;
    const startY = y;
    
    // LEFT COLUMN
    
    // Protocol Details
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PROTOCOL DETAILS', leftX, y);
    y += 5;
    
    const details = [
        ['Half-Life', peptide.halfLife || 'N/A'],
        ['Frequency', peptide.freq || 'N/A'],
        ['Cycle', (peptide.wks || 0) + ' weeks'],
        ['Vials Needed', (results.vialsNeeded || 0).toString()],
        ['Timing', getTiming(peptide)]
    ];
    
    details.forEach((d, i) => {
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(d[0], leftX, y + (i * 6));
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(': ' + d[1], leftX + 22, y + (i * 6));
    });
    
    y += 35;
    
    // Calculation
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CALCULATION', leftX, y);
    y += 5;
    
    const doseMg = isFixed ? (results.doses?.med || 0) : (results.doses?.med || 0) / 1000;
    const vialSize = Number(inputs.vialSize) || 5;
    const conc = vialSize / 3;
    const ml = doseMg / conc;
    
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.roundedRect(leftX, y, leftW, 14, 2, 2, 'F');
    
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text(vialSize + 'mg vial in 3ml = ' + conc.toFixed(2) + 'mg/ml', leftX + 3, y + 5);
    doc.text('Dose ' + doseMg.toFixed(2) + 'mg ÷ ' + conc.toFixed(2) + 'mg/ml = ' + ml.toFixed(3) + 'ml', leftX + 3, y + 10);
    
    // RIGHT COLUMN (Benefits & Considerations)
    let ry = startY;
    
    // Benefits
    doc.setTextColor(green[0], green[1], green[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('BENEFITS', rightX, ry);
    ry += 5;
    
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(rightX, ry, rightW, 38, 2, 2, 'F');
    doc.setDrawColor(green[0], green[1], green[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(rightX, ry, rightW, 38, 2, 2, 'S');
    
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    const pros = (peptide.pros || []).slice(0, 6);
    pros.forEach((p, i) => {
        doc.text('• ' + p.substring(0, 40), rightX + 3, ry + 6 + (i * 5.5));
    });
    
    ry += 42;
    
    // Considerations
    doc.setTextColor(red[0], red[1], red[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSIDERATIONS', rightX, ry);
    ry += 5;
    
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(rightX, ry, rightW, 38, 2, 2, 'F');
    doc.setDrawColor(red[0], red[1], red[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(rightX, ry, rightW, 38, 2, 2, 'S');
    
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    const cons = (peptide.cons || []).slice(0, 6);
    cons.forEach((c, i) => {
        doc.text('• ' + c.substring(0, 40), rightX + 3, ry + 6 + (i * 5.5));
    });
    
    // ===== SYRINGE GUIDE - Styled like UI =====
    y = Math.max(y + 20, ry + 42);
    
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('SYRINGE GUIDE', margin, y);
    y += 6;
    
    // Background box for syringe
    const guideW = contentW;
    const guideH = 28;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, guideW, guideH, 3, 3, 'FD');
    
    // Syringe dimensions (inside the box)
    const syrY = y + 8;
    const syrH = 14;
    const syrX = margin + 15;
    const syrW = guideW - 100;
    
    // Needle tip
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(syrX + syrW, syrY + syrH/2, syrX + syrW + 6, syrY + syrH/2);
    
    // Barrel outline
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.roundedRect(syrX, syrY, syrW, syrH, 1, 1, 'FD');
    
    // Scale marks (0, 10, 20, 30, 40, 50)
    const scaleX = syrX + 8;
    const scaleW = syrW - 16;
    const steps = 5;
    
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    for (let i = 0; i <= steps; i++) {
        const markX = scaleX + (i * scaleW / steps);
        doc.line(markX, syrY + 3, markX, syrY + syrH - 3);
        
        // Numbers
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text((i * 10) + '', markX, syrY + syrH + 3, { align: 'center' });
    }
    
    // Draw filled sections for each dose (stacked from left)
    const fillY = syrY + 2;
    const fillH = syrH - 4;
    
    configs.forEach((c, i) => {
        const pct = Math.min(c.units / 50, 1);
        const fillW = pct * scaleW;
        const colors = [
            [34, 197, 94],   // green
            [59, 130, 246],  // blue
            [245, 158, 11]   // amber
        ];
        
        // Fill from left
        doc.setFillColor(colors[i][0], colors[i][1], colors[i][2]);
        doc.roundedRect(scaleX, fillY, fillW, fillH, 1, 1, 'F');
        
        // Plunger line at end of fill
        doc.setDrawColor(colors[i][0] - 20, colors[i][1] - 20, colors[i][2] - 20);
        doc.setLineWidth(1);
        const endX = scaleX + fillW;
        doc.line(endX, fillY - 1, endX, fillY + fillH + 1);
        
        // Plunger handle (T shape)
        doc.setFillColor(30, 41, 59);
        doc.rect(endX - 3, fillY - 3, 6, 2, 'F'); // crossbar
        doc.rect(endX - 1, fillY - 6, 2, 5, 'F'); // handle
    });
    
    // "50U Insulin Syringe" label in center
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'italic');
    doc.text('50U Insulin Syringe', syrX + syrW/2, syrY + syrH/2 + 1, { align: 'center' });
    
    // Legend on right
    const legX = margin + guideW - 65;
    const legY = y + 6;
    
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Draw Amounts:', legX, legY);
    
    configs.forEach((c, i) => {
        const colors = [
            [34, 197, 94],
            [59, 130, 246],
            [245, 158, 11]
        ];
        const ly = legY + 6 + (i * 6);
        
        // Color box
        doc.setFillColor(colors[i][0], colors[i][1], colors[i][2]);
        doc.roundedRect(legX, ly - 2, 8, 4, 1, 1, 'F');
        
        // Text
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text(c.label + ': ' + c.units + ' units', legX + 11, ly + 0.5);
    });
    
    y += 34;
    
    // ===== IMPORTANT =====
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(red[0], red[1], red[2]);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'FD');
    
    doc.setFillColor(red[0], red[1], red[2]);
    doc.roundedRect(margin + 1, y + 1, 25, 4, 1, 1, 'F');
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTE', margin + 3, y + 4);
    
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text('Consult healthcare provider before use • Start with Conservative dose • Store at 2-8°C', margin + 3, y + 8);
    
    // ===== FOOTER =====
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 287, pageW, 10, 'F');
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by Phenom Vital Labs | For research purposes only', pageW/2, 292, { align: 'center' });
    
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
    
    if (name.includes('gh') || name.includes('cjc')) return 'Evening';
    if (name.includes('tirze') || name.includes('sema')) return 'Morning';
    if (name.includes('bpc') || name.includes('tb')) return 'Post-workout';
    return 'As directed';
}

export default { generatePDF };

/**
 * PDF Generator - Optimized with 3 Syringe Visuals
 * 
 * @module pdfGenerator
 */

export function generatePDF(peptide, results, inputs, previewMode) {
    try {
        if (!peptide || !results || !inputs) {
            alert('PDF generation failed: Missing data');
            return;
        }
        
        if (typeof window.jspdf === 'undefined') {
            alert('PDF generation failed: library not loaded');
            return;
        }
        
        const jsPDF = window.jspdf.jsPDF;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        
        const isFixed = peptide.fixed === true;
        const preview = previewMode || false;
        
        // Safely get values
        const safeDose = function(level) {
            if (results.doses && typeof results.doses === 'object') {
                return results.doses[level] || 0;
            }
            return 0;
        };
        
        const safeUnits = function(level) {
            if (results.syringeUnits && typeof results.syringeUnits === 'object') {
                return results.syringeUnits[level] || 0;
            }
            return 0;
        };
        
        // Colors
        const navy = [30, 41, 59];
        const blue = [37, 99, 235];
        const slate = [71, 85, 105];
        const gray = [148, 163, 184];
        const lightGray = [241, 245, 249];
        const green = [22, 163, 74];
        const greenLight = [220, 252, 231];
        const amber = [217, 119, 6];
        const amberLight = [254, 243, 199];
        const red = [220, 38, 38];
        const white = [255, 255, 255];
        
        const pageW = 210;
        const margin = 12;
        const contentW = pageW - (margin * 2);
        
        let y = 5;
        
        // Header
        doc.setFillColor(navy[0], navy[1], navy[2]);
        doc.rect(0, 0, pageW, 18, 'F');
        
        doc.setTextColor(white[0], white[1], white[2]);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('PHENOM VITAL LABS', margin, 12);
        
        const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        doc.setFillColor(white[0], white[1], white[2]);
        doc.roundedRect(pageW - margin - 28, 5, 28, 8, 1, 1, 'F');
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(6);
        doc.text(date, pageW - margin - 14, 10, { align: 'center' });
        
        y = 24;
        
        // Peptide name
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text((peptide.name || 'Unknown').toUpperCase(), margin, y);
        
        const cat = peptide.category || 'Unknown';
        const catW = doc.getTextWidth(cat.toUpperCase()) + 6;
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.roundedRect(pageW - margin - catW, y - 4, catW, 5, 1, 1, 'F');
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.setFontSize(5);
        doc.text(cat.toUpperCase(), pageW - margin - catW/2, y - 0.5, { align: 'center' });
        
        y += 6;
        
        // Dosage summary
        const medDose = safeDose('med');
        const medUnits = safeUnits('med');
        const recDose = isFixed 
            ? medDose + ' mg'
            : medDose.toLocaleString() + ' mcg';
        
        doc.setFillColor(239, 246, 255);
        doc.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
        doc.setDrawColor(blue[0], blue[1], blue[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentW, 10, 2, 2, 'S');
        
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommended: ' + recDose + ' • ' + (medUnits || 'N/A') + ' units • ' + (peptide.freq || ''), margin + 4, y + 6);
        
        y += 14;
        
        // Three syringe visuals
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('DRAW GUIDE', margin, y);
        y += 5;
        
        const configs = [
            { label: 'Conservative', val: safeDose('low'), units: safeUnits('low'), color: green, bg: greenLight, rec: false },
            { label: 'Standard', val: safeDose('med'), units: safeUnits('med'), color: blue, bg: [239, 246, 255], rec: true },
            { label: 'Advanced', val: safeDose('high'), units: safeUnits('high'), color: amber, bg: amberLight, rec: false }
        ];
        
        const syrW = (contentW - 8) / 3;
        const syrH = 22;
        
        for (let i = 0; i < configs.length; i++) {
            const c = configs[i];
            const x = margin + (i * (syrW + 4));
            
            // Background
            doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
            doc.setDrawColor(c.color[0], c.color[1], c.color[2]);
            doc.roundedRect(x, y, syrW, syrH + 18, 3, 3, 'FD');
            
            // Label
            doc.setTextColor(c.color[0], c.color[1], c.color[2]);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text(c.label.toUpperCase(), x + syrW/2, y + 6, { align: 'center' });
            
            if (c.rec) {
                doc.setFillColor(blue[0], blue[1], blue[2]);
                doc.roundedRect(x + syrW/2 - 14, y + 8, 28, 4, 1, 1, 'F');
                doc.setTextColor(white[0], white[1], white[2]);
                doc.setFontSize(4);
                doc.text('RECOMMENDED', x + syrW/2, y + 11, { align: 'center' });
            }
            
            // Syringe
            const barrelY = y + 14;
            const barrelH = 10;
            const barrelW = syrW - 16;
            const barrelX = x + 8;
            
            // Needle
            doc.setDrawColor(150, 150, 150);
            doc.setLineWidth(0.3);
            doc.line(barrelX + barrelW, barrelY + barrelH/2, barrelX + barrelW + 4, barrelY + barrelH/2);
            
            // Barrel
            doc.setFillColor(white[0], white[1], white[2]);
            doc.setDrawColor(c.color[0], c.color[1], c.color[2]);
            doc.setLineWidth(0.6);
            doc.roundedRect(barrelX, barrelY, barrelW, barrelH, 1, 1, 'FD');
            
            // Fill
            const pct = Math.min(c.units / 50, 1);
            const fillW = pct * (barrelW - 8);
            
            if (fillW > 0) {
                // Fill with lighter version of color (no alpha support in jsPDF)
                const lighterColor = [
                    Math.min(255, c.color[0] + 100),
                    Math.min(255, c.color[1] + 100),
                    Math.min(255, c.color[2] + 100)
                ];
                doc.setFillColor(lighterColor[0], lighterColor[1], lighterColor[2]);
                doc.roundedRect(barrelX + 4, barrelY + 2, fillW, barrelH - 4, 0.5, 0.5, 'F');
                
                // Plunger
                doc.setFillColor(80, 80, 80);
                doc.rect(barrelX + 4 + fillW - 1, barrelY - 1, 2, barrelH + 2, 'F');
                doc.rect(barrelX + 4 + fillW - 4, barrelY - 3, 8, 2, 'F');
            }
            
            // Scale
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.2);
            for (let j = 0; j <= 5; j++) {
                const mx = barrelX + 4 + (j * (barrelW - 8) / 5);
                doc.line(mx, barrelY + 2, mx, barrelY + barrelH - 2);
            }
            
            // Numbers
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(4);
            doc.text('0', barrelX + 4, barrelY + barrelH + 2, { align: 'center' });
            doc.text('50', barrelX + barrelW - 4, barrelY + barrelH + 2, { align: 'center' });
            
            // Info
            doc.setTextColor(navy[0], navy[1], navy[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(c.units + ' units', x + syrW/2, barrelY + barrelH + 6, { align: 'center' });
            
            const val = Number(c.val) || 0;
            doc.setTextColor(gray[0], gray[1], gray[2]);
            doc.setFontSize(5);
            doc.text(isFixed ? val + ' mg' : val.toLocaleString() + ' mcg', x + syrW/2, barrelY + barrelH + 10, { align: 'center' });
        }
        
        y += 48;
        
        // Two column layout
        const leftW = contentW * 0.50;
        const rightW = contentW * 0.46;
        const leftX = margin;
        const rightX = margin + leftW + 6;
        const colStartY = y;
        
        // Left: Protocol Details
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('PROTOCOL DETAILS', leftX, y);
        y += 5;
        
        const details = [
            ['Half-Life', peptide.halfLife || 'N/A'],
            ['Frequency', peptide.freq || 'N/A'],
            ['Cycle', (peptide.wks || 0) + ' weeks'],
            ['Vials', (results.vialsNeeded || 0).toString()],
            ['Timing', getTiming(peptide)]
        ];
        
        for (let i = 0; i < details.length; i++) {
            const d = details[i];
            const rowY = y + (i * 7);
            if (i % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(leftX, rowY - 3, leftW, 7, 'F');
            }
            doc.setTextColor(gray[0], gray[1], gray[2]);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text(d[0], leftX + 2, rowY + 1);
            doc.setTextColor(navy[0], navy[1], navy[2]);
            doc.setFont('helvetica', 'normal');
            doc.text(d[1], leftX + 28, rowY + 1);
        }
        
        y += 40;
        
        // Calculation
        doc.setTextColor(navy[0], navy[1], navy[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('CALCULATION', leftX, y);
        y += 5;
        
        const doseMg = isFixed ? medDose : (medDose / 1000);
        const vialSize = Number(inputs.vialSize) || 5;
        const conc = vialSize / 3;
        const ml = doseMg / conc;
        
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.roundedRect(leftX, y, leftW, 12, 2, 2, 'F');
        
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text(vialSize + 'mg ÷ 3ml = ' + conc.toFixed(2) + 'mg/ml', leftX + 3, y + 4);
        doc.text(doseMg.toFixed(2) + 'mg ÷ ' + conc.toFixed(2) + ' = ' + ml.toFixed(3) + 'ml', leftX + 3, y + 9);
        
        // Right: Benefits
        let ry = colStartY;
        
        doc.setTextColor(green[0], green[1], green[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('BENEFITS', rightX, ry);
        ry += 5;
        
        const pros = (peptide.pros || []).slice(0, 5);
        const prosH = Math.max(20, pros.length * 5 + 4);
        doc.setFillColor(220, 252, 231);
        doc.setDrawColor(green[0], green[1], green[2]);
        doc.roundedRect(rightX, ry, rightW, prosH, 2, 2, 'FD');
        
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        for (let i = 0; i < pros.length; i++) {
            doc.text('\u2022 ' + pros[i].substring(0, 45), rightX + 3, ry + 6 + (i * 5));
        }
        
        ry += prosH + 5;
        
        // Considerations
        doc.setTextColor(red[0], red[1], red[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('CONSIDERATIONS', rightX, ry);
        ry += 5;
        
        const cons = (peptide.cons || []).slice(0, 5);
        const consH = Math.max(20, cons.length * 5 + 4);
        doc.setFillColor(254, 226, 226);
        doc.setDrawColor(red[0], red[1], red[2]);
        doc.roundedRect(rightX, ry, rightW, consH, 2, 2, 'FD');
        
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        for (let i = 0; i < cons.length; i++) {
            doc.text('\u2022 ' + cons[i].substring(0, 45), rightX + 3, ry + 6 + (i * 5));
        }
        
        y = Math.max(y + 18, ry + consH + 5);
        
        // Important
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(red[0], red[1], red[2]);
        doc.roundedRect(margin, y, contentW, 8, 2, 2, 'FD');
        
        doc.setTextColor(red[0], red[1], red[2]);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text('IMPORTANT:', margin + 3, y + 5);
        
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text('Consult healthcare provider \u2022 Start Conservative \u2022 Store at 2-8\u00b0C', margin + 22, y + 5);
        
        // Footer
        doc.setFillColor(navy[0], navy[1], navy[2]);
        doc.rect(0, 288, pageW, 9, 'F');
        doc.setTextColor(white[0], white[1], white[2]);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text('Generated by Phenom Vital Labs | For research purposes only', pageW/2, 293, { align: 'center' });
        
        // Output
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        if (preview) {
            window.open(pdfUrl, '_blank');
        } else {
            doc.save((peptide.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_') + '_Protocol.pdf');
        }
        
    } catch (err) {
        console.error('PDF generation error:', err);
        alert('PDF generation failed: ' + err.message);
    }
}

function getTiming(peptide) {
    const name = (peptide.name || '').toLowerCase();
    
    if (name.indexOf('gh') !== -1 || name.indexOf('cjc') !== -1) return 'Evening';
    if (name.indexOf('tirze') !== -1 || name.indexOf('sema') !== -1) return 'Morning';
    if (name.indexOf('bpc') !== -1 || name.indexOf('tb') !== -1) return 'Post-workout';
    return 'As directed';
}

export default { generatePDF };

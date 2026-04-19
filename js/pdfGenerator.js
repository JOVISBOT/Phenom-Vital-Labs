/**
 * PDF Generator Module
 * Creates professional protocol PDFs using jsPDF
 * 
 * @module pdfGenerator
 */

/**
 * Generate protocol PDF
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
    
    // Check if it's a blend
    const isBlend = peptide.id.includes('blend') || peptide.category.toLowerCase().includes('blend');
    const unit = isBlend ? 'mg' : 'mcg';
    
    // Colors
    const primaryBlue = [30, 64, 175];
    const darkBlue = [30, 58, 138];
    const lightBlue = [239, 246, 255];
    const cream = [254, 252, 243];
    const gray = [107, 114, 128];
    
    // Page dimensions
    const pageWidth = 210;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // HEADER SECTION
    // Top bar with logo area
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Logo text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PHENOM VITAL LABS', margin, 24);
    
    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Premium Peptide Protocols | Research Compounds', margin, 32);
    
    // Protocol title box
    let y = 42;
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'F');
    
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(isBlend ? 'PEPTIDE BLEND PROTOCOL' : 'PEPTIDE PROTOCOL', margin + 5, y + 13);
    
    // Category badge
    doc.setFillColor(cream[0], cream[1], cream[2]);
    doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(pageWidth - margin - 55, y + 4, 55, 14, 2, 2, 'FD');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setFontSize(8);
    doc.text(peptide.category.toUpperCase(), pageWidth - margin - 27, y + 13, { align: 'center' });
    
    // PATIENT INFO BOX
    y += 28;
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');
    
    // Section label
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT PROTOCOL', margin + 5, y + 6);
    
    // Patient details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    doc.text(`Generated: ${date}`, margin + 5, y + 14);
    doc.text(`Weight: ${inputs.weight} lbs | Age: ${inputs.age} years`, margin + 5, y + 22);
    
    // PRODUCT INFO BOX
    y += 34;
    doc.setFillColor(cream[0], cream[1], cream[2]);
    doc.roundedRect(margin, y, contentWidth, 32, 3, 3, 'F');
    
    // Product name (large)
    doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(peptide.name.toUpperCase(), margin + 5, y + 10);
    
    // Product specs row
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Half-Life: ${peptide.halfLife || 'N/A'}`, margin + 5, y + 20);
    doc.text(`Frequency: ${peptide.freq || 'N/A'}`, margin + 70, y + 20);
    doc.text(`Cycle: ${peptide.wks} weeks`, margin + 130, y + 20);
    
    // Vial size info
    doc.setTextColor(0, 0, 0);
    doc.text(`Vial Size: ${isBlend ? inputs.vialSize + 'mg blend' : inputs.vialSize + 'mg'}`, margin + 5, y + 28);
    
    // DOSING PROTOCOL - Three columns
    y += 38;
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOMMENDED DOSING PROTOCOL', margin, y);
    
    y += 8;
    const colWidth = contentWidth / 3;
    
    // Column headers
    ['CONSERVATIVE', 'STANDARD', 'ADVANCED'].forEach((label, i) => {
        const x = margin + (i * colWidth);
        if (i === 1) {
            doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        } else {
            doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
        }
        doc.roundedRect(x, y, colWidth - 3, 55, 3, 3, 'F');
        
        if (i === 1) {
            doc.setTextColor(255, 255, 255);
        } else {
            doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        }
        doc.setFontSize(9);
        doc.text(label, x + (colWidth - 3) / 2, y + 8, { align: 'center' });
        
        if (i === 1) {
            doc.setFillColor(255, 255, 255);
            doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
            doc.setFontSize(7);
            doc.text('RECOMMENDED', x + (colWidth - 3) / 2, y + 14, { align: 'center' });
        }
        
        // Dose value
        const dose = i === 0 ? results.doses.low : i === 1 ? results.doses.med : results.doses.high;
        const units = i === 0 ? results.syringeUnits.low : i === 1 ? results.syringeUnits.med : results.syringeUnits.high;
        
        doc.setTextColor(i === 1 ? 255 : 0);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(`${dose}`, x + (colWidth - 3) / 2, y + 28, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(unit, x + (colWidth - 3) / 2, y + 35, { align: 'center' });
        
        // Syringe units
        doc.setTextColor(i === 1 ? 220 : gray[0], gray[1], gray[2]);
        doc.setFontSize(8);
        doc.text(`${units} units on ${inputs.syringe}U syringe`, x + (colWidth - 3) / 2, y + 45, { align: 'center' });
        
        // Per injection note
        doc.setFontSize(7);
        doc.text('per injection', x + (colWidth - 3) / 2, y + 50, { align: 'center' });
    });
    
    // SUMMARY BOX
    y += 62;
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, y, contentWidth, 25, 3, 3, 'F');
    
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PROTOCOL SUMMARY', margin + 5, y + 6);
    
    // Summary items
    const summaryY = y + 16;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Total Vials Needed: ${results.vialsNeeded}`, margin + 5, summaryY);
    doc.text(`Injections per Week: ${peptide.f}x`, margin + 70, summaryY);
    doc.text(`Total Protocol Duration: ${peptide.wks} weeks`, margin + 130, summaryY);
    
    // ADMINISTRATION GUIDANCE
    y += 32;
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.roundedRect(margin, y, contentWidth, 38, 3, 3, 'F');
    
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('ADMINISTRATION GUIDANCE', margin + 5, y + 7);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    // Get first 3 instructions
    const instructions = peptide.inst.slice(0, 3);
    instructions.forEach((inst, i) => {
        const lines = doc.splitTextToSize(`• ${inst}`, contentWidth - 10);
        lines.forEach((line, j) => {
            if (y + 14 + (i * 6) + (j * 5) < y + 35) {
                doc.text(line, margin + 5, y + 14 + (i * 6) + (j * 5));
            }
        });
    });
    
    // CLINICAL DOSING NOTES BOX
    y += 38;
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'FD');
    
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CLINICAL NOTES', margin + 5, y + 6);
    
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('• Bioavailability: 40-90% via subcutaneous route', margin + 5, y + 12);
    doc.text('• Peak plasma: 2-6 hours post-injection', margin + 5, y + 17);
    
    // Timing note based on frequency
    let timingNote = '';
    if (peptide.f === 1) timingNote = '• Take same time daily for 15-30% less variability';
    else if (peptide.f >= 14) timingNote = '• Multiple daily doses: space evenly throughout day';
    else timingNote = '• Consistent timing improves dose-response predictability';
    doc.text(timingNote, contentWidth / 2 + margin, y + 12);
    
    // Half-life guidance
    doc.text(`• Half-life: ${peptide.halfLife || 'See research'}`, contentWidth / 2 + margin, y + 17);

    // RENAL WARNING (if applicable)
    if (peptide.warnings && peptide.warnings.length > 0) {
        y += 44;
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(239, 68, 68);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'FD');
        
        doc.setTextColor(185, 28, 28);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('IMPORTANT WARNINGS', margin + 5, y + 7);
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.setFont('normal');
        
        const warningText = peptide.warnings.slice(0, 2).join(' • ');
        const lines = doc.splitTextToSize(warningText, contentWidth - 10);
        lines.forEach((line, i) => {
            if (i < 3) {
                doc.text(line, margin + 5, y + 15 + (i * 5));
            }
        });
    }
    
    // FOOTER
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(0, 280, pageWidth, 17, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('This protocol is generated for research purposes only. Consult a licensed healthcare provider before use.', pageWidth / 2, 288, { align: 'center' });
    doc.text('Phenom Vital Labs | phenomvitallabs.com', pageWidth / 2, 293, { align: 'center' });
    
    // Either preview or download
    if (previewMode) {
        const pdfData = doc.output('bloburl');
        window.open(pdfData, '_blank');
    } else {
        doc.save(`${peptide.id}_protocol.pdf`);
    }
}

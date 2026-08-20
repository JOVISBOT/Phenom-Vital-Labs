/**
 * PDF Generator - one-page protocol sheet with three syringe visuals
 *
 * @module pdfGenerator
 */

import { DISCLAIMER_TITLE, DISCLAIMER_BODY, formatDose, evidenceFor } from './ui.js';

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

        const preview = previewMode || false;
        const doseUnit = results.doseUnit;
        const vialUnit = results.vialUnit;
        const syringe = results.syringe;

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
        const pageH = 297;
        const margin = 12;
        const contentW = pageW - (margin * 2);

        let y = 5;

        // Header
        doc.setFillColor(...navy);
        doc.rect(0, 0, pageW, 18, 'F');

        doc.setTextColor(...white);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('PHENOM VITAL LABS', margin, 12);

        const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        doc.setFillColor(...white);
        doc.roundedRect(pageW - margin - 28, 5, 28, 8, 1, 1, 'F');
        doc.setTextColor(...navy);
        doc.setFontSize(6);
        doc.text(date, pageW - margin - 14, 10, { align: 'center' });

        y = 24;

        // Peptide name + category
        doc.setTextColor(...navy);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text((peptide.name || 'Unknown').toUpperCase(), margin, y);

        const cat = peptide.category || 'Unknown';
        const catW = doc.getTextWidth(cat.toUpperCase()) + 6;
        doc.setFillColor(...lightGray);
        doc.roundedRect(pageW - margin - catW, y - 4, catW, 5, 1, 1, 'F');
        doc.setTextColor(...slate);
        doc.setFontSize(5);
        doc.text(cat.toUpperCase(), pageW - margin - catW / 2, y - 0.5, { align: 'center' });

        y += 6;

        // Recommended-dose banner
        const medUnits = results.syringeUnits.med;
        doc.setFillColor(239, 246, 255);
        doc.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
        doc.setDrawColor(...blue);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentW, 10, 2, 2, 'S');

        doc.setTextColor(...navy);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(
            results.noRecon
                ? `Recommended: ${formatDose(results.doses.med, doseUnit)}  -  pre-filled ${results.device}, nothing to draw  -  ${peptide.freq || ''}`
                : `Recommended: ${formatDose(results.doses.med, doseUnit)}  -  ${fmtUnits(medUnits)} units on a ${syringe}U syringe  -  ${peptide.freq || ''}`,
            margin + 4, y + 6
        );

        y += 14;

        // Three syringe visuals
        doc.setTextColor(...navy);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(results.noRecon ? 'DOSE GUIDE' : 'DRAW GUIDE', margin, y);
        y += 5;

        const configs = [
            { key: 'low', label: 'Conservative', color: green, bg: greenLight, rec: false },
            { key: 'med', label: 'Standard', color: blue, bg: [239, 246, 255], rec: true },
            { key: 'high', label: 'Advanced', color: amber, bg: amberLight, rec: false }
        ];

        const syrW = (contentW - 8) / 3;
        const cardH = 46;

        for (let i = 0; i < configs.length; i++) {
            const c = configs[i];
            const x = margin + (i * (syrW + 4));
            const units = results.syringeUnits[c.key];
            const exceedsVial = results.exceedsVial[c.key];
            // Treat "needs more than one vial" as an overflow for colouring, so the
            // exported card is red on screen and on paper for the same reasons.
            const pooled = (results.vialsPooled && results.vialsPooled[c.key]) || 1;
            const overflow = (results.overflow[c.key] || exceedsVial) && pooled === 1;

            doc.setFillColor(...c.bg);
            doc.setDrawColor(...(overflow ? red : c.color));
            doc.roundedRect(x, y, syrW, cardH, 3, 3, 'FD');

            doc.setTextColor(...c.color);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text(c.label.toUpperCase(), x + syrW / 2, y + 6, { align: 'center' });

            if (c.rec) {
                doc.setFillColor(...blue);
                doc.roundedRect(x + syrW / 2 - 14, y + 8, 28, 4, 1, 1, 'F');
                doc.setTextColor(...white);
                doc.setFontSize(4);
                doc.text('RECOMMENDED', x + syrW / 2, y + 11, { align: 'center' });
            }

            // A pre-filled pen has no barrel to draw to. Rendering an empty
            // syringe for it would be a picture of a measurement that does not exist.
            if (results.noRecon) {
                doc.setTextColor(...navy);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text(formatDose(results.doses[c.key], doseUnit), x + syrW / 2, y + 24, { align: 'center' });
                doc.setTextColor(...gray);
                doc.setFontSize(5);
                doc.setFont('helvetica', 'normal');
                doc.text('pen strength', x + syrW / 2, y + 29, { align: 'center' });
                doc.text('no reconstitution', x + syrW / 2, y + 34, { align: 'center' });
                continue;
            }

            // Barrel
            const barrelY = y + 15;
            const barrelH = 10;
            const barrelW = syrW - 16;
            const barrelX = x + 8;

            doc.setDrawColor(150, 150, 150);
            doc.setLineWidth(0.3);
            doc.line(barrelX + barrelW, barrelY + barrelH / 2, barrelX + barrelW + 4, barrelY + barrelH / 2);

            doc.setFillColor(...white);
            doc.setDrawColor(...(overflow ? red : c.color));
            doc.setLineWidth(0.6);
            doc.roundedRect(barrelX, barrelY, barrelW, barrelH, 1, 1, 'FD');

            // Fill, clamped to the barrel and scaled to the SELECTED syringe --
            // this was hardcoded to /50 regardless of the syringe in use.
            const pct = Math.min(Math.max(units / syringe, 0), 1);
            const fillW = pct * (barrelW - 8);

            if (fillW > 0) {
                const tint = overflow ? [252, 165, 165] : c.color.map(v => Math.min(255, v + 100));
                doc.setFillColor(...tint);
                doc.roundedRect(barrelX + 4, barrelY + 2, fillW, barrelH - 4, 0.5, 0.5, 'F');

                if (!overflow) {
                    doc.setFillColor(80, 80, 80);
                    doc.rect(barrelX + 4 + fillW - 1, barrelY - 1, 2, barrelH + 2, 'F');
                    doc.rect(barrelX + 4 + fillW - 4, barrelY - 3, 8, 2, 'F');
                }
            }

            // Scale marks
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.2);
            for (let j = 0; j <= 5; j++) {
                const mx = barrelX + 4 + (j * (barrelW - 8) / 5);
                doc.line(mx, barrelY + 2, mx, barrelY + barrelH - 2);
            }

            doc.setTextColor(100, 100, 100);
            doc.setFontSize(4);
            doc.text('0', barrelX + 4, barrelY + barrelH + 2, { align: 'center' });
            doc.text(String(syringe), barrelX + barrelW - 4, barrelY + barrelH + 2, { align: 'center' });

            // Readout
            doc.setTextColor(...(overflow ? red : navy));
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(`${fmtUnits(units)} units`, x + syrW / 2, barrelY + barrelH + 6, { align: 'center' });

            doc.setTextColor(...gray);
            doc.setFontSize(5);
            doc.setFont('helvetica', 'normal');
            doc.text(formatDose(results.doses[c.key], doseUnit), x + syrW / 2, barrelY + barrelH + 10, { align: 'center' });

            const parts = results.components[c.key];
            if (parts) {
                doc.setFontSize(4);
                doc.text(parts.map(p => `${p.mcg} mcg ${shortName(p.name)}`).join('  +  '),
                    x + syrW / 2, barrelY + barrelH + 13.5, { align: 'center' });
            } else if (pooled > 1) {
                doc.setTextColor(...slate);
                doc.setFontSize(4);
                doc.text(`${pooled} vials pooled into one ${results.reconMl} ml volume`, x + syrW / 2, barrelY + barrelH + 13.5, { align: 'center' });
            } else if (exceedsVial) {
                doc.setTextColor(...red);
                doc.setFontSize(4);
                doc.text(`needs ${results.perDoseVials[c.key]} vials per dose`, x + syrW / 2, barrelY + barrelH + 13.5, { align: 'center' });
            } else if (overflow) {
                doc.setTextColor(...red);
                doc.setFontSize(4);
                doc.text(`${Math.ceil(units / syringe)} draws needed`, x + syrW / 2, barrelY + barrelH + 13.5, { align: 'center' });
            }
        }

        y += cardH + 6;

        // Two-column body
        const leftW = contentW * 0.50;
        const rightW = contentW * 0.46;
        const leftX = margin;
        const rightX = margin + leftW + 6;
        const colStartY = y;

        doc.setTextColor(...navy);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('PROTOCOL DETAILS', leftX, y);
        y += 5;

        const details = [
            ['Half-Life', peptide.halfLife || 'N/A'],
            ['Frequency', peptide.freq || 'N/A'],
            ['Cycle', `${peptide.cycle || (peptide.wks || 0) + ' weeks'} (${results.dosesPerCycle} inj)`],
            [results.noRecon ? 'Pens' : 'Vials', `${results.vialsNeeded} x ${results.vialSize}${vialUnit}`],
            ['Evidence', evidenceFor(peptide).label],
            ['Timing', getTiming(peptide)],
            ['For', `${inputs.weight} lbs, ${inputs.age} yrs (reference only)`]
        ];

        for (let i = 0; i < details.length; i++) {
            const rowY = y + (i * 6);
            if (i % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(leftX, rowY - 3, leftW, 6, 'F');
            }
            doc.setTextColor(...gray);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text(details[i][0], leftX + 2, rowY + 1);
            doc.setTextColor(...navy);
            doc.setFont('helvetica', 'normal');
            doc.text(details[i][1], leftX + 26, rowY + 1);
        }

        y += details.length * 6 + 4;

        // Calculation, using the volume actually selected rather than a hardcoded 3ml
        doc.setTextColor(...navy);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(results.noRecon ? 'NO DRAW TO CALCULATE' : 'CALCULATION', leftX, y);
        y += 5;

        doc.setFillColor(...lightGray);
        doc.roundedRect(leftX, y, leftW, 17, 2, 2, 'F');

        doc.setTextColor(...slate);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        if (results.noRecon) {
            doc.text(`${peptide.name} is supplied as a pre-filled ${results.device}.`, leftX + 3, y + 4);
            doc.text('There is no powder, no bacteriostatic water and no draw:', leftX + 3, y + 8.5);
            doc.text(`the dose is the ${results.vialSize}${vialUnit} ${results.device} itself.`, leftX + 3, y + 13);
            doc.setTextColor(...gray);
            doc.text('Reconstitution arithmetic does not apply to this product.', leftX + 3, y + 16);
        } else {
            const medPooled = (results.vialsPooled && results.vialsPooled.med) || 1;
            const medConc = (results.concentrationAt && results.concentrationAt.med) || results.concentration;
            doc.text(`${medPooled > 1 ? `${medPooled} x ` : ''}${results.vialSize}${vialUnit}${medPooled > 1 ? ' pooled' : ' vial'} + ${results.reconMl} ml BAC water = ${round(medConc, 2)} ${vialUnit}/ml`, leftX + 3, y + 4);
            doc.text(`${formatDose(results.doses.med, doseUnit)} / ${round(medConc, 2)} ${vialUnit}/ml = ${results.volumeMl.med} ml`, leftX + 3, y + 8.5);
            doc.text(`${results.volumeMl.med} ml x 100 units/ml = ${fmtUnits(medUnits)} units`, leftX + 3, y + 13);
            doc.setTextColor(...gray);
            doc.text('An insulin syringe is U-100: 100 units per ml.', leftX + 3, y + 16);
        }

        // Right column
        let ry = colStartY;

        doc.setTextColor(...green);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('BENEFITS', rightX, ry);
        ry += 5;

        const pros = (peptide.pros || []).slice(0, 5);
        const prosH = Math.max(20, pros.length * 5 + 4);
        doc.setFillColor(...greenLight);
        doc.setDrawColor(...green);
        doc.roundedRect(rightX, ry, rightW, prosH, 2, 2, 'FD');

        doc.setTextColor(...slate);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        pros.forEach((p, i) => doc.text('• ' + clip(p, 45), rightX + 3, ry + 6 + (i * 5)));

        ry += prosH + 5;

        doc.setTextColor(...red);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('CONSIDERATIONS', rightX, ry);
        ry += 5;

        const cons = (peptide.cons || []).slice(0, 5);
        const consH = Math.max(20, cons.length * 5 + 4);
        doc.setFillColor(254, 226, 226);
        doc.setDrawColor(...red);
        doc.roundedRect(rightX, ry, rightW, consH, 2, 2, 'FD');

        doc.setTextColor(...slate);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        cons.forEach((c, i) => doc.text('• ' + clip(c, 45), rightX + 3, ry + 6 + (i * 5)));

        y = Math.max(y + 21, ry + consH + 5);

        // Disclaimer - the same text the page shows, not a one-line footer note,
        // and prefixed with how well THIS record's doses are evidenced. A blanket
        // paragraph reads the same over a Mounjaro label strength and over a forum
        // figure for a compound that has never been in a human.
        const ev = evidenceFor(peptide);
        const body = doc.splitTextToSize(`${ev.label.toUpperCase()}: ${ev.blurb} ${DISCLAIMER_BODY}`, contentW - 8);
        const discH = 7 + body.length * 2.6;

        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(...red);
        doc.roundedRect(margin, y, contentW, discH, 2, 2, 'FD');

        doc.setTextColor(...red);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(DISCLAIMER_TITLE.toUpperCase(), margin + 3, y + 4.5);

        doc.setTextColor(...slate);
        doc.setFontSize(4.5);
        doc.setFont('helvetica', 'normal');
        body.forEach((line, i) => doc.text(line, margin + 3, y + 8 + (i * 2.6)));

        // Footer
        doc.setFillColor(...navy);
        doc.rect(0, pageH - 9, pageW, 9, 'F');
        doc.setTextColor(...white);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text('Generated by Phenom Vital Labs  -  research information only, not medical advice',
            pageW / 2, pageH - 3.5, { align: 'center' });

        // Output
        if (preview) {
            window.open(URL.createObjectURL(doc.output('blob')), '_blank');
        } else {
            doc.save((peptide.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_') + '_Protocol.pdf');
        }

    } catch (err) {
        console.error('PDF generation error:', err);
        alert('PDF generation failed: ' + err.message);
    }
}

function fmtUnits(units) {
    return Number.isInteger(units) ? String(units) : units.toFixed(1);
}

function round(n, dp) {
    return Number(n.toFixed(dp));
}

function clip(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function shortName(name) {
    return name.replace(/\s*\(.*\)/, '').replace('CJC-1295 NO DAC', 'CJC').replace('Ipamorelin', 'Ipa');
}

function getTiming(peptide) {
    const name = (peptide.name || '').toLowerCase();

    if (name.includes('gh') || name.includes('cjc')) return 'Evening';
    if (name.includes('tirze') || name.includes('sema')) return 'Morning';
    if (name.includes('bpc') || name.includes('tb')) return 'Post-workout';
    return 'As directed';
}

export default { generatePDF };

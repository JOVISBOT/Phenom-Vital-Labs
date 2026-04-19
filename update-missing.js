const fs = require('fs');
const path = 'data/peptides.json';

const peptidesData = JSON.parse(fs.readFileSync(path, 'utf8'));

// Add missing peptides
const additionalUpdates = {
  // Blends (already handled but verify)
  'blend_gh1': { low: 100, med: 150, high: 200, note: 'mcg each peptide' },
  'blend_heal': { low: 500, med: 1000, high: 1500, note: 'mg total blend' },
  'blend_heal_20': { low: 1000, med: 2000, high: 3000, note: 'mg total blend' },
  
  // Missing peptides
  'cjc1295': { low: 1000, med: 2000, high: 3000 }, // CJC with DAC
  'cagrilintide': { low: 100, med: 200, high: 300 },
  'crystagen': { low: 2000, med: 5000, high: 10000, note: 'mg' },
  'dermorphin': { low: 10, med: 20, high: 40, note: 'mcg - research only' },
  'dihexa': { low: 8, med: 16, high: 32, note: 'mg - nootropic' },
  'dulaglutide': { low: 750, med: 1500, high: 4500 }, // 0.75/1.5/4.5mg
  'epo': { low: 1000, med: 3000, high: 5000, note: 'IU' },
  'follistatin': { low: 50, med: 100, high: 150, note: 'mcg' },
  'foxo4': { low: 1, med: 2, high: 5, note: 'mg - senolytic' },
  'frag1723': { low: 200, med: 400, high: 600 },
  'glutathione': { low: 100, med: 200, high: 500, note: 'mg' },
  'gonadorelin': { low: 100, med: 200, high: 400 },
  'melanotan2': { low: 250, med: 500, high: 750 },
  'kisspeptin': { low: 100, med: 200, high: 300 },
  'nadplus': { low: 50, med: 100, high: 250, note: 'mg' },
  'pegmgf': { low: 100, med: 200, high: 300 },
  'oxytocin': { low: 10, med: 20, high: 40, note: 'IU' },
  'pinealon': { low: 2000, med: 5000, high: 10000, note: 'mg' },
  'vesugen': { low: 2000, med: 5000, high: 10000, note: 'mg' },
  'epithalon': { low: 3000, med: 5000, high: 7000 },
  'selank': { low: 300, med: 600, high: 900 },
  'semax': { low: 300, med: 600, high: 900 },
};

let count = 0;
const updated = [];

for (const pep of peptidesData.peptides) {
  if (additionalUpdates[pep.id]) {
    const u = additionalUpdates[pep.id];
    pep.low = u.low;
    pep.med = u.med;
    pep.high = u.high;
    updated.push(`${pep.name}: ${u.low}/${u.med}/${u.high} ${u.note || 'mcg'}`);
    count++;
  }
}

fs.writeFileSync(path, JSON.stringify(peptidesData, null, 2) + '\n');
console.log(`\n✅ Updated ${count} additional peptides\n`);
console.log(updated.join('\n'));

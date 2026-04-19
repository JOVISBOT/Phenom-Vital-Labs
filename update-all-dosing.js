const fs = require('fs');
const path = 'data/peptides.json';

const peptidesData = JSON.parse(fs.readFileSync(path, 'utf8'));

// Standard clinical dosing for all peptides (mcg unless specified in mg with note)
const updates = {
  // Myostatin/Performance
  'ace031': { low: 500, med: 1000, high: 1500, note: 'mg' }, // 1mg standard
  
  // Nootropics
  'adamax': { low: 200, med: 300, high: 500 },
  'semax': { low: 300, med: 600, high: 900 },
  'selank': { low: 300, med: 600, high: 900 },
  
  // Weight Loss / Metabolic
  'adipotide': { low: 200, med: 300, high: 500, note: 'mcg/kg - research only' },
  'aicar': { low: 50, med: 100, high: 200, note: 'mg' }, // 50-200mg
  'aod9604': { low: 300, med: 600, high: 900 },
  'cagrisema': { low: 125, med: 250, high: 500, note: 'mcg (blend)' },
  'semaglutide': { low: 500, med: 1000, high: 1500 },
  'semaglutide_tablet': { low: 3000, med: 6000, high: 9000 }, // oral daily
  'tirzepatide': { low: 2500, med: 5000, high: 7500 },
  'retatrutide': { low: 300, med: 500, high: 750 },
  'tesofensine': { low: 250, med: 500, high: 750, note: 'mcg - research' },
  'melanotan_2': { low: 250, med: 500, high: 750 },
  
  // Healing/Recovery
  'bpc157': { low: 250, med: 500, high: 750 },
  'tb500': { low: 2500, med: 5000, high: 7500 },
  'bpc157_tb500': { low: 500, med: 1000, high: 1500, note: 'mg blend' },
  'cjc1295_dac': { low: 1000, med: 2000, high: 3000 },
  'cjc1295_nodac': { low: 100, med: 200, high: 300 },
  'cjc_ipa': { low: 200, med: 300, high: 500, note: 'mg blend' },
  'epithalon': { low: 3000, med: 5000, high: 7000 }, // 5mg standard
  'dsip': { low: 100, med: 200, high: 300 },
  'thymalin': { low: 5000, med: 10000, high: 15000 }, // 10mg standard
  
  // Growth Hormone
  'ghrp2': { low: 100, med: 150, high: 250 },
  'ghrp6': { low: 100, med: 150, high: 250 },
  'hexarelin': { low: 50, med: 100, high: 150 },
  'ipamorelin': { low: 100, med: 200, high: 300 },
  'hgh': { low: 1000, med: 2000, high: 4000 }, // 2mg standard (4IU)
  'igf1': { low: 20, med: 40, high: 60 }, // IGF-1 LR3
  'tesamorelin': { low: 1000, med: 2000, high: 2000, note: 'mg, FDA 2mg daily' },
  'sermorelin': { low: 100, med: 200, high: 300 },
  'ghrp2_cjc': { low: 100, med: 150, high: 200, note: 'combined dose' },
  
  // Sexual Health
  'pt141': { low: 500, med: 1000, high: 1500 },
  'kisspeptin': { low: 100, med: 200, high: 300 },
  'melanotan_1': { low: 250, med: 500, high: 750 },
  
  // Fertility
  'hcg': { low: 250, med: 500, high: 1000, note: 'IU, not mcg' },
  'hmg': { low: 75, med: 150, high: 300, note: 'IU, not mcg' },
  
  // Anti-aging/Bioregulators
  'cortagen': { low: 2000, med: 5000, high: 10000, note: 'mg' },
  'pinealon': { low: 2000, med: 5000, high: 10000, note: 'mg' },
  'vesugen': { low: 2000, med: 5000, high: 10000, note: 'mg' },
  
  // Other
  'ara290': { low: 2000, med: 4000, high: 6000, note: 'mg' },
  'b733': { low: 500, med: 1000, high: 2000 },
  'll37': { low: 50, med: 100, high: 200, note: 'mg' },
  'modgrf': { low: 100, med: 200, high: 300 }, // same as CJC NO DAC
  'motsc': { low: 5, med: 10, high: 20, note: 'mg' },
  'nad': { low: 50, med: 100, high: 250, note: 'mg' },
  'oxytocin': { low: 10, med: 20, high: 40, note: 'IU' },
  'ss31': { low: 1, med: 2, high: 4, note: 'mg' },
};

let count = 0;
const updated = [];

for (const pep of peptidesData.peptides) {
  if (updates[pep.id]) {
    const u = updates[pep.id];
    pep.low = u.low;
    pep.med = u.med;
    pep.high = u.high;
    updated.push(`${pep.name}: ${u.low}/${u.med}/${u.high} ${u.note || 'mcg'}`);
    count++;
  } else {
    console.log(`⚠️ No update for: ${pep.id} (${pep.name})`);
  }
}

fs.writeFileSync(path, JSON.stringify(peptidesData, null, 2) + '\n');
console.log(`\n✅ Updated ${count} peptides\n`);
console.log(updated.join('\n'));

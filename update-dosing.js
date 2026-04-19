const fs = require('fs');
const path = 'data/peptides.json';

const peptidesData = JSON.parse(fs.readFileSync(path, 'utf8'));

// Top peptides with standard clinical dosing
const updates = {
  // GLP-1 Agonists
  'semaglutide': { low: 500, med: 1000, high: 1500 },    // Standard: 1mg weekly (common protocol)
  'tirzepatide': { low: 2500, med: 5000, high: 7500 },   // Standard: 5mg weekly
  'semaglutide_tablet': { low: 3000, med: 6000, high: 9000 }, // Standard: 3mg oral daily
  
  // Healing Peptides
  'bpc157': { low: 250, med: 500, high: 750 },           // Standard: 500mcg daily
  'tb500': { low: 2500, med: 5000, high: 7500 },         // Standard: 5mg weekly (or 750mcg daily)
  
  // Growth Hormone Secretagogues
  'cjc1295_nodac': { low: 100, med: 200, high: 300 },    // Standard: 100-200mcg
  'ipamorelin': { low: 100, med: 200, high: 300 },       // Standard: 200mcg
  'ghrp2': { low: 100, med: 150, high: 250 },            // Standard: 150mcg
  'ghrp6': { low: 100, med: 150, high: 250 },            // Standard: 150mcg
  
  // Other Popular
  'melanotan_2': { low: 250, med: 500, high: 750 },     // Standard: 500mcg
  'pt141': { low: 500, med: 1000, high: 1500 },          // Standard: 1mg
  'aod9604': { low: 300, med: 600, high: 900 },          // Standard: 600mcg
  'epithalon': { low: 3000, med: 5000, high: 7000 },     // Standard: 5mg per day
  'hexarelin': { low: 50, med: 100, high: 150 },         // Standard: 100mcg
  'igf1': { low: 20, med: 40, high: 60 },                // Standard: 40mcg (LR3)
};

let count = 0;
for (const pep of peptidesData.peptides) {
  if (updates[pep.id]) {
    pep.low = updates[pep.id].low;
    pep.med = updates[pep.id].med;
    pep.high = updates[pep.id].high;
    console.log(`✓ Updated ${pep.name}: ${updates[pep.id].low}/${updates[pep.id].med}/${updates[pep.id].high} mcg`);
    count++;
  }
}

fs.writeFileSync(path, JSON.stringify(peptidesData, null, 2) + '\n');
console.log(`\n✅ Updated ${count} peptides`);

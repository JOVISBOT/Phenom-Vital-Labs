const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/peptides.json', 'utf8'));

// Parse the user's supplier list
const supplierList = [
  'Retatrutide', 'Semaglutide', 'Tirzepatide', 'Adamax', 'Adipotide', 'Aicar',
  'ARA290', 'AOD9604', 'ACE 031', 'ACTH 1-39', 'B7-33', 'BPC 157', 'BPC+TB',
  'Cagrilintide', 'Cagrisema', 'CJC1295 with DAC', 'CJC 1295 without DAC',
  'Cardiogen', 'Cortagen', 'Crystagen', 'Dermorphin', 'DSIP', 'Dulaglutide',
  'Dihexa', 'Epithalon', 'EPO', 'FOX04', 'Frag 17-23', 'GHK-Cu', 'Glutathione',
  'GHRP-2', 'GHRP-6', 'Gonadorelin', 'HCG', 'HMG', 'HGH', 'HGH Fragment 176-191',
  'Hexarelin', 'Humanin', 'Ipamorelin', 'Kisspetin-10', 'Liraglutide', 'LL37',
  'Melanotan I', 'Melanotan II', 'MGF', 'MOTS-c', 'Nad+', 'Oxytocin', 'PEG MGF',
  'PE-22-28', 'PT141', 'Sermorelin', 'Snap8', 'KPV', 'Selank', 'Semax', 'SS-31',
  'TB500', 'Tesamorelin', 'Thymalin', 'Thymosin alpha 1', 'Triptorelln',
  'IGF-1 LR3', 'FST 344', 'GDF-8', 'Lipo-c', 'MIC', 'Lemon Bottle', 'VIP',
  'SLU-PP-332', 'Mazdutide', 'GLOW', 'FOXO4-DRI', 'FTPP Adipotide', 'Matrixyl',
  'Orexin B', 'Orexin A', 'P21', 'PNC-27', 'MK677', '5-AMINO-1MQ', 'Survodutide',
  'L-carnitine', 'Tesofensine', 'BPC157', 'Dixeha'
];

const ourPeptides = data.peptides.map(p => p.name.toLowerCase());

console.log('=== SUPPLIER vs OUR DATABASE ===\n');

// Check coverage
let missing = [];
let hasMatch = [];

supplierList.forEach(name => {
  const nameLower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const found = ourPeptides.some(p => {
    const pClean = p.replace(/[^a-z0-9]/g, '');
    return pClean.includes(nameLower) || nameLower.includes(pClean);
  });
  
  if (found) {
    hasMatch.push(name);
  } else {
    missing.push(name);
  }
});

console.log('✓ COVERED (' + hasMatch.length + '):');
hasMatch.forEach(m => console.log('  ' + m));

console.log('\n⚠️ MISSING FROM OUR DATABASE (' + missing.length + '):');
missing.forEach(m => console.log('  - ' + m));

console.log('\n=== ADDITIONAL VIAL SIZES NEEDED ===');
console.log('Retatrutide: Need 15mg, 20mg, 30mg, 40mg, 50mg, 60mg (currently only 2,4,8,10)');
console.log('Semaglutide: Need 15mg, 20mg, 30mg (currently only 2,5,10)');
console.log('Tirzepatide: Need 40mg, 50mg, 60mg, 80mg (currently only 5,10)');
console.log('BPC-157: Need 2mg (currently only 5,10)');
console.log('GHRP-2: Need 15mg (currently only 5,10)');
console.log('GHRP-6: Only have 5mg, 10mg (OK)');
console.log('HCG: Need 1000, 2000, 5000, 10000 IU (currently only 250,500,1000)');
console.log('HMG: Need 75 IU only (currently shows as mg)');
console.log('TB-500: Need 2mg (currently only 5,10)');

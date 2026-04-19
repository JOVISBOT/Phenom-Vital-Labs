const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/peptides.json', 'utf8'));
const peptides = data.peptides;

const ageFactors = {
  25: 1.0,
  35: 1.1,
  45: 1.2,
  55: 1.35,
  65: 1.5
};

console.log('='.repeat(100));
console.log('PEPTIDE DOSING TABLE BY AGE');
console.log('='.repeat(100));
console.log();
console.log('Age Factors:');
console.log('  25 years: 1.0x (baseline)');
console.log('  35 years: 1.1x (+10%)');
console.log('  45 years: 1.2x (+20%)');
console.log('  55 years: 1.35x (+35%)');
console.log('  65 years: 1.5x (+50%)');
console.log();

peptides.forEach(p => {
  const isBlend = p.id.includes('blend') || p.category.toLowerCase().includes('blend');
  const unit = isBlend || p.fixed ? 'mg' : 'mcg';
  
  console.log('');
  console.log(p.name);
  console.log('  Category: ' + p.category);
  console.log('  Base: Conservative=' + p.low + unit + ', Standard=' + p.med + unit + ', Advanced=' + p.high + unit);
  console.log('  Age  | Conservative | Standard | Advanced');
  console.log('  -----|--------------|----------|----------');
  
  Object.entries(ageFactors).forEach(([age, factor]) => {
    const low = Math.round(p.low * factor * 10) / 10;
    const med = Math.round(p.med * factor * 10) / 10;
    const high = Math.round(p.high * factor * 10) / 10;
    const ageStr = age.toString().padEnd(3);
    const lowStr = (low + unit).padEnd(12);
    const medStr = (med + unit).padEnd(8);
    const highStr = (high + unit).padEnd(8);
    console.log('  ' + ageStr + ' | ' + lowStr + ' | ' + medStr + ' | ' + highStr);
  });
});

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scraped_catalog.json', 'utf-8'));

const empty = data.filter(b => !b.coverImage || b.coverImage.trim() === '').length;
const total = data.length;

console.log('Total books:', total);
console.log('Books with missing/empty coverImage:', empty);
console.log('Books with coverImage URL:', total - empty);
console.log('');

const vendors = {};
data.forEach(b => {
  if(!vendors[b.sourceVendor]) vendors[b.sourceVendor] = { count: 0, withImage: 0, sample: '' };
  vendors[b.sourceVendor].count++;
  if(b.coverImage && b.coverImage.trim()) {
    vendors[b.sourceVendor].withImage++;
    if(!vendors[b.sourceVendor].sample) vendors[b.sourceVendor].sample = b.coverImage;
  }
});

console.log('Vendor breakdown:');
Object.entries(vendors).forEach(([v, info]) => {
  const pct = ((info.withImage / info.count) * 100).toFixed(1);
  console.log(`  ${v}: ${info.withImage}/${info.count} with images (${pct}%)`);
  if(info.sample) console.log(`    Sample: ${info.sample.substring(0, 70)}...`);
});

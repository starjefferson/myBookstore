const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scraped_catalog.json', 'utf-8'));

const byVendor = {};
data.forEach(b => {
  if (!byVendor[b.sourceVendor]) {
    byVendor[b.sourceVendor] = { total: 0, withImage: 0, empty: 0, samples: [] };
  }
  byVendor[b.sourceVendor].total++;
  
  if (b.coverImage && b.coverImage.trim()) {
    byVendor[b.sourceVendor].withImage++;
    if (byVendor[b.sourceVendor].samples.length < 2) {
      byVendor[b.sourceVendor].samples.push(b.coverImage);
    }
  } else {
    byVendor[b.sourceVendor].empty++;
  }
});

console.log('Books by vendor with image data:');
Object.entries(byVendor).forEach(([v, info]) => {
  const pct = ((info.withImage / info.total) * 100).toFixed(1);
  console.log(`${v}: ${info.withImage}/${info.total} have images (${pct}%) - ${info.empty} empty`);
  console.log('  Sample URLs:');
  info.samples.forEach(url => console.log('    ' + url.substring(0, 80)));
});

console.log('\n---\nThe issue is that vendor servers block cross-origin image requests.');
console.log('Next.js Image optimization cannot bypass this - it needs actual URLs that are publicly accessible.');
console.log('\nSolution: Download images to cloud storage (Firestore, Vercel Blob, or AWS S3)');

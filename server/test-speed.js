import { scrapeAllStores, STORES } from './scraper.js';

async function test() {
  const query = 'rice';
  console.time('Total scraping time');
  
  try {
    const results = await scrapeAllStores(query, STORES);
    console.timeEnd('Total scraping time');
    
    console.log('\nResults:');
    results.forEach(r => {
      console.log(`${r.storeName}: ${r.hasItem ? '✓ FOUND' : '✗ NOT FOUND'}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
    console.timeEnd('Total scraping time');
  }
  
  process.exit(0);
}

test();

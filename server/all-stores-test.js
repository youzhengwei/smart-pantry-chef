// Direct test of all three stores without HTTP overhead
import { scrapeAllStores } from './scraper.js';

async function test() {
  console.log('\n========================================');
  console.log('🧪 DIRECT SCRAPER TEST - ALL 3 STORES');
  console.log('========================================\n');

  try {
    const results = await scrapeAllStores('milk');
    
    console.log('\n========================================');
    console.log('📊 FINAL RESULTS');
    console.log('========================================\n');
    
    let available = 0;
    results.forEach((result, i) => {
      const status = result.hasItem ? '✓ YES' : '✗ NO';
      if (result.hasItem) available++;
      console.log(`${i + 1}. ${result.storeName.padEnd(20)} | ${status}`);
      console.log(`   URL: ${result.url}`);
      if (result.error) {
        console.log(`   ⚠️  Error: ${result.error}`);
      }
      console.log('');
    });
    
    console.log(`Summary: ${available}/${results.length} stores have "milk"`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  process.exit(0);
}

test();

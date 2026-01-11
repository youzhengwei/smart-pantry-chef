// Direct test of scraper to see logs
import { scrapeAllStores } from './scraper.js';

async function test() {
  console.log('\n\n==========================================');
  console.log('🧪 DIRECT SCRAPER TEST - DETAILED LOGS');
  console.log('==========================================\n');

  try {
    const results = await scrapeAllStores('milk');
    
    console.log('\n\n==========================================');
    console.log('📊 FINAL RESULTS');
    console.log('==========================================');
    
    results.forEach((result, i) => {
      const status = result.hasItem ? '✓ YES' : '✗ NO';
      console.log(`\n${i + 1}. ${result.storeName}`);
      console.log(`   Status: ${status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  process.exit(0);
}

test();

// Test just FairPrice store
import { scrapeStore } from './scraper.js';

const FAIRPRICE_CONFIG = {
  storeName: "NTUC FairPrice",
  storeCode: "fairprice",
  baseSearchUrl: "https://www.fairprice.com.sg/search",
  queryParam: "query",
  selectors: {
    searchInput: 'input[name="q"], input[placeholder*="Search"], input[type="search"]',
    searchButton: 'button[type="submit"]',
    productCard: '[data-testid="product"]',
    productCardFallback: ['a[class*="sc-e68f503d-3"]', '[class*="product-card"]', '[class*="product-item"]', 'article'],
    noResults: '.no-results, .empty-state, [data-testid="no-results"]'
  }
};

async function test() {
  console.log('\n\n==========================================');
  console.log('🧪 FAIRPRICE-ONLY TEST - DETAILED LOGS');
  console.log('==========================================\n');

  try {
    console.log('Starting FairPrice scrape for "milk"...\n');
    const result = await scrapeStore(FAIRPRICE_CONFIG, 'milk');
    
    console.log('\n\n==========================================');
    console.log('📊 RESULT');
    console.log('==========================================');
    console.log(`Store: ${result.storeName}`);
    console.log(`Has Item: ${result.hasItem ? '✓ YES' : '✗ NO'}`);
    console.log(`URL: ${result.url}`);
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  process.exit(0);
}

// Set timeout to 120 seconds
setTimeout(() => {
  console.error('\n\n❌ Test timeout - script took too long');
  process.exit(1);
}, 120000);

test();

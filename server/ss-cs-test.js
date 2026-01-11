// Test just Sheng Siong store
import { scrapeStore } from './scraper.js';

const SHENG_SIONG_CONFIG = {
  storeName: "Sheng Siong",
  storeCode: "shengsiong",
  baseSearchUrl: "https://shengsiong.com.sg/search",
  queryParam: "q",
  queryFormat: "path",
  selectors: {
    productCard: 'a.product-preview',
    productCardFallback: [
      '.product-item',
      'a[href*="/product/"]',
      'article'
    ],
    noResults: '.no-results, .empty-state, [class*="no-result"]'
  }
};

const COLD_STORAGE_CONFIG = {
  storeName: "Cold Storage",
  storeCode: "coldstorage",
  baseSearchUrl: "https://coldstorage.com.sg/en/search",
  queryParam: "keyword",
  selectors: {
    productCard: 'a.ware-wrapper',
    productCardFallback: [
      'a.router-link',
      '[class*="product"]',
      'article'
    ],
    noResults: '.no-results, .empty-state, [class*="no-result"]'
  }
};

async function test() {
  console.log('\n==========================================');
  console.log('🧪 SHENG SIONG + COLD STORAGE TEST');
  console.log('==========================================\n');

  try {
    console.log('Testing Sheng Siong...\n');
    const ssResult = await scrapeStore(SHENG_SIONG_CONFIG, 'milk');
    console.log(`\nSheng Siong Result: ${ssResult.hasItem ? '✓ YES' : '✗ NO'}`);
    console.log(`URL: ${ssResult.url}`);
    if (ssResult.error) console.log(`Error: ${ssResult.error}`);

    console.log('\n\n---\n');

    console.log('Testing Cold Storage...\n');
    const csResult = await scrapeStore(COLD_STORAGE_CONFIG, 'milk');
    console.log(`\nCold Storage Result: ${csResult.hasItem ? '✓ YES' : '✗ NO'}`);
    console.log(`URL: ${csResult.url}`);
    if (csResult.error) console.log(`Error: ${csResult.error}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  process.exit(0);
}

// Timeout after 120 seconds
setTimeout(() => {
  console.error('\n❌ Test timeout after 120s');
  process.exit(1);
}, 120000);

test();

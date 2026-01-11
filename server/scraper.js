import puppeteer from 'puppeteer';

// Central Puppeteer options for cloud environments like Railway
const PUPPETEER_LAUNCH_OPTIONS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process'
  ]
};

// Store configurations for Singapore supermarkets
export const STORES = [
  {
    storeName: "NTUC FairPrice",
    storeCode: "fairprice",
    baseSearchUrl: "https://www.fairprice.com.sg/search",
    queryParam: "query",
    selectors: {
      // Primary selector based on inspection: data-testid="product"
      // Fallback to a[class*="sc-e68f503d-3"] for styled anchor links
      productCard: '[data-testid="product"]',
      productCardFallback: [
        'a[class*="sc-e68f503d-3"]',
        '[class*="product-card"]',
        '[class*="product-item"]',
        'article'
      ],
      noResults: '.no-results, .empty-state, [data-testid="no-results"]'
    }
  },
  {
    storeName: "Sheng Siong",
    storeCode: "shengsiong",
    baseSearchUrl: "https://shengsiong.com.sg/search",
    queryParam: "q",
    queryFormat: "path",  // /search/<query> format instead of ?q=
    selectors: {
      productCard: 'a.product-preview',
      productCardFallback: [
        '.product-item',
        'a[href*="/product/"]',
        'article'
      ],
      noResults: '.no-results, .empty-state, [class*="no-result"]'
    }
  },
  {
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
  }
];

/**
 * Helper function to wait using Promise (replaces deprecated page.waitForTimeout)
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scrape a single store to check if it has a product matching the query
 * @param {Object} store - Store configuration
 * @param {string} query - Search query
 * @param {Object} browser - Puppeteer browser instance (optional, for reuse)
 * @returns {Promise<Object>} Result with storeName, storeCode, url, and hasItem
 */
export async function scrapeStore(store, query, browser = null) {
  const shouldCloseBrowser = !browser;
  let page = null;

  try {
    // Create browser if not provided
    if (!browser) {
      browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS);
    }

    // Build search URL - handle path-based queries for Sheng Siong
    let searchUrl;
    if (store.queryFormat === 'path') {
      // Sheng Siong uses /search/<query> format
      searchUrl = `${store.baseSearchUrl}/${encodeURIComponent(query)}`;
    } else {
      // Standard query parameter format
      searchUrl = `${store.baseSearchUrl}?${store.queryParam}=${encodeURIComponent(query)}`;
    }
    
    console.log(`\n[${store.storeName}] 🌐 Navigating to: ${searchUrl}`);

    page = await browser.newPage();
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to search URL with timeout and retry logic
    let pageLoaded = false;
    let lastError = null;

    try {
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      pageLoaded = true;
      console.log(`[${store.storeName}] ✓ Page loaded successfully`);
    } catch (navError) {
      lastError = navError;
      console.log(`[${store.storeName}] ⚠️  First navigation attempt failed: ${navError.message}`);
      
      // Retry with domcontentloaded
      try {
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });
        pageLoaded = true;
        console.log(`[${store.storeName}] ✓ Retry succeeded with domcontentloaded`);
      } catch (retryError) {
        console.log(`[${store.storeName}] ❌ Retry also failed: ${retryError.message}`);
        pageLoaded = false;
      }
    }

    if (!pageLoaded) {
      console.log(`[${store.storeName}] ❌ Could not load page, returning no results`);
      await page.close();
      return {
        storeName: store.storeName,
        storeCode: store.storeCode,
        url: searchUrl,
        hasItem: false,
        error: `Failed to load page: ${lastError?.message}`
      };
    }

    // Wait for dynamic content with delay instead of waitForTimeout
    console.log(`[${store.storeName}] Waiting for content to render...`);
    await delay(2000);

    // Try to wait for product container or results area
    const containerSelectors = [
      '[data-testid="search-results"]',
      '.search-results',
      '.products-grid',
      '.product-list',
      'main',
      '.main-content',
      '[role="main"]'
    ];

    let containerFound = false;
    for (const selector of containerSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`[${store.storeName}] Found results container with selector: ${selector}`);
        containerFound = true;
        break;
      } catch (e) {
        // Selector not found, try next
      }
    }

    if (!containerFound) {
      console.log(`[${store.storeName}] No results container found, but continuing...`);
    }

    // Check for "no results" message first
    const noResultsSelectors = store.selectors.noResults.split(', ');
    for (const selector of noResultsSelectors) {
      try {
        const noResultsElement = await page.$(selector);
        if (noResultsElement) {
          const text = await page.evaluate(el => el?.textContent || '', noResultsElement);
          if (text && (text.toLowerCase().includes('no result') || 
                       text.toLowerCase().includes('not found') ||
                       text.toLowerCase().includes('no product') ||
                       text.toLowerCase().includes('no items') ||
                       text.toLowerCase().includes('nothing found'))) {
            console.log(`[${store.storeName}] ✗ No results found (empty state message detected)`);
            await page.close();
            return {
              storeName: store.storeName,
              storeCode: store.storeCode,
              url: searchUrl,
              hasItem: false
            };
          }
        }
      } catch (e) {
        // Selector not found, continue
      }
    }

    // Check for product cards - with explicit waitForSelector for all stores
    let hasProducts = false;
    let productSelector = null;

    // Use explicit waitForSelector for all stores
    console.log(`[${store.storeName}] 🔍 Checking for products with selector: ${store.selectors.productCard}`);
    
    try {
      // Try to wait for the primary selector with 15 second timeout
      await page.waitForSelector(store.selectors.productCard, { timeout: 15000 });
      console.log(`[${store.storeName}] ✓ waitForSelector SUCCEEDED for: ${store.selectors.productCard}`);
      productSelector = store.selectors.productCard;
    } catch (e) {
      console.log(`[${store.storeName}] ⚠️  waitForSelector TIMED OUT (15s) for: ${store.selectors.productCard}`);
      
      // Try fallback selectors if configured
      if (store.selectors.productCardFallback && Array.isArray(store.selectors.productCardFallback)) {
        console.log(`[${store.storeName}] 🔄 Trying ${store.selectors.productCardFallback.length} fallback selectors...`);
        for (const fallbackSelector of store.selectors.productCardFallback) {
          try {
            await page.waitForSelector(fallbackSelector, { timeout: 5000 });
            console.log(`[${store.storeName}] ✓ Fallback SUCCEEDED: ${fallbackSelector}`);
            productSelector = fallbackSelector;
            break;
          } catch (fallbackError) {
            console.log(`[${store.storeName}] ⚠️  Fallback timed out: ${fallbackSelector}`);
          }
        }
      }
    }

    // Query with the selector we found (or don't have one)
    if (productSelector) {
      const products = await page.$$(productSelector);
      console.log(`[${store.storeName}] 📦 Found ${products.length} products with selector: ${productSelector}`);
      hasProducts = products.length > 0;
    } else {
      console.log(`[${store.storeName}] ❌ No selector matched after trying all options`);
      hasProducts = false;
    }

    await page.close();

    return {
      storeName: store.storeName,
      storeCode: store.storeCode,
      url: searchUrl,
      hasItem: hasProducts
    };

  } catch (error) {
    console.error(`[${store.storeName}] ✗ Error during scraping:`, error.message);
    
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    return {
      storeName: store.storeName,
      storeCode: store.storeCode,
      url: `${store.baseSearchUrl}?${store.queryParam}=${encodeURIComponent(query)}`,
      hasItem: false,
      error: error.message
    };
  } finally {
    if (shouldCloseBrowser && browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

/**
 * Scrape multiple stores to check product availability
 * @param {string} query - Search query
 * @param {Array<Object>} stores - Array of store configurations (defaults to STORES)
 * @returns {Promise<Array<Object>>} Array of results
 */
export async function scrapeAllStores(query, stores = STORES) {
  // ===== START OF SCRAPER FUNCTION =====
  console.log('[SCRAPER] Starting scrapeAllStores for query:', query);
  console.log('[SCRAPER] Stores to check:', stores.length);
  console.log('[SCRAPER] Environment:', process.env.NODE_ENV);
  
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    console.error('[SCRAPER] ❌ Invalid query provided');
    throw new Error('Query must be a non-empty string');
  }

  console.log('\n' + '='.repeat(60));
  console.log('[SCRAPER] Multi-store scrape starting');
  console.log('[SCRAPER] Query:', query);
  console.log('[SCRAPER] Stores:', stores.map(s => s.storeName).join(', '));
  console.log('[SCRAPER] Environment:', process.env.NODE_ENV || 'development');
  console.log('='.repeat(60));
  
  // Create a single browser instance for all stores
  let browser = null;
  const results = [];

  try {
    // Puppeteer launch arguments optimized for cloud platforms (Render, Heroku, etc.)
    console.log('[SCRAPER] Configuring Puppeteer launch arguments...');
    console.log('[SCRAPER] Platform:', process.platform);
    console.log('[SCRAPER] NODE_ENV:', process.env.NODE_ENV || 'development');
    
    console.log('[SCRAPER] Attempting to launch Puppeteer browser...');
    console.log('[SCRAPER] Launch args:', JSON.stringify(PUPPETEER_LAUNCH_OPTIONS.args, null, 2));

    browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS);
    console.log('[SCRAPER] ✓ Puppeteer browser launched successfully');
    console.log('[SCRAPER] Browser version:', await browser.version());

    // Scrape stores sequentially with delays to avoid being blocked
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      console.log(`\n[${i + 1}/${stores.length}] Processing ${store.storeName}...`);
      
      try {
        const result = await scrapeStore(store, query, browser);
        results.push(result);
      } catch (storeError) {
        // If individual store fails, add error result instead of stopping
        console.error(`[${store.storeName}] Store scraping failed:`, storeError.message);
        results.push({
          storeName: store.storeName,
          storeCode: store.storeCode,
          url: `${store.baseSearchUrl}`,
          hasItem: false,
          error: `Scraping error: ${storeError.message}`
        });
      }
      
      // Small delay between stores to be polite to servers
      if (i < stores.length - 1) {
        console.log(`Waiting before next store...`);
        await delay(1500);
      }
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR in scrapeAllStores:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // If Puppeteer failed to launch, return error results for all stores
    if (results.length === 0) {
      console.error('⚠️  Puppeteer failed to launch - returning error results for all stores');
      return stores.map(store => ({
        storeName: store.storeName,
        storeCode: store.storeCode,
        url: `${store.baseSearchUrl}`,
        hasItem: false,
        error: `Puppeteer launch failed: ${error.message}`
      }));
    }
    
    // Re-throw if it's a different error
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (e) {
        console.error('Error closing browser:', e.message);
      }
    }
  }

  // Print summary
  const availableStores = results.filter(r => r.hasItem);
  const unavailableStores = results.filter(r => !r.hasItem);

  console.log('\n' + '='.repeat(60));
  console.log('[SCRAPER] ✓ Scraping complete');
  console.log('[SCRAPER] Total stores checked:', results.length);
  console.log('[SCRAPER] Available:', availableStores.length);
  console.log('[SCRAPER] Unavailable:', unavailableStores.length);
  
  if (availableStores.length > 0) {
    console.log('[SCRAPER] Available at:');
    availableStores.forEach(store => {
      console.log('  •', store.storeName);
    });
  }
  
  console.log('='.repeat(60));
  
  // ===== END OF SCRAPER FUNCTION =====
  console.log('[SCRAPER] Finished scrapeAllStores with', results.length, 'results');
  console.log('[SCRAPER] Results:', JSON.stringify(results.map(r => ({ store: r.storeName, hasItem: r.hasItem, error: r.error })), null, 2));
  
  return results;
}

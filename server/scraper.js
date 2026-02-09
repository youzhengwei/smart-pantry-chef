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
    '--window-size=1920,1080',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process'
  ]
  // Don't specify executablePath - let Puppeteer find Chrome automatically
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
        '[data-testid*="product"]',
        'div[class*="product-card"]',
        'a[href*="/product"]',
        '[class*="product-item"]',
        'div[role="link"]',
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
        'a[href*="/product"]',
        'div[class*="product"]',
        '.product-item',
        'a[class*="product"]',
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
        'a[href*="/product"]',
        'div[class*="ware"]',
        'div[class*="product"]',
        '[class*="product-item"]',
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
 * Remove quantity and unit from product text
 * Extracts only the ingredient name
 * @param {string} text - Product text containing quantity, unit, and name
 * @returns {string} Cleaned product name without quantity and unit
 */
function cleanProductName(text) {
  // Split by newlines in case format is "1 kg\nNuts" or "Nuts\n1 kg"
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Pattern to match quantity + unit combinations
  const quantityUnitPattern = /^\s*\d+(\.\d+)?\s*[x×X]?\s*\d*(\.\d+)?\s*(kg|kilogram|g|gram|mg|milligram|oz|ounce|ml|milliliter|l|liter|cl|centiliter|fl\s*oz|pack|packs|pc|pcs|piece|pieces|each|ea|box|boxes|bottle|bottles|can|cans|jar|jars|lb|lbs|pound|pounds)\b/i;

  let cleaned = '';
  
  // Process each line - keep lines that don't look like quantities
  for (const line of lines) {
    if (!quantityUnitPattern.test(line)) {
      // This line doesn't start with a quantity/unit, so keep it
      if (cleaned) {
        cleaned += ' ' + line;
      } else {
        cleaned = line;
      }
    }
  }
  
  // If we removed all lines, just clean the original text as fallback
  if (!cleaned) {
    cleaned = text.trim();
    // Try to remove quantity/unit from start
    cleaned = cleaned.replace(/^\s*\d+(\.\d+)?\s*[x×X]?\s*\d*(\.\d+)?\s*(kg|kilogram|g|gram|mg|milligram|oz|ounce|ml|milliliter|l|liter|cl|centiliter|fl\s*oz|pack|packs|pc|pcs|piece|pieces|each|ea|box|boxes|bottle|bottles|can|cans|jar|jars|lb|lbs|pound|pounds)\s+/i, '').trim();
  }
  
  return cleaned;
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

    // Navigate with optimized timeout
    try {
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 6000
      });
      console.log(`[${store.storeName}] ✓ Page loaded`);
    } catch (navError) {
      console.log(`[${store.storeName}] ⚠️  Timeout, continuing anyway...`);
    }

    // Accept common consent / cookies banners (best-effort, non-blocking)
    try {
      await page.evaluate(() => {
        const labels = ['accept', 'agree', 'got it', 'i understand', 'close'];
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], .cookie, .consent'));
        for (const btn of buttons) {
          const text = (btn.innerText || btn.textContent || '').toLowerCase();
          if (labels.some(l => text.includes(l))) {
            try {
              btn.click();
            } catch {}
          }
        }
      });
    } catch (consentErr) {
      console.log(`[${store.storeName}] Consent dismiss failed: ${consentErr.message || consentErr}`);
    }

    // Skip delays - products should already be loaded

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
      // Try to wait for the primary selector with 1.5 second timeout
      await page.waitForSelector(store.selectors.productCard, { timeout: 1500 });
      console.log(`[${store.storeName}] ✓ waitForSelector SUCCEEDED for: ${store.selectors.productCard}`);
      productSelector = store.selectors.productCard;
    } catch (e) {
      console.log(`[${store.storeName}] ⚠️  waitForSelector TIMED OUT for: ${store.selectors.productCard}`);
      
      // Try fallback selectors if configured
      if (store.selectors.productCardFallback && Array.isArray(store.selectors.productCardFallback)) {
        console.log(`[${store.storeName}] 🔄 Trying ${store.selectors.productCardFallback.length} fallback selectors...`);
        for (const fallbackSelector of store.selectors.productCardFallback) {
          try {
            await page.waitForSelector(fallbackSelector, { timeout: 500 });
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
    let productTexts = [];
    if (productSelector) {
      const products = await page.$$(productSelector);
      console.log(`[${store.storeName}] 📦 Found ${products.length} products with selector: ${productSelector}`);

      if (products.length > 0) {
        // Extract text from found products
        productTexts = await page.$$eval(productSelector, nodes =>
          nodes.slice(0, 80).map(node => {
            const text = (node.innerText || node.textContent || '').trim();
            return text.split('\n').filter(line => line.trim().length > 0).join('\n');
          }).filter(text => text.length > 0)
        );
        
        // Filter out common error/UI messages that shouldn't be treated as products
        const errorPatterns = [
          /no products? found/i,
          /no results?/i,
          /nothing found/i,
          /0 products?/i,
          /found 0/i,
          /check out our/i,
          /try again/i,
          /search returned/i,
          /no items? match/i
        ];
        
        productTexts = productTexts.filter(text => {
          const lowerText = text.toLowerCase();
          // Filter out texts that match error patterns
          if (errorPatterns.some(pattern => pattern.test(lowerText))) {
            return false;
          }
          // Filter out very short texts (likely UI elements, not products)
          if (text.length < 5) {
            return false;
          }
          return true;
        });
        
        console.log(`[${store.storeName}] 📝 After filtering: ${productTexts.length} valid product texts`);
      }
    }

    // If we didn't find products, try a broader search
    if (productTexts.length === 0) {
      console.log(`[${store.storeName}] 🔄 No products found with selectors, trying broader search...`);
      try {
        productTexts = await page.evaluate(() => {
          // Try to find any element that might contain product info
          const candidates = document.querySelectorAll('[class*="product"], [class*="item"], a, div[role="link"]');
          const texts = [];
          for (const el of candidates) {
            const text = (el.innerText || el.textContent || '').trim();
            if (text.length > 2 && text.length < 200) {
              texts.push(text);
            }
          }
          return texts.slice(0, 100);
        });
        console.log(`[${store.storeName}] 📦 Broad search found ${productTexts.length} potential product texts`);
        
        // Apply the same error filtering to broader search results
        const errorPatterns = [
          /no products? found/i,
          /no results?/i,
          /nothing found/i,
          /0 products?/i,
          /found 0/i,
          /check out our/i,
          /try again/i,
          /search returned/i,
          /no items? match/i
        ];
        
        productTexts = productTexts.filter(text => {
          const lowerText = text.toLowerCase();
          // Filter out texts that match error patterns
          if (errorPatterns.some(pattern => pattern.test(lowerText))) {
            return false;
          }
          // Filter out very short texts (likely UI elements, not products)
          if (text.length < 5) {
            return false;
          }
          return true;
        });
        
        console.log(`[${store.storeName}] 📝 After filtering broad search: ${productTexts.length} valid texts`);
      } catch (e) {
        console.log(`[${store.storeName}] ⚠️  Broad search also failed`);
      }
    }

    // Now proceed with matching if we have product texts
    if (productTexts.length > 0) {
      const normalize = (str) => str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Clean product names by removing quantities and units
      const cleanedProductTexts = productTexts.map(text => cleanProductName(text));

      // Create normalized query for matching
      const queryNorm = normalize(query).trim();
      const queryWords = queryNorm.split(' ').filter(w => w.length > 0);
      
      // STRICTER matching: check if query words appear as whole words - NO SUBSTRING MATCHING FOR SHORT QUERIES
      const matched = queryWords.length === 0 ? [] : cleanedProductTexts.filter(productName => {
        const productNorm = normalize(productName);
        const productWords = productNorm.split(' ');
        
        // Check if ALL query words appear in the product (as whole words or very close matches)
        return queryWords.every(queryWord => {
          // For ALL query words, require exact whole word match first
          if (productWords.includes(queryWord)) {
            return true;
          }
          
          // Check plural/singular variations (e.g., milk/milks, pen/pens)
          const singular = queryWord.replace(/s$/, '');
          const plural = queryWord + 's';
          if (productWords.includes(plural) || productWords.includes(singular)) {
            return true;
          }
          
          // Only allow substring matching for longer words (5+ chars) to catch compound words
          // This prevents "pen" matching "peng" but allows "chocolate" to match "ferrero-chocolate"
          if (queryWord.length >= 5) {
            return productWords.some(pw => pw.length >= queryWord.length && pw.includes(queryWord));
          }
          
          return false;
        });
      });

      hasProducts = matched.length > 0;
      console.log(`[${store.storeName}] ✅ Matched products: ${matched.length} of ${cleanedProductTexts.length} (search: "${query}")`);
      if (matched.length > 0) {
        console.log(`[${store.storeName}] 📝 Found: ${matched.slice(0, 5).map(p => `"${p}"`).join(', ')}`);
      } else if (cleanedProductTexts.length > 0) {
        console.log(`[${store.storeName}] 🔍 No matches. Sample products: ${cleanedProductTexts.slice(0, 8).map(p => `"${p}"`).join(', ')}`);
      }
    } else {
      console.log(`[${store.storeName}] ⚠️  No product texts found - cannot match`);
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

    // Scrape all stores in PARALLEL for speed
    console.log(`[SCRAPER] Starting parallel scraping of ${stores.length} stores...`);
    const storePromises = stores.map(store => 
      scrapeStore(store, query, browser).catch(storeError => {
        console.error(`[${store.storeName}] Store scraping failed:`, storeError.message);
        return {
          storeName: store.storeName,
          storeCode: store.storeCode,
          url: `${store.baseSearchUrl}`,
          hasItem: false,
          error: `Scraping error: ${storeError.message}`
        };
      })
    );
    
    results.push(...await Promise.all(storePromises));
    console.log(`[SCRAPER] ✓ Parallel scraping complete`);

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

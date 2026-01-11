# Deploying Scraper Backend to Render

## Required Configuration

### 1. render.yaml (Already Created)
This file configures Render to properly install Puppeteer and Chrome dependencies.

### 2. Environment Variables in Render Dashboard
Set these in your Render service settings:
- `NODE_ENV` = `production`
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` = `false`
- Add any Firebase or OpenAI keys as needed

### 3. Build Command
The build command in render.yaml will:
1. Run `npm install` to install all dependencies including Puppeteer
2. Run `npx puppeteer browsers install chrome` to install Chrome

### 4. Start Command
```
node server/server.js
```

## Troubleshooting

### If you still get empty results:

1. **Check Render Logs** - Look for:
   - `[SCRAPER] 🔍 Starting scrapeAllStores for query:`
   - `[SCRAPER] ✓ Puppeteer browser launched successfully`
   - If you see `❌ FATAL ERROR`, check the error message

2. **Verify Puppeteer Installation**
   In Render shell, run:
   ```bash
   node -e "console.log(require('puppeteer').executablePath())"
   ```

3. **Check Chrome Installation**
   ```bash
   npx puppeteer browsers list
   ```

4. **Memory Issues**
   If Chrome crashes due to memory, you may need to upgrade from the Free plan.

## Alternative: Use puppeteer-core + chrome-aws-lambda

If Puppeteer still doesn't work on Render's free tier, you can switch to:
```bash
npm install puppeteer-core chrome-aws-lambda
```

And update scraper.js to use chrome-aws-lambda instead of the bundled Chrome.

## Testing the Deployed Endpoint

```javascript
fetch('https://freshkeep-scraper-backend.onrender.com/search-products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'milk' }),
})
  .then(res => res.json())
  .then(data => {
    console.log('Results:', data.results.length);
    console.log('Available:', data.summary.available);
  });
```

Expected response:
```json
{
  "query": "milk",
  "results": [
    {
      "storeName": "NTUC FairPrice",
      "storeCode": "fairprice",
      "url": "https://www.fairprice.com.sg/search?query=milk",
      "hasItem": true
    },
    // ... 2 more stores
  ],
  "summary": {
    "total": 3,
    "available": 3,
    "unavailable": 0,
    "errors": 0
  }
}
```

# Deploying to Railway

- The Express server listens on `process.env.PORT` when provided (falls back to 3000 locally).
- Railway should run `npm install` then `npm run start` to boot the scraper backend.
- Puppeteer uses the bundled Chromium with `--no-sandbox` and `--disable-setuid-sandbox` flags (plus related stability flags) for compatibility on Railway containers.
- Production runs the same scraper path (`scrapeAllStores`) as local; there are no shortcuts that bypass scraping.

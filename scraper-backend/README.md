# FreshKeep Scraper Backend

Standalone Express server for product scraping functionality in the FreshKeep app.

## API

### POST /search-products

Scrapes NTUC FairPrice for products matching the search query.

**Request Body:**
```json
{
  "query": "Milk 1 kg"
}
```

**Response:**
```json
{
  "results": [
    {
      "supermarket": "ntuc",
      "title": "HL Milk Low Fat 1L",
      "price": "$3.20",
      "measurement": "1L",
      "link": "https://www.fairprice.com.sg/product/hl-milk-low-fat-1l-12129496"
    }
  ]
}
```

### GET /health

Health check endpoint.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development mode:
   ```bash
   npm run dev
   ```

3. The server will start on `http://localhost:3000`

## Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Render/Railway

1. **Build Command:**
   ```
   npm install && npm run build
   ```

2. **Start Command:**
   ```
   npm start
   ```

3. **Environment Variables:**
   - `PORT` (optional, defaults to 3000)

### Update Frontend Environment

After deployment, update your `.env` file to point to the new backend:

```env
# Replace with your deployed backend URL
VITE_N8N_WEBHOOK_URL=https://your-scraper-backend.onrender.com/search-products
```

## Architecture

- Uses Express.js for the web server
- Axios for HTTP requests
- Cheerio for HTML parsing
- CORS enabled for frontend integration
- TypeScript for type safety
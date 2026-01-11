import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

interface ProductResult {
  supermarket: 'ntuc';
  title: string;
  price: string;
  measurement: string;
  link: string;
}

async function scrapeNtuc(query: string): Promise<ProductResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.fairprice.com.sg/search?query=${encodedQuery}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const results: ProductResult[] = [];

    // Find product cards - adjust selectors based on FairPrice website structure
    $('.product-card, .product-item, [data-testid*="product"]').each((index: number, element: any) => {
      const $el = $(element);

      // Extract product title
      const title = $el.find('.product-title, .product-name, h3, h4').first().text().trim() ||
                   $el.find('a').attr('title')?.trim() || '';

      // Extract price
      const price = $el.find('.product-price, .price, [data-testid*="price"]').first().text().trim() ||
                   $el.find('.price').text().trim() || '';

      // Extract measurement/unit
      const measurement = $el.find('.product-weight, .weight, .unit, .measurement').first().text().trim() || '';

      // Extract product link
      const link = $el.find('a').attr('href');
      const fullLink = link ? (link.startsWith('http') ? link : `https://www.fairprice.com.sg${link}`) : '';

      if (title && price) {
        results.push({
          supermarket: 'ntuc',
          title,
          price,
          measurement,
          link: fullLink
        });
      }
    });

    return results.slice(0, 10); // Limit to first 10 results
  } catch (error) {
    console.error('Error scraping NTUC:', error);
    throw new Error('Failed to scrape product data');
  }
}

// Routes
app.post('/search-products', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required and must be a string' });
    }

    const results = await scrapeNtuc(query);
    res.json({ results });
  } catch (error) {
    console.error('Error in search-products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Scraper backend server running on port ${PORT}`);
});
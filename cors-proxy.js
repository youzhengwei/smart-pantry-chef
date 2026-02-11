import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Proxy endpoint for recipe generation
app.post('/api/generate-recipes', async (req, res) => {
  try {
    const response = await fetch('https://primary-production-e54f.up.railway.app/webhook/generate-recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy request' });
  }
});

// Proxy endpoint for Google Places API
app.post('/api/places/:endpoint', async (req, res) => {
  try {
    const { endpoint } = req.params;
    const apiKey = process.env.VITE_GOOGLE_PLACES_API_KEY || req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key not provided' });
    }

    const url = `https://places.googleapis.com/v1/places:${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': req.headers['x-goog-fieldmask'] || 'places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours'
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Places API proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy Places API request' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`CORS proxy server running on port ${PORT}`);
});
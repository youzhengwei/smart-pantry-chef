import express from 'express';
import admin from 'firebase-admin';
import OpenAI from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { scrapeAllStores, STORES } from './scraper.js';

dotenv.config();

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync(join(__dirname, '../serviceAccountKey.json'), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Initialize OpenAI (optional - only needed for recipe generation)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('OpenAI initialized for recipe generation');
} else {
  console.warn('OPENAI_API_KEY not found - recipe generation will not be available');
}

// Express app setup
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Helper Functions
const buildPrompt = (inventoryItems, strictOnly, preferenceText) => {
  const ingredientList = inventoryItems.map(item =>
    `${item.name} (${item.quantity} ${item.quantityUnit})`
  ).join(', ');

  // Always available in small quantities (doesn't affect inventory tracking)
  const assumedPantryStaples = ['salt', 'pepper', 'oil', 'butter', 'sugar', 'flour', 'water'];
  // Additional staples that can be used in non-strict mode
  const optionalPantryStaples = ['garlic', 'onion', 'soy sauce', 'vinegar', 'herbs', 'spices'];

  let prompt = `I have these ingredients available: ${ingredientList}

Please generate 3 creative recipe ideas`;

  if (strictOnly) {
    prompt += `. You can use small amounts of basic pantry staples that are typically always available: ${assumedPantryStaples.join(', ')} (like "a pinch of salt" or "1 tbsp oil"). Do NOT include any other ingredients not in my inventory list.`;
  } else {
    prompt += `. You can include up to 3 additional pantry staples from: ${optionalPantryStaples.join(', ')}, plus small amounts of basic staples: ${assumedPantryStaples.join(', ')}.`;
  }

  if (preferenceText) {
    prompt += `. Please incorporate these preferences: ${preferenceText}`;
  }

  prompt += `.

For each recipe, provide in JSON format:
{
  "name": "Recipe Name",
  "ingredients": ["exact ingredient from available list"],
  "instructions": ["step-by-step cooking instructions"],
  "cookingTime": "estimated time (e.g., '30 minutes')",
  "difficulty": "easy/medium/hard",
  "servings": 2
}

IMPORTANT:
- Return ONLY a valid JSON array of exactly 3 recipes
- Every ingredient mentioned in instructions must appear in the ingredients array
- Do not include any text outside the JSON array`;

  return prompt;
};

const validateRecipe = (recipe, availableIngredients, strictOnly) => {
  // Always available in small quantities (doesn't affect inventory tracking)
  const assumedPantryStaples = ['salt', 'pepper', 'oil', 'butter', 'sugar', 'flour', 'water'];
  // Additional staples that can be used in non-strict mode
  const optionalPantryStaples = ['garlic', 'onion', 'soy sauce', 'vinegar', 'herbs', 'spices'];

  // Check required fields
  if (!recipe.name || !recipe.ingredients || !recipe.instructions ||
      !recipe.cookingTime || !recipe.difficulty || !recipe.servings) {
    return false;
  }

  // Check ingredients are arrays and not empty
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    return false;
  }

  // Check instructions are arrays and not empty
  if (!Array.isArray(recipe.instructions) || recipe.instructions.length === 0) {
    return false;
  }

  // Check servings is a number
  if (typeof recipe.servings !== 'number' || recipe.servings <= 0) {
    return false;
  }

  // Check difficulty is valid
  if (!['easy', 'medium', 'hard'].includes(recipe.difficulty)) {
    return false;
  }

  // Validate ingredients based on strict mode
  const availableNames = availableIngredients.map(item =>
    item.name.toLowerCase().trim()
  );

  for (const ingredient of recipe.ingredients) {
    const ingredientLower = ingredient.toLowerCase().trim();

    // Always allow assumed pantry staples (salt, pepper, oil, etc.)
    const isAssumedStaple = assumedPantryStaples.some(staple =>
      ingredientLower.includes(staple.toLowerCase())
    );

    if (isAssumedStaple) {
      continue; // Always allow these
    }

    if (strictOnly) {
      // In strict mode, ingredient must be in available inventory (excluding assumed staples)
      const isAvailable = availableNames.some(name =>
        ingredientLower.includes(name) || name.includes(ingredientLower)
      );

      if (!isAvailable) {
        return false;
      }
    } else {
      // In non-strict mode, allow optional pantry staples + available ingredients
      const isAvailable = availableNames.some(name =>
        ingredientLower.includes(name) || name.includes(ingredientLower)
      );
      const isOptionalStaple = optionalPantryStaples.some(staple =>
        ingredientLower.includes(staple.toLowerCase())
      );

      if (!isAvailable && !isOptionalStaple) {
        return false;
      }
    }
  }

  return true;
};

const saveRecipes = async (uid, recipes) => {
  const batch = db.batch();
  const savedRecipes = [];

  for (const recipe of recipes) {
    const recipeRef = db.collection('users').doc(uid).collection('recipes').doc();
    const recipeData = {
      ...recipe,
      isFavourite: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'ai'
    };

    batch.set(recipeRef, recipeData);
    savedRecipes.push({
      id: recipeRef.id,
      ...recipeData
    });
  }

  await batch.commit();
  return savedRecipes;
};

// Routes

// POST /api/generate-recipes
app.post('/api/generate-recipes', async (req, res) => {
  try {
    // Check if OpenAI is available
    if (!openai) {
      return res.status(503).json({ 
        error: 'Recipe generation service unavailable',
        details: 'OPENAI_API_KEY not configured'
      });
    }

    const { uid, strictOnly = true, preferenceText = '' } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Read inventory
    const inventoryRef = db.collection('users').doc(uid).collection('inventory');
    const inventorySnapshot = await inventoryRef
      .where('quantity', '>', 0)
      .get();

    if (inventorySnapshot.empty) {
      return res.status(400).json({ error: 'No inventory items found' });
    }

    const inventoryItems = inventorySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Build prompt
    const prompt = buildPrompt(inventoryItems, strictOnly, preferenceText);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7
    });

    const responseText = completion.choices[0].message.content;

    // Parse JSON
    let recipes;
    try {
      recipes = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(500).json({
        error: 'Failed to parse AI response',
        details: 'Invalid JSON format from AI'
      });
    }

    // Validate recipes
    if (!Array.isArray(recipes) || recipes.length !== 3) {
      return res.status(500).json({
        error: 'Invalid recipe format',
        details: 'Expected array of 3 recipes'
      });
    }

    // Validate each recipe
    for (const recipe of recipes) {
      if (!validateRecipe(recipe, inventoryItems, strictOnly)) {
        return res.status(500).json({
          error: 'Recipe validation failed',
          details: 'Recipe contains invalid or unavailable ingredients'
        });
      }
    }

    // Save recipes
    const savedRecipes = await saveRecipes(uid, recipes);

    res.json({
      success: true,
      recipes: savedRecipes
    });

  } catch (error) {
    console.error('Generate recipes error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// POST /api/recipes/:recipeId/favourite
app.post('/api/recipes/:recipeId/favourite', async (req, res) => {
  try {
    const { recipeId } = req.params;
    const { uid, isFavourite } = req.body;

    if (!uid || typeof isFavourite !== 'boolean') {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    const recipeRef = db.collection('users').doc(uid).collection('recipes').doc(recipeId);

    const updateData = {
      isFavourite,
      favouritedAt: isFavourite ? admin.firestore.FieldValue.serverTimestamp() : null
    };

    await recipeRef.update(updateData);

    res.json({
      success: true,
      recipeId,
      isFavourite
    });

  } catch (error) {
    console.error('Toggle favourite error:', error);
    if (error.code === 5) { // NOT_FOUND
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// GET /api/favourites
app.get('/api/favourites', async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const recipesRef = db.collection('users').doc(uid).collection('recipes');
    const snapshot = await recipesRef
      .where('isFavourite', '==', true)
      .orderBy('favouritedAt', 'desc')
      .get();

    const favourites = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      favourites
    });

  } catch (error) {
    console.error('Get favourites error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// POST /search-products - Scrape multiple supermarkets to check product availability
app.post('/search-products', async (req, res) => {
  console.log('[search-products] Endpoint called');
  console.log('[search-products] Body:', req.body);
  console.log('[search-products] Environment:', process.env.NODE_ENV);

  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Missing query' });
    }

    console.log('[search-products] Calling scrapeAllStores...');
    const results = await scrapeAllStores(query.trim());
    console.log('[search-products] scrapeAllStores returned', results.length, 'results');

    return res.json({ results });
  } catch (err) {
    console.error('[search-products] Error:', err);
    return res.status(500).json({ error: 'Internal error', details: String(err) });
  }
});

// GET /stores - Get list of configured stores
app.get('/stores', (req, res) => {
  res.json({
    stores: STORES.map(store => ({
      storeName: store.storeName,
      storeCode: store.storeCode,
      baseSearchUrl: store.baseSearchUrl
    }))
  });
});

// POST /api/search-products - Proxy for n8n webhook to avoid CORS issues
app.post('/api/search-products', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://n8ngc.codeblazar.org/webhook/search-products';
    
    console.log('Proxying request to n8n:', n8nWebhookUrl);
    console.log('Query:', query);

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('N8N response:', data);
    
    res.json(data);
  } catch (error) {
    console.error('N8N proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to search products',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AIGeneratedRecipe, Ingredient } from '@/types';

// Generate recipes using Railway webhook
export const generateRecipes = async (
  userId: string,
  strictOnly: boolean,
  preferenceText: string
): Promise<AIGeneratedRecipe[]> => {
  // Replace with your actual Railway n8n webhook URL
  const WEBHOOK_URL = import.meta.env.VITE_RAILWAY_WEBHOOK_URL || 'https://your-railway-app.up.railway.app/webhook/generate-recipes';

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication if required
        // 'Authorization': `Bearer ${import.meta.env.VITE_WEBHOOK_TOKEN}`,
      },
      body: JSON.stringify({
        userId,
        strictOnly,
        preferenceText,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.recipes || [];
  } catch (error) {
    console.error('Webhook error:', error);
    throw new Error(`Failed to generate recipes: ${error.message}`);
  }
};

// Test webhook connectivity
export const testWebhookConnection = async (): Promise<boolean> => {
  const WEBHOOK_URL = import.meta.env.VITE_RAILWAY_WEBHOOK_URL || 'https://your-railway-app.up.railway.app/webhook/generate-recipes';

  try {
    const response = await fetch(WEBHOOK_URL.replace('/webhook/generate-recipes', '/webhook/test'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Webhook test failed:', error);
    return false;
  }
};
export const saveRecipes = async (
  userId: string,
  recipes: Omit<AIGeneratedRecipe, 'id' | 'isFavourite' | 'createdAt' | 'source'>[]
): Promise<AIGeneratedRecipe[]> => {
  const savedRecipes: AIGeneratedRecipe[] = [];

  for (const recipe of recipes) {
    // Check for duplicates based on name and ingredients
    const existingQuery = query(
      collection(db, 'users', userId, 'recipes'),
      where('name', '==', recipe.name),
      where('source', '==', 'ai')
    );

    const existingDocs = await getDocs(existingQuery);
    const isDuplicate = existingDocs.docs.some(doc => {
      const existingRecipe = doc.data() as AIGeneratedRecipe;
      
      // Normalize ingredients for comparison
      const normalizeIngredients = (ingredients: (string | Ingredient)[]) => 
        ingredients.map(ing => 
          typeof ing === 'string' ? ing : `${ing.quantity} ${ing.unit} ${ing.name}`
        ).sort();
      
      const existingNormalized = normalizeIngredients(existingRecipe.ingredients);
      const currentNormalized = normalizeIngredients(recipe.ingredients);
      
      return JSON.stringify(existingNormalized) === JSON.stringify(currentNormalized);
    });

    if (isDuplicate) {
      console.log(`Skipping duplicate recipe: ${recipe.name}`);
      continue;
    }

    // Save new recipe
    const recipeData: Omit<AIGeneratedRecipe, 'id'> = {
      ...recipe,
      isFavourite: false,
      createdAt: serverTimestamp() as any,
      source: 'ai'
    };

    const docRef = await addDoc(collection(db, 'users', userId, 'recipes'), recipeData);

    savedRecipes.push({
      id: docRef.id,
      ...recipeData
    });
  }

  return savedRecipes;
};

// Toggle favourite status
export const toggleFavourite = async (
  userId: string,
  recipeId: string,
  isFavourite: boolean
): Promise<void> => {
  const recipeRef = doc(db, 'users', userId, 'recipes', recipeId);

  await updateDoc(recipeRef, {
    isFavourite,
    favouritedAt: isFavourite ? serverTimestamp() : null
  });
};

// Fetch favourite recipes
export const fetchFavourites = async (userId: string): Promise<AIGeneratedRecipe[]> => {
  const q = query(
    collection(db, 'users', userId, 'recipes'),
    where('isFavourite', '==', true),
    orderBy('favouritedAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AIGeneratedRecipe))
    .filter(recipe =>
      recipe.name &&
      Array.isArray(recipe.ingredients) &&
      recipe.ingredients.every(ingredient => typeof ingredient === 'string')
    );
};

// Fetch all AI-generated recipes (for the main recipes page)
export const fetchAIGeneratedRecipes = async (userId: string): Promise<AIGeneratedRecipe[]> => {
  const q = query(
    collection(db, 'users', userId, 'recipes'),
    where('source', '==', 'ai'),
    orderBy('createdAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AIGeneratedRecipe))
    .filter(recipe =>
      recipe.name &&
      Array.isArray(recipe.ingredients) &&
      recipe.ingredients.every(ingredient => typeof ingredient === 'string')
    );
};

// Add a manual recipe directly to favorites
export const addManualRecipe = async (
  userId: string,
  recipe: Omit<AIGeneratedRecipe, 'id' | 'isFavourite' | 'createdAt' | 'source' | 'favouritedAt'>
): Promise<AIGeneratedRecipe> => {
  const recipeData: Omit<AIGeneratedRecipe, 'id'> = {
    ...recipe,
    isFavourite: true,
    createdAt: serverTimestamp() as any,
    source: 'manual',
    favouritedAt: serverTimestamp() as any
  };

  const docRef = await addDoc(collection(db, 'users', userId, 'recipes'), recipeData);

  return {
    id: docRef.id,
    ...recipeData
  };
};
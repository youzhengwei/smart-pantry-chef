import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AIGeneratedRecipe, Ingredient } from '@/types';

// Generate recipes using n8n webhook and retrieve from Firebase
export const generateRecipes = async (
  userId: string,
  strictOnly: boolean,
  preferenceText: string
): Promise<AIGeneratedRecipe[]> => {
  // Use the n8n webhook URL
  const WEBHOOK_URL = 'https://n8ngc.codeblazar.org/webhook/generate-recipes';

  try {
    // Call the webhook to trigger recipe generation
    console.log('Triggering recipe generation webhook...');
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        strictOnly,
        preference: preferenceText, // Note: using 'preference' as per your spec
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const webhookData = await response.json();
    console.log('Webhook response:', webhookData);

    // Give the n8n workflow time to process and save to Firebase
    // Processing takes approximately 40 seconds
    await new Promise(resolve => setTimeout(resolve, 40000));

    // Fetch the generated recipes from Firebase
    const generatedRecipes = await fetchAIGeneratedRecipes(userId);
    
    return generatedRecipes;
  } catch (error) {
    console.error('Recipe generation error:', error);
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

    // Save new recipe into root 'recipes' collection with userId field
    const recipeData: Omit<AIGeneratedRecipe, 'id'> = {
      ...recipe,
      userId,
      isFavourite: false,
      createdAt: serverTimestamp() as any,
      source: 'ai'
    };

    const docRef = await addDoc(collection(db, 'recipes'), recipeData);

    savedRecipes.push({
      id: docRef.id,
      ...recipeData
    });
  }

  return savedRecipes;
};

// Toggle favourite status by managing savedRecipes collection
export const toggleFavourite = async (
  userId: string,
  recipeId: string,
  isFavourite: boolean
): Promise<void> => {
  if (isFavourite) {
    // Add to savedRecipes
    try {
      // Check if already saved
      const q = query(
        collection(db, 'savedRecipes'),
        where('userId', '==', userId),
        where('recipeId', '==', recipeId)
      );
      const existing = await getDocs(q);
      
      if (existing.empty) {
        // Save the recipe
        await addDoc(collection(db, 'savedRecipes'), {
          userId,
          recipeId,
          savedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error saving recipe:', error);
      throw error;
    }
  } else {
    // Remove from savedRecipes
    try {
      const q = query(
        collection(db, 'savedRecipes'),
        where('userId', '==', userId),
        where('recipeId', '==', recipeId)
      );
      const docs = await getDocs(q);
      
      for (const doc of docs.docs) {
        await deleteDoc(doc.ref);
      }
    } catch (error) {
      console.error('Error removing recipe from favorites:', error);
      throw error;
    }
  }
};

// Fetch saved recipes from savedRecipes collection with full recipe data
export const fetchSavedRecipes = async (userId: string): Promise<AIGeneratedRecipe[]> => {
  try {
    // First get all savedRecipe references
    const q = query(
      collection(db, 'savedRecipes'),
      where('userId', '==', userId)
    );

    const savedRecipesSnapshot = await getDocs(q);
    const recipes: AIGeneratedRecipe[] = [];

    // Fetch the actual recipe data for each saved recipe
    for (const savedRecipeDoc of savedRecipesSnapshot.docs) {
      const savedRecipe = savedRecipeDoc.data();
      const recipeId = savedRecipe.recipeId;

      try {
        // Get the recipe from the recipes collection
        const recipeDocRef = doc(db, 'recipes', recipeId);
        const recipeDoc = await getDoc(recipeDocRef);

        if (recipeDoc.exists()) {
          const recipeData = recipeDoc.data();
          recipes.push({
            id: recipeDoc.id,
            ...recipeData
          } as AIGeneratedRecipe);
        }
      } catch (error) {
        console.error(`Error fetching recipe ${recipeId}:`, error);
      }
    }

    // Sort by createdAt timestamp (descending)
    recipes.sort((a, b) => {
      const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toDate().getTime() : 0;
      const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toDate().getTime() : 0;
      return dateB - dateA;
    });

    return recipes;
  } catch (error) {
    console.error('Error in fetchSavedRecipes:', error);
    throw error;
  }
};

// Fetch favourite recipes
export const fetchFavourites = async (userId: string): Promise<AIGeneratedRecipe[]> => {
  try {
    const q = query(
      collection(db, 'recipes'),
      where('userId', '==', userId),
      where('isFavourite', '==', true)
    );

    const querySnapshot = await getDocs(q);
    const recipes = querySnapshot.docs
      .map(doc => {
        try {
          return {
            id: doc.id,
            ...doc.data()
          } as AIGeneratedRecipe;
        } catch (e) {
          console.error('Error mapping recipe:', e, doc.data());
          return null;
        }
      })
      .filter((recipe): recipe is AIGeneratedRecipe => {
        if (!recipe) return false;
        // Be lenient with the filter - just check if name exists
        if (!recipe.name) return false;
        // ingredients can be strings or objects
        if (!Array.isArray(recipe.ingredients)) return false;
        return true;
      });
    
    // Sort by favouritedAt in code (descending)
    recipes.sort((a, b) => {
      const dateA = a.favouritedAt instanceof Timestamp ? a.favouritedAt.toDate().getTime() : 0;
      const dateB = b.favouritedAt instanceof Timestamp ? b.favouritedAt.toDate().getTime() : 0;
      return dateB - dateA;
    });
    
    return recipes;
  } catch (error) {
    console.error('Error in fetchFavourites:', error);
    throw error;
  }
};

// Fetch all AI-generated recipes (for the main recipes page)
export const fetchAIGeneratedRecipes = async (userId: string): Promise<AIGeneratedRecipe[]> => {
  try {
    const q = query(
      collection(db, 'recipes'),
      where('userId', '==', userId),
      where('source', '==', 'ai')
    );

    const querySnapshot = await getDocs(q);
    const recipes = querySnapshot.docs
      .map(doc => {
        try {
          return {
            id: doc.id,
            ...doc.data()
          } as AIGeneratedRecipe;
        } catch (e) {
          console.error('Error mapping recipe:', e, doc.data());
          return null;
        }
      })
      .filter((recipe): recipe is AIGeneratedRecipe => {
        if (!recipe) return false;
        // Be lenient with the filter - just check if name exists
        if (!recipe.name) return false;
        // ingredients can be strings or objects
        if (!Array.isArray(recipe.ingredients)) return false;
        return true;
      });
    
    // Sort by createdAt in code (descending)
    recipes.sort((a, b) => {
      const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toDate().getTime() : 0;
      const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toDate().getTime() : 0;
      return dateB - dateA;
    });
    
    return recipes;
  } catch (error) {
    console.error('Error in fetchAIGeneratedRecipes:', error);
    throw error;
  }
};

// Add a manual recipe directly to favorites
export const addManualRecipe = async (
  userId: string,
  recipe: Omit<AIGeneratedRecipe, 'id' | 'isFavourite' | 'createdAt' | 'source' | 'favouritedAt'>
): Promise<AIGeneratedRecipe> => {
  const now = Timestamp.now();
  const recipeData: any = {
    ...recipe,
    userId,
    isFavourite: true,
    createdAt: now,
    source: 'manual',
    favouritedAt: now
  };

  // Add recipe to recipes collection
  const docRef = await addDoc(collection(db, 'recipes'), recipeData);
  
  // Also add to savedRecipes collection for consistency
  await addDoc(collection(db, 'savedRecipes'), {
    userId,
    recipeId: docRef.id,
    savedAt: now
  });

  return {
    id: docRef.id,
    ...recipeData
  };
};
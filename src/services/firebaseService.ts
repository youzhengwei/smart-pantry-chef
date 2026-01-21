import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  InventoryItem, 
  Recipe, 
  RecipeAI, 
  SavedRecipe, 
  Store, 
  StoreProduct,
  RecipeWithScore,
  StoreProductWithStore 
} from '@/types';

// Helper to calculate status based on expiry date
export const calculateStatus = (expiryDate: Date | Timestamp): 'fresh' | 'expiringSoon' | 'almostExpired' => {
  const now = new Date();
  const expiry = expiryDate instanceof Timestamp ? expiryDate.toDate() : expiryDate;
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry <= 2) return 'almostExpired';
  if (daysUntilExpiry <= 5) return 'expiringSoon';
  return 'fresh';
};

// Helper to check if low stock
export const isLowStock = (quantity: number, threshold: number): boolean => {
  return quantity <= threshold;
};

// ============ INVENTORY OPERATIONS ============

export const getInventory = async (userId: string): Promise<InventoryItem[]> => {
  const q = query(
    collection(db, 'inventory'),
    where('userId', '==', userId),
    orderBy('expiryDate', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as InventoryItem));
};

export const addInventoryItem = async (item: Omit<InventoryItem, 'id' | 'status' | 'isLowStock'>): Promise<string> => {
  const status = calculateStatus(item.expiryDate);
  const lowStock = isLowStock(item.quantity, item.reorderThreshold);
  
  const docRef = await addDoc(collection(db, 'inventory'), {
    ...item,
    status,
    isLowStock: lowStock
  });
  
  return docRef.id;
};

export const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>): Promise<void> => {
  const docRef = doc(db, 'inventory', id);
  
  // Recalculate status and isLowStock if relevant fields changed
  const updateData: Partial<InventoryItem> = { ...updates };
  
  if (updates.expiryDate) {
    updateData.status = calculateStatus(updates.expiryDate);
  }
  
  if (updates.quantity !== undefined || updates.reorderThreshold !== undefined) {
    const currentDoc = await getDoc(docRef);
    const current = currentDoc.data() as InventoryItem;
    const quantity = updates.quantity ?? current.quantity;
    const threshold = updates.reorderThreshold ?? current.reorderThreshold;
    updateData.isLowStock = isLowStock(quantity, threshold);
  }
  
  await updateDoc(docRef, updateData);
};

export const deleteInventoryItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'inventory', id));
};

// ============ PRODUCT OPERATIONS ============

export const getProducts = async (userId: string): Promise<any[]> => {
  // Fetch products created by the user
  const q1 = query(collection(db, 'products'), where('createdBy', '==', userId));
  const snap1 = await getDocs(q1);

  // Fetch generic manual products (source == 'manual')
  const q2 = query(collection(db, 'products'), where('source', '==', 'manual'));
  const snap2 = await getDocs(q2);

  const map = new Map<string, any>();
  snap1.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  snap2.docs.forEach(d => { if (!map.has(d.id)) map.set(d.id, { id: d.id, ...d.data() }); });

  return Array.from(map.values());
};

export const createProduct = async (product: { name: string; brand?: string; category: string; barcode?: string; defaultShelfLifeDays?: number; source?: string; createdBy?: string; }): Promise<string> => {
  const data: any = {
    name: product.name,
  };
  if (product.brand !== undefined) data.brand = product.brand;
  if (product.category !== undefined) data.category = product.category;
  if (product.barcode !== undefined) data.barcode = product.barcode;
  if (typeof product.defaultShelfLifeDays === 'number' && !isNaN(product.defaultShelfLifeDays)) {
    data.defaultShelfLifeDays = product.defaultShelfLifeDays;
  }
  data.source = product.source || 'manual';
  data.createdBy = product.createdBy || 'system';
  data.createdAt = Timestamp.now();

  const docRef = await addDoc(collection(db, 'products'), data);
  return docRef.id;
};

// ============ RECIPE OPERATIONS ============

export const getRecipes = async (): Promise<Recipe[]> => {
  const snapshot = await getDocs(collection(db, 'recipes'));
  return snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Recipe))
    .filter(recipe =>
      recipe.name &&
      Array.isArray(recipe.ingredients) &&
      recipe.ingredients.every(ingredient => typeof ingredient === 'string')
    );
};

export const getRecipeAI = async (recipeId: string): Promise<RecipeAI | null> => {
  const q = query(
    collection(db, 'recipeAi'),
    where('recipeId', '==', recipeId)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data()
  } as RecipeAI;
};

export const getRecommendedRecipes = async (userId: string): Promise<RecipeWithScore[]> => {
  // Get user's inventory
  const inventory = await getInventory(userId);
  const inventoryNames = inventory.map(item => item.name.toLowerCase());
  const expiringItems = inventory
    .filter(item => item.status !== 'fresh')
    .map(item => item.name.toLowerCase());
  
  // Get user's recipes only (filter by userId)
  const q = query(collection(db, 'recipes'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  console.log(`[getRecommendedRecipes] Found ${snapshot.docs.length} recipes for userId: ${userId}`);
  const recipes = snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Recipe))
    .filter(recipe =>
      recipe.name &&
      Array.isArray(recipe.ingredients) &&
      recipe.ingredients.length > 0
    );
  console.log(`[getRecommendedRecipes] After filtering: ${recipes.length} recipes with ingredients`);
  
  // Score each recipe
  const scoredRecipes: RecipeWithScore[] = [];
  
  for (const recipe of recipes) {
    let score = 0;
    const matchedIngredients: string[] = [];
    const expiringIngredients: string[] = [];
    const missingIngredients: string[] = [];
    
    for (const ingredient of recipe.ingredients) {
      // Handle both string and object ingredients
      const ingredientName = typeof ingredient === 'string' ? ingredient : ingredient?.name;
      
      if (!ingredientName) {
        console.warn('Skipping ingredient with no name:', ingredient);
        continue;
      }

      const ingredientLower = ingredientName.toLowerCase();
      const isInInventory = inventoryNames.some(name => 
        ingredientLower.includes(name) || name.includes(ingredientLower)
      );
      const isExpiring = expiringItems.some(name => 
        ingredientLower.includes(name) || name.includes(ingredientLower)
      );
      
      if (isExpiring) {
        score += 2;
        expiringIngredients.push(ingredientName);
        matchedIngredients.push(ingredientName);
      } else if (isInInventory) {
        score += 1;
        matchedIngredients.push(ingredientName);
      } else {
        score -= 1;
        missingIngredients.push(ingredientName);
      }
    }
    
    // Only include recipes with 1 or fewer missing ingredients
    if (missingIngredients.length <= 1) {
      const aiData = await getRecipeAI(recipe.id!);
      scoredRecipes.push({
        ...recipe,
        score,
        matchedIngredients,
        expiringIngredients,
        missingIngredients,
        aiData: aiData || undefined
      });
    }
  }
  
  // Sort by score descending
  console.log(`[getRecommendedRecipes] Returning ${scoredRecipes.length} scored recipes`);
  return scoredRecipes.sort((a, b) => b.score - a.score);
};

// ============ SAVED RECIPES ============

export const getSavedRecipes = async (userId: string): Promise<SavedRecipe[]> => {
  const q = query(
    collection(db, 'savedRecipes'),
    where('userId', '==', userId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SavedRecipe));
};

export const saveRecipe = async (userId: string, recipeId: string): Promise<string> => {
  const docRef = await addDoc(collection(db, 'savedRecipes'), {
    userId,
    recipeId,
    savedAt: Timestamp.now()
  });
  return docRef.id;
};

export const unsaveRecipe = async (savedRecipeId: string): Promise<void> => {
  await deleteDoc(doc(db, 'savedRecipes', savedRecipeId));
};

// ============ STORE OPERATIONS ============

export const getStores = async (): Promise<Store[]> => {
  const snapshot = await getDocs(collection(db, 'stores'));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Store));
};

export const getStoresByArea = async (area: string): Promise<Store[]> => {
  const q = query(
    collection(db, 'stores'),
    where('area', '==', area)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Store));
};

export const getStoreProducts = async (storeId: string): Promise<StoreProduct[]> => {
  const q = query(
    collection(db, 'storeProducts'),
    where('storeId', '==', storeId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as StoreProduct));
};

// Get smart suggestions for shopping items
export const getSmartSuggestions = async (
  ingredients: string[],
  area: string
): Promise<{ [ingredient: string]: StoreProductWithStore[] }> => {
  const stores = await getStoresByArea(area);
  if (stores.length === 0) return {};
  
  const storeMap = new Map(stores.map(s => [s.id!, s]));
  const suggestions: { [ingredient: string]: StoreProductWithStore[] } = {};
  
  for (const ingredient of ingredients) {
    const allMatches: StoreProductWithStore[] = [];
    
    for (const storeId of Array.from(storeMap.keys())) {
      const products = await getStoreProducts(storeId);
      
      products.forEach(product => {
        const ingredientLower = ingredient.toLowerCase();
        const productNameLower = product.productName.toLowerCase();
        const categoryLower = product.category.toLowerCase();
        
        // Match if ingredient is in product name, category, or keywords
        const isMatch = 
          productNameLower.includes(ingredientLower) ||
          ingredientLower.includes(productNameLower) ||
          product.keywords.some(kw => 
            ingredientLower.includes(kw.toLowerCase()) || 
            kw.toLowerCase().includes(ingredientLower)
          ) ||
          (categoryLower.includes('vegetable') && ingredientLower.includes('vegetable')) ||
          (categoryLower.includes('dairy') && ingredientLower.includes('dairy')) ||
          (categoryLower.includes('meat') && ingredientLower.includes('meat')) ||
          (categoryLower.includes('fruit') && ingredientLower.includes('fruit'));
        
        if (isMatch && product.inStock) {
          allMatches.push({
            ...product,
            store: storeMap.get(storeId)!
          });
        }
      });
    }
    
    // Sort by price (cheapest first)
    allMatches.sort((a, b) => a.price - b.price);
    
    if (allMatches.length > 0) {
      suggestions[ingredient] = allMatches.slice(0, 3); // Top 3 suggestions
    }
  }
  
  return suggestions;
};

export const searchStoreProducts = async (
  area: string, 
  keywords: string[]
): Promise<StoreProductWithStore[]> => {
  // Get stores in area
  const stores = await getStoresByArea(area);
  if (stores.length === 0) return [];
  
  const storeIds = stores.map(s => s.id!);
  const storeMap = new Map(stores.map(s => [s.id!, s]));
  
  // Get all products from these stores
  const results: StoreProductWithStore[] = [];
  
  for (const storeId of storeIds) {
    const products = await getStoreProducts(storeId);
    
    for (const product of products) {
      // Check if product matches any keyword
      const matchesKeyword = keywords.some(kw => {
        const kwLower = kw.toLowerCase();
        return product.productName.toLowerCase().includes(kwLower) ||
               product.keywords.some(pk => pk.toLowerCase().includes(kwLower)) ||
               product.category.toLowerCase().includes(kwLower);
      });
      
      if (matchesKeyword) {
        results.push({
          ...product,
          store: storeMap.get(storeId)!
        });
      }
    }
  }
  
  // Sort by price ascending
  return results.sort((a, b) => a.price - b.price);
};

// ============ AI INTEGRATION PLACEHOLDERS ============

/**
 * Placeholder for AI-powered search text parsing
 * Will be connected to n8n/AI service later
 * Converts natural language like "cheap eggs near Woodlands" 
 * to structured filters
 */
export const parseSearchText = (searchString: string): { item: string; area: string } => {
  // TODO: Connect to n8n webhook for AI parsing
  // For now, simple keyword extraction
  const words = searchString.toLowerCase().split(' ');
  const areaKeywords = ['woodlands', 'yishun', 'tampines', 'jurong', 'bedok', 'northpoint'];
  
  let area = '';
  let item = '';
  
  for (const word of words) {
    if (areaKeywords.some(a => word.includes(a))) {
      area = word.charAt(0).toUpperCase() + word.slice(1);
    }
  }
  
  // Remove common words and area to get item
  const ignoreWords = ['cheap', 'near', 'in', 'at', 'find', 'search', 'buy', ...areaKeywords];
  const itemWords = words.filter(w => !ignoreWords.includes(w) && w.length > 2);
  item = itemWords.join(' ');
  
  return { item, area };
};

/**
 * Placeholder for barcode scanning integration
 * Will be connected to OpenFoodFacts API
 */
export const lookupBarcode = async (barcode: string): Promise<Partial<InventoryItem> | null> => {
  // TODO: Connect to OpenFoodFacts API
  // For now, return null to indicate manual entry needed
  console.log('Barcode lookup placeholder:', barcode);
  return null;
};

// ============ SEED DATA ============

export const seedSampleData = async (userId: string): Promise<void> => {
  const batch = writeBatch(db);
  
  // Sample products
  const products = [
    { name: 'Eggs', brand: 'Farm Fresh', category: 'Dairy', barcode: '1234567890', defaultShelfLifeDays: 21 },
    { name: 'Milk', brand: 'Meiji', category: 'Dairy', barcode: '1234567891', defaultShelfLifeDays: 7 },
    { name: 'Broccoli', brand: '', category: 'Vegetables', barcode: '1234567892', defaultShelfLifeDays: 5 }
  ];
  
  for (const product of products) {
    const ref = doc(collection(db, 'products'));
    batch.set(ref, product);
  }
  
  // Sample inventory items
  const now = new Date();
  const inventoryItems = [
    {
      userId,
      name: 'Eggs',
      category: 'Dairy',
      quantity: 6,
      quantityUnit: 'pcs',
      expiryDate: Timestamp.fromDate(new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)),
      storage: 'fridge',
      reorderThreshold: 4,
      isLowStock: false,
      status: 'fresh'
    },
    {
      userId,
      name: 'Milk',
      category: 'Dairy',
      quantity: 1,
      quantityUnit: 'L',
      expiryDate: Timestamp.fromDate(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)),
      storage: 'fridge',
      reorderThreshold: 2,
      isLowStock: true,
      status: 'expiringSoon'
    },
    {
      userId,
      name: 'Broccoli',
      category: 'Vegetables',
      quantity: 2,
      quantityUnit: 'pcs',
      expiryDate: Timestamp.fromDate(new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)),
      storage: 'fridge',
      reorderThreshold: 1,
      isLowStock: false,
      status: 'almostExpired'
    }
  ];
  
  for (const item of inventoryItems) {
    const ref = doc(collection(db, 'inventory'));
    batch.set(ref, item);
  }
  
  // Sample recipes
  const recipesData = [
    { name: 'Broccoli Egg Bake', ingredients: ['Eggs', 'Broccoli', 'Cheese'], tags: ['breakfast', 'healthy'] },
    { name: 'French Toast', ingredients: ['Eggs', 'Bread', 'Milk', 'Cinnamon'], tags: ['breakfast', 'sweet'] }
  ];
  
  const recipeRefs: string[] = [];
  for (const recipe of recipesData) {
    const ref = doc(collection(db, 'recipes'));
    batch.set(ref, recipe);
    recipeRefs.push(ref.id);
  }
  
  // Sample recipe AI data
  const recipeAiData = [
    {
      recipeId: recipeRefs[0],
      description: 'A nutritious and delicious baked dish combining fresh broccoli with fluffy eggs.',
      steps: [
        'Preheat oven to 180°C',
        'Steam broccoli for 3 minutes until slightly tender',
        'Beat eggs with salt and pepper',
        'Arrange broccoli in a baking dish',
        'Pour eggs over broccoli and top with cheese',
        'Bake for 20 minutes until golden'
      ]
    },
    {
      recipeId: recipeRefs[1],
      description: 'Classic French toast with a hint of cinnamon - perfect for a weekend breakfast.',
      steps: [
        'Whisk eggs, milk, and cinnamon together',
        'Dip bread slices into the mixture',
        'Heat butter in a pan over medium heat',
        'Cook each side for 2-3 minutes until golden',
        'Serve with maple syrup or fresh fruits'
      ]
    }
  ];
  
  for (const ai of recipeAiData) {
    const ref = doc(collection(db, 'recipeAi'));
    batch.set(ref, ai);
  }
  
  // Sample stores
  const stores = [
    { name: 'Sheng Siong Woodlands', address: '123 Woodlands Ave 1', area: 'Woodlands', latitude: 1.4382, longitude: 103.7891 },
    { name: 'NTUC Northpoint', address: '456 Yishun Central', area: 'Yishun', latitude: 1.4294, longitude: 103.8353 }
  ];
  
  const storeRefs: string[] = [];
  for (const store of stores) {
    const ref = doc(collection(db, 'stores'));
    batch.set(ref, store);
    storeRefs.push(ref.id);
  }
  
  // Sample store products
  const storeProducts = [
    { storeId: storeRefs[0], productName: 'Farm Fresh Eggs (10pcs)', price: 2.95, inStock: true, category: 'Dairy', keywords: ['eggs', 'fresh', 'farm'], lastUpdated: Timestamp.now() },
    { storeId: storeRefs[0], productName: 'Meiji Milk 1L', price: 3.20, inStock: true, category: 'Dairy', keywords: ['milk', 'fresh', 'meiji'], lastUpdated: Timestamp.now() },
    { storeId: storeRefs[0], productName: 'Broccoli 200g', price: 1.80, inStock: false, category: 'Vegetables', keywords: ['broccoli', 'vegetable', 'green'], lastUpdated: Timestamp.now() },
    { storeId: storeRefs[1], productName: 'Kampong Eggs (10pcs)', price: 3.50, inStock: true, category: 'Dairy', keywords: ['eggs', 'kampong', 'organic'], lastUpdated: Timestamp.now() },
    { storeId: storeRefs[1], productName: 'Farmhouse Milk 1L', price: 2.90, inStock: true, category: 'Dairy', keywords: ['milk', 'fresh', 'farmhouse'], lastUpdated: Timestamp.now() },
    { storeId: storeRefs[1], productName: 'Broccoli 250g', price: 2.20, inStock: true, category: 'Vegetables', keywords: ['broccoli', 'vegetable', 'green'], lastUpdated: Timestamp.now() }
  ];
  
  for (const product of storeProducts) {
    const ref = doc(collection(db, 'storeProducts'));
    batch.set(ref, product);
  }
  
  await batch.commit();
};

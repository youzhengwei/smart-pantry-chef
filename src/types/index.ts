import { Timestamp } from 'firebase/firestore';

export interface UserData {
  uid: string;
  name: string;
  email: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Product {
  id?: string;
  name: string;
  brand?: string;
  category: string;
  barcode?: string;
  defaultShelfLifeDays?: number;
  source?: 'manual' | 'openfoodfacts' | 'system';
  createdBy?: string; // uid or "system"
  createdAt?: Timestamp;
}

export interface InventoryItem {
  id?: string;
  userId: string;
  productId?: string;
  name: string;
  category: string;
  quantity: number;
  quantityUnit: string;
  expiryDate: Timestamp | Date;
  storage: 'fridge' | 'freezer' | 'pantry';
  reorderThreshold: number;
  isLowStock: boolean;
  status: 'fresh' | 'expiringSoon' | 'almostExpired';
  // New fields for AI integration
  source: 'manual' | 'ai' | 'openfoodfacts' | 'system';  // Track origin
  imageUrl?: string;  // Firebase Storage download URL from the upload
  aiConfidence?: number;  // AI confidence score (0-1), optional
  batchId?: string;  // UUID or timestamp for grouping items from one photo
  createdAt?: Timestamp;  // Add if not present, for sorting/filtering
}

export interface Recipe {
  id?: string;
  name: string;
  ingredients: string[];
  tags: string[];
  baseScore?: number;
}

export interface RecipeAI {
  id?: string;
  recipeId: string;
  description: string;
  steps: string[];
}

export interface Ingredient {
  name: string;
  quantity: string | number;
  unit: string;
  imageUrl?: string;
}

export interface Instruction {
  text: string;
  step: string | number;
}

export interface AIGeneratedRecipe {
  id?: string;
  name: string;
  ingredients: (string | Ingredient)[];
  instructions: (string | Instruction)[];
  cookingTime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  servingSize?: string;  // Optional descriptive serving size, e.g., "4 people" or "serves 4"
  isFavourite: boolean;
  createdAt: Timestamp;
  source: string;
  favouritedAt?: Timestamp | null;
}

export interface SavedRecipe {
  id?: string;
  userId: string;
  recipeId: string;
  savedAt: Timestamp;
}

export interface Store {
  id?: string;
  name: string;
  address: string;
  area: string;
  latitude: number;
  longitude: number;
}

export interface StoreProduct {
  id?: string;
  storeId: string;
  productName: string;
  price: number;
  inStock: boolean;
  category: string;
  keywords: string[];
  lastUpdated: Timestamp;
}

// Extended types for UI
export interface RecipeWithScore extends Recipe {
  score: number;
  matchedIngredients: string[];
  expiringIngredients: string[];
  missingIngredients: string[];
  aiData?: RecipeAI;
  // Add fields from AIGeneratedRecipe for recommended recipes
  instructions?: (string | Instruction)[];
  // Allow object ingredients from AI-generated recipes
  ingredients?: (string | Ingredient)[];
  cookingTime?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings?: number;
  imageUrl?: string;
  isFavourite?: boolean;
  createdAt?: Timestamp;
  source?: string;
}

export interface StoreProductWithStore extends StoreProduct {
  store: Store;
}

export interface NearbyStore {
  displayName: {
    text: string;
    languageCode?: string;
  };
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  currentOpeningHours?: {
    openNow?: boolean;
  };
}

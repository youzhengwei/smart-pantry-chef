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

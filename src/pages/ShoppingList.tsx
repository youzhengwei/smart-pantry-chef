import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getRecommendedRecipes, getSavedRecipes, getInventory, getSmartSuggestions } from '@/services/firebaseService';
import { fetchAIGeneratedRecipes } from '@/services/aiRecipeService';
import { RecipeWithScore, AIGeneratedRecipe, InventoryItem, StoreProductWithStore } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ShoppingCart,
  Loader2,
  Check,
  Trash2,
  ChefHat,
  AlertCircle,
  Download,
  Copy,
  Lightbulb,
  TrendingDown,
  Edit2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShoppingItem {
  ingredient: string;
  recipes: string[]; // which recipes need this
  hasInInventory: boolean;
  inventoryQuantity?: string;
  quantity: number; // editable quantity for estimates
  checked: boolean;
  isEditing?: boolean;
  editValue?: string;
}

interface SelectedRecipe {
  id: string;
  name: string;
  type: 'ai' | 'regular';
  ingredients: string[];
}

const ShoppingList: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [regularRecipes, setRegularRecipes] = useState<RecipeWithScore[]>([]);
  const [aiRecipes, setAiRecipes] = useState<AIGeneratedRecipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipes, setSelectedRecipes] = useState<SelectedRecipe[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<{ [ingredient: string]: StoreProductWithStore[] }>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedItemForSuggestion, setSelectedItemForSuggestion] = useState<string | null>(null);
  const [pricingMode, setPricingMode] = useState<'cheapest' | 'best-store'>('cheapest');
  const [estimating, setEstimating] = useState(false);
  
  // Create API functions for bot to manipulate shopping list
  const shoppingListApi = {
    removeItem: (ingredient: string) => {
      console.log(`Bot requested to remove: ${ingredient}`);
      removeItem(ingredient);
    },
    addItem: (ingredient: string) => {
      console.log(`Bot requested to add: ${ingredient}`);
      setShoppingItems(prev => [...prev, {
        ingredient: ingredient.trim(),
        recipes: [],
        hasInInventory: false,
        quantity: 1,
        checked: false
      }]);
    },


    updateItem: (ingredient: string, newIngredient: string) => {
      console.log(`Bot requested to update: ${ingredient} -> ${newIngredient}`);
      setShoppingItems(prev =>
        prev.map(item =>
          item.ingredient === ingredient
            ? { ...item, ingredient: newIngredient.trim() }
            : item
        )
      );
    },
    clearList: () => {
      console.log('Bot requested to clear list');
      clearList();
    },
    getList: () => {
      return shoppingItems.map(item => ({
        ingredient: item.ingredient,
        recipes: item.recipes,
        hasInInventory: item.hasInInventory,
        quantity: item.quantity,
        checked: item.checked
      }));
    }
  };

  /* Botpress integration removed — webchat initialization omitted. */

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [recipes, aiRecipesData, inventoryData] = await Promise.all([
        getRecommendedRecipes(user.uid),
        fetchAIGeneratedRecipes(user.uid),
        getInventory(user.uid)
      ]);
      setRegularRecipes(recipes);
      setAiRecipes(aiRecipesData);
      setInventory(inventoryData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipeSelection = (recipe: RecipeWithScore | AIGeneratedRecipe, type: 'ai' | 'regular') => {
    const recipeId = recipe.id || `${type}-${recipe.name}`;
    const ingredients = recipe.ingredients.map(ing =>
      typeof ing === 'string' ? ing : ing.name
    );

    setSelectedRecipes(prev => {
      const isSelected = prev.find(r => r.id === recipeId);
      if (isSelected) {
        return prev.filter(r => r.id !== recipeId);
      } else {
        return [...prev, {
          id: recipeId,
          name: recipe.name,
          type,
          ingredients
        }];
      }
    });
  };

  const generateShoppingList = async () => {
    if (selectedRecipes.length === 0) {
      toast({
        title: 'No recipes selected',
        description: 'Select at least one recipe to generate a shopping list.',
        variant: 'destructive',
      });
      return;
    }

    // Aggregate all ingredients
    const ingredientMap = new Map<string, Set<string>>();

    selectedRecipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        const normalized = ingredient.toLowerCase().trim();
        if (!ingredientMap.has(normalized)) {
          ingredientMap.set(normalized, new Set());
        }
        ingredientMap.get(normalized)!.add(recipe.name);
      });
    });

    // Convert to shopping items
    const items: ShoppingItem[] = Array.from(ingredientMap.entries()).map(([ingredient, recipes]) => {
      const inventoryItem = inventory.find(item =>
        item.name.toLowerCase().includes(ingredient) ||
        ingredient.includes(item.name.toLowerCase())
      );

      return {
        ingredient,
        recipes: Array.from(recipes),
        hasInInventory: !!inventoryItem,
        inventoryQuantity: inventoryItem ? `${inventoryItem.quantity} ${inventoryItem.quantityUnit}` : undefined,
        quantity: 1,
        checked: false
      };
    });

    // Sort: missing items first, then by recipe count
    items.sort((a, b) => {
      if (a.hasInInventory !== b.hasInInventory) {
        return a.hasInInventory ? 1 : -1; // Missing items first
      }
      return b.recipes.length - a.recipes.length;
    });

    setShoppingItems(items);
    setSuggestions({});
    setSelectedItemForSuggestion(null);
    
    // Load smart suggestions
    try {
      setLoadingSuggestions(true);
      const missingIngredients = items.filter(item => !item.hasInInventory).map(item => item.ingredient);
      if (missingIngredients.length > 0) {
        const suggestionsData = await getSmartSuggestions(missingIngredients, 'Singapore');
        setSuggestions(suggestionsData);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }

    toast({
      title: 'Shopping list generated',
      description: `${items.length} items added to your shopping list.`,
    });
  };

  const toggleItemChecked = (ingredient: string) => {
    setShoppingItems(prev =>
      prev.map(item =>
        item.ingredient === ingredient ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const removeItem = (ingredient: string) => {
    setShoppingItems(prev => prev.filter(item => item.ingredient !== ingredient));
  };

  const startEditingItem = (ingredient: string) => {
    setShoppingItems(prev =>
      prev.map(item =>
        item.ingredient === ingredient 
          ? { ...item, isEditing: true, editValue: item.ingredient }
          : item
      )
    );
  };

  const saveEditedItem = (oldIngredient: string) => {
    setShoppingItems(prev =>
      prev.map(item => {
        if (item.ingredient === oldIngredient && item.editValue && item.editValue.trim()) {
          return {
            ...item,
            ingredient: item.editValue.trim(),
            isEditing: false,
            editValue: undefined
          };
        }
        return item;
      })
    );
  };

  const cancelEditingItem = (ingredient: string) => {
    setShoppingItems(prev =>
      prev.map(item =>
        item.ingredient === ingredient
          ? { ...item, isEditing: false, editValue: undefined }
          : item
      )
    );
  };

  const clearList = () => {
    setShoppingItems([]);
    setSelectedRecipes([]);
  };

  const downloadList = () => {
    const lines: string[] = [];

    // Header with estimated total (respect current pricing mode)
    if (pricedItemCount) {
      lines.push(`Estimated total (${pricingMode === 'best-store' && bestStoreInfo.store ? `store: ${bestStoreInfo.store.name}` : 'per-item cheapest'}): ${formatCurrency(estimatedTotal)}`);
    }

    for (const item of shoppingItems) {
      const qty = item.quantity || 1;
      const base = `${item.checked ? '✓' : '○'} ${item.ingredient}`;
      if (item.hasInInventory) {
        lines.push(`${base} — In inventory: ${item.inventoryQuantity}`);
        continue;
      }

      // try to resolve a price for the item according to mode
      let resolved: { unit?: number; total?: number; store?: string } | null = null;
      if (pricingMode === 'cheapest') {
        const bp = getBestPrice(item.ingredient);
        if (bp) resolved = { unit: bp, total: bp * qty };
      } else if (pricingMode === 'best-store' && bestStoreInfo.store) {
        const opts = suggestions[item.ingredient] ?? [];
        const match = opts.find(o => (o.store.id || o.store.name) === (bestStoreInfo.store.id || bestStoreInfo.store.name));
        const p = match ? Number(match.price || 0) : null;
        if (p) resolved = { unit: p, total: p * qty, store: bestStoreInfo.store.name };
      }

      if (resolved) {
        lines.push(`${base} x${qty} — ${formatCurrency(resolved.total)}${resolved.unit ? ` (${formatCurrency(resolved.unit)} each${resolved.store ? ' @ ' + resolved.store : ''})` : ''}`);
      } else {
        lines.push(`${base} x${qty} — NEED TO BUY`);
      }
    }

    const content = lines.join('\n');
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', 'shopping-list.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast({ title: 'Downloaded', description: 'Shopping list saved as shopping-list.txt' });
  };

  const copyToClipboard = () => {
    const lines: string[] = [];
    if (pricedItemCount) {
      lines.push(`Estimated total (${pricingMode === 'best-store' && bestStoreInfo.store ? `store: ${bestStoreInfo.store.name}` : 'per-item cheapest'}): ${formatCurrency(estimatedTotal)}`);
    }

    for (const item of shoppingItems) {
      const qty = item.quantity || 1;
      const base = `${item.checked ? '✓' : '•'} ${item.ingredient}`;
      if (item.hasInInventory) {
        lines.push(`${base} — In inventory: ${item.inventoryQuantity}`);
        continue;
      }

      let resolved: { unit?: number; total?: number; store?: string } | null = null;
      if (pricingMode === 'cheapest') {
        const bp = getBestPrice(item.ingredient);
        if (bp) resolved = { unit: bp, total: bp * qty };
      } else if (pricingMode === 'best-store' && bestStoreInfo.store) {
        const opts = suggestions[item.ingredient] ?? [];
        const match = opts.find(o => (o.store.id || o.store.name) === (bestStoreInfo.store.id || bestStoreInfo.store.name));
        const p = match ? Number(match.price || 0) : null;
        if (p) resolved = { unit: p, total: p * qty, store: bestStoreInfo.store.name };
      }

      if (resolved) {
        lines.push(`${base} x${qty} — ${formatCurrency(resolved.total)}${resolved.unit ? ` (${formatCurrency(resolved.unit)} each${resolved.store ? ' @ ' + resolved.store : ''})` : ''}`);
      } else {
        lines.push(`${base} x${qty}`);
      }
    }

    navigator.clipboard.writeText(lines.join('\n'));
    toast({ title: 'Copied', description: 'Shopping list copied to clipboard' });
  };

  // Send shopping list to remote webhook for price estimation
  const postEstimate = async () => {
    const apiUrl = '/api/estimate-price'; // server-side proxy (avoids CORS)
    if (shoppingItems.length === 0) {
      toast({ title: 'No items', description: 'Your shopping list is empty.', variant: 'destructive' });
      return;
    }

    setEstimating(true);
    try {
      const payload = {
        items: shoppingItems.map(i => ({
          ingredient: i.ingredient,
          quantity: i.quantity || 1,
          hasInInventory: i.hasInInventory,
          inventoryQuantity: i.inventoryQuantity || null,
          checked: i.checked
        })),
        pricingMode,
        estimatedTotal: pricedItemCount ? estimatedTotal : null,
        metadata: {
          source: 'smart-pantry-chef',
          timestamp: new Date().toISOString()
        }
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Proxy error: ${res.status} ${text}`);
      }

      const resp = await res.json().catch(() => null);
      // server returns { success: true, data }
      if (resp && resp.success) {
        toast({ title: 'Estimate requested', description: 'Estimator received the shopping list — check the estimator for results.' });
      } else {
        toast({ title: 'Estimate sent', description: 'Estimator returned an unexpected response.' });
      }

      console.log('postEstimate (proxy) response:', resp);
    } catch (err: any) {
      console.error('postEstimate failed', err);
      const isLikelyCORS = /Failed to fetch|NetworkError|CORS/.test(String(err.message || err));
      const message = isLikelyCORS
        ? 'Request blocked by the browser — make sure the dev server is running so the proxy endpoint is available.'
        : String(err.message || 'Unknown error');

      toast({ title: 'Estimate failed', description: message, variant: 'destructive' });
    } finally {
      setEstimating(false);
    }
  }; 

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredRegularRecipes = regularRecipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAiRecipes = aiRecipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const checkedCount = shoppingItems.filter(item => item.checked).length;
  const missingCount = shoppingItems.filter(item => !item.hasInInventory).length;

  // Pricing helpers (derived from `suggestions` and current `pricingMode`)
  const formatCurrency = (v: number) => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(v);
  const getBestPrice = (ingredient: string): number | null => {
    const opts = suggestions[ingredient];
    if (!opts || opts.length === 0) return null;
    const prices = opts.map(o => Number(o.price || 0)).filter(p => !isNaN(p) && p > 0);
    if (prices.length === 0) return null;
    return Math.min(...prices);
  };

  const cheapestLineTotals: number[] = shoppingItems
    .filter(i => !i.hasInInventory)
    .map(i => {
      const bp = getBestPrice(i.ingredient);
      return bp ? bp * (i.quantity || 1) : 0;
    })
    .filter(v => v > 0);

  const storeMap = new Map<string, { store: any; total: number; itemsPriced: number }>();
  for (const item of shoppingItems.filter(i => !i.hasInInventory)) {
    const opts = suggestions[item.ingredient] ?? [];
    const seenStores = new Set<string>();
    for (const o of opts) {
      const sid = o.store.id || o.store.name || 'unknown';
      const price = Number(o.price || 0);
      if (!sid || !price || isNaN(price) || price <= 0) continue;
      if (!storeMap.has(sid)) storeMap.set(sid, { store: o.store, total: 0, itemsPriced: 0 });
      const cur = storeMap.get(sid)!;
      cur.total += price * (item.quantity || 1);
      if (!seenStores.has(sid)) {
        cur.itemsPriced += 1;
        seenStores.add(sid);
      }
    }
  }

  let bestStoreInfo: { store?: any; total: number; itemsPriced: number } = { total: 0, itemsPriced: 0 };
  if (storeMap.size > 0) {
    const candidates = Array.from(storeMap.values());
    candidates.sort((a, b) => {
      if (b.itemsPriced !== a.itemsPriced) return b.itemsPriced - a.itemsPriced;
      return a.total - b.total;
    });
    bestStoreInfo = { store: candidates[0].store, total: candidates[0].total, itemsPriced: candidates[0].itemsPriced };
  }

  const estimatedTotal = pricingMode === 'best-store' ? bestStoreInfo.total : cheapestLineTotals.reduce((s, v) => s + v, 0);
  const pricedItemCount = pricingMode === 'best-store' ? bestStoreInfo.itemsPriced : cheapestLineTotals.length;



  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Shopping List
          </h1>
          <p className="text-muted-foreground">
            Select recipes and generate a shopping list for missing ingredients
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recipe Selection Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="magnet-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                Select Recipes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <Input
                placeholder="Search recipes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {/* Selected Count */}
              {selectedRecipes.length > 0 && (
                <div className="rounded-lg bg-primary/10 p-3 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {selectedRecipes.length} recipe{selectedRecipes.length !== 1 ? 's' : ''} selected
                  </p>
                  <Button
                    size="sm"
                    onClick={generateShoppingList}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Generate List
                  </Button>
                </div>
              )}

              {/* AI Generated Recipes */}
              {filteredAiRecipes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">AI Generated Recipes</h3>
                  <div className="space-y-2">
                    {filteredAiRecipes.map(recipe => {
                      const isSelected = selectedRecipes.some(r => r.id === recipe.id);
                      return (
                        <div
                          key={recipe.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                            isSelected ? "bg-primary/10 border-primary" : "hover:bg-accent"
                          )}
                          onClick={() => toggleRecipeSelection(recipe, 'ai')}
                        >
                          <Checkbox checked={isSelected} onChange={() => {}} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{recipe.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {recipe.ingredients.length} ingredients • {recipe.cookingTime}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            AI
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Regular Recipes */}
              {filteredRegularRecipes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Recommended Recipes</h3>
                  <div className="space-y-2">
                    {filteredRegularRecipes.map(recipe => {
                      const isSelected = selectedRecipes.some(r => r.id === recipe.id);
                      return (
                        <div
                          key={recipe.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                            isSelected ? "bg-primary/10 border-primary" : "hover:bg-accent"
                          )}
                          onClick={() => toggleRecipeSelection(recipe, 'regular')}
                        >
                          <Checkbox checked={isSelected} onChange={() => {}} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{recipe.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {recipe.ingredients.length} ingredients
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredRegularRecipes.length === 0 && filteredAiRecipes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No recipes found' : 'No recipes available'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Shopping List Section */}
        <div className="space-y-4">
          <Card className="magnet-card sticky top-24">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Shopping List</CardTitle>
                {shoppingItems.length > 0 && (
                  <Badge variant="secondary">
                    {shoppingItems.length} items
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {shoppingItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select recipes to generate a list</p>
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-muted p-2">
                        <p className="text-muted-foreground">To Buy</p>
                        <p className="font-semibold text-lg">{missingCount}</p>
                      </div>
                      <div className="rounded bg-muted p-2">
                        <p className="text-muted-foreground">Done</p>
                        <p className="font-semibold text-lg">{checkedCount}/{shoppingItems.length}</p>
                      </div>
                    </div>

                    <div className="rounded bg-muted p-3 text-sm space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-muted-foreground">Estimated total</p>
                          <p className="font-semibold">{pricedItemCount ? formatCurrency(estimatedTotal) : 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">Based on suggestions; uses selected pricing mode</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground">Mode:</div>
                          <div className="rounded-md border bg-transparent p-1">
                            <button
                              className={cn('px-2 py-1 text-sm rounded', pricingMode === 'cheapest' ? 'bg-primary text-white' : 'hover:bg-accent')}
                              onClick={() => setPricingMode('cheapest')}
                            >
                              Per-item cheapest
                            </button>
                            <button
                              className={cn('ml-1 px-2 py-1 text-sm rounded', pricingMode === 'best-store' ? 'bg-primary text-white' : 'hover:bg-accent')}
                              onClick={() => setPricingMode('best-store')}
                            >
                              Best single store
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div>
                          {pricingMode === 'best-store' && bestStoreInfo.store ? (
                            <>
                              <div>Best store: <span className="font-medium text-foreground">{bestStoreInfo.store.name}</span></div>
                              <div className="mt-1">{bestStoreInfo.itemsPriced}/{missingCount} items priced at this store</div>
                            </>
                          ) : (
                            <div>{pricedItemCount}/{missingCount} items priced</div>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">Assumes quantity where provided</div>
                      </div>
                    </div> 
                  </div>

                  {/* Items */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {shoppingItems.map((item) => (
                      <div
                        key={item.ingredient}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded border transition-all group",
                          item.checked && !item.isEditing ? "bg-muted/50 border-muted" : "hover:bg-accent",
                          !item.hasInInventory && !item.isEditing ? "border-red-200 dark:border-red-900" : ""
                        )}
                      >
                        {!item.isEditing && (
                          <Checkbox
                            checked={item.checked}
                            onChange={() => toggleItemChecked(item.ingredient)}
                            className="mt-0.5"
                          />
                        )}
                        
                        {item.isEditing ? (
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <Input
                              value={item.editValue || ''}
                              onChange={(e) => {
                                setShoppingItems(prev =>
                                  prev.map(i =>
                                    i.ingredient === item.ingredient
                                      ? { ...i, editValue: e.target.value }
                                      : i
                                  )
                                );
                              }}
                              placeholder="Item name"
                              className="h-8 text-sm"
                              autoFocus
                            />

                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={item.quantity}
                              onChange={(e) => {
                                const v = Math.max(1, Number(e.target.value) || 1);
                                setShoppingItems(prev => prev.map(i => i.ingredient === item.ingredient ? { ...i, quantity: v } : i));
                              }}
                              className="w-20 h-8 text-sm"
                            />

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => saveEditedItem(item.ingredient)}
                              className="h-6 w-6 p-0"
                            >
                              <Check className="h-3 w-3 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelEditingItem(item.ingredient)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              item.checked && "line-through text-muted-foreground"
                            )}>
                              {item.ingredient}
                            </p>
                            {item.hasInInventory && (
                              <p className="text-xs text-muted-foreground">
                                In inventory: {item.inventoryQuantity}
                              </p>
                            )}

                            {!item.hasInInventory && (
                              <>
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                  Need to buy
                                </p>
                                {/* per-item estimated price (from smart suggestions) */}
                                {(() => {
                                  const bp = getBestPrice(item.ingredient);
                                  return bp ? (
                                    <p className="text-sm font-semibold mt-1">{formatCurrency(bp)}</p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground mt-1">Price: N/A</p>
                                  );
                                })()}
                              </>
                            )} 
                          </div>
                        )}
                        
                        {/* quantity input + action buttons */}
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={item.quantity}
                            onChange={(e) => {
                              const v = Math.max(1, Number(e.target.value) || 1);
                              setShoppingItems(prev => prev.map(i => i.ingredient === item.ingredient ? { ...i, quantity: v } : i));
                            }}
                            className="w-16 h-8 text-sm"
                          />

                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditingItem(item.ingredient)}
                              className="h-6 w-6 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.ingredient)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* show per-item price / line total when available */}
                        {!item.isEditing && !item.hasInInventory && (
                          <div className="ml-4 text-right min-w-[120px]">
                            {(() => {
                              if (pricingMode === 'cheapest') {
                                const bp = getBestPrice(item.ingredient);
                                return bp ? (
                                  <div>
                                    <div className="text-xs text-muted-foreground">{formatCurrency(bp)} each</div>
                                    <div className="text-sm font-semibold">{formatCurrency(bp * (item.quantity || 1))}</div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground">Price: N/A</div>
                                );
                              }

                              // best-store mode: find price from chosen store
                              if (pricingMode === 'best-store' && bestStoreInfo.store) {
                                const opts = suggestions[item.ingredient] ?? [];
                                const match = opts.find(o => (o.store.id || o.store.name) === (bestStoreInfo.store.id || bestStoreInfo.store.name));
                                const p = match ? Number(match.price || 0) : null;
                                return p ? (
                                  <div>
                                    <div className="text-xs text-muted-foreground">{formatCurrency(p)} each @ {bestStoreInfo.store.name}</div>
                                    <div className="text-sm font-semibold">{formatCurrency(p * (item.quantity || 1))}</div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground">Not available at selected store</div>
                                );
                              }

                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyToClipboard}
                      className="flex-1"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={downloadList}
                      className="flex-1"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>

                    <Button
                      size="sm"
                      onClick={postEstimate}
                      disabled={estimating || shoppingItems.length === 0}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {estimating ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      Estimate price
                    </Button>
                  </div>

                  {/* Clear */}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={clearList}
                    className="w-full"
                  >
                    Clear List
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Smart Suggestions Panel */}
          {Object.keys(suggestions).length > 0 && (
            <Card className="magnet-card sticky top-[28rem]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Smart Suggestions
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Found better deals for your items
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingSuggestions ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {Object.entries(suggestions).map(([ingredient, options]) => (
                      <div key={ingredient} className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">
                          {ingredient}
                        </p>
                        {options.map((option, idx) => (
                          <div
                            key={`${option.id}-${idx}`}
                            className={cn(
                              "p-2 rounded border cursor-pointer transition-all hover:bg-accent",
                              selectedItemForSuggestion === `${ingredient}-${idx}` && "bg-primary/10 border-primary"
                            )}
                            onClick={() => setSelectedItemForSuggestion(`${ingredient}-${idx}`)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {option.productName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {option.store.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <TrendingDown className="h-3 w-3 text-green-600" />
                                <p className="text-xs font-semibold text-green-600">
                                  ${option.price.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            {idx === 0 && (
                              <Badge className="mt-1 text-xs bg-green-100 text-green-800">
                                Best Price
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShoppingList;

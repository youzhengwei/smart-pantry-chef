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
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShoppingItem {
  ingredient: string;
  recipes: string[]; // which recipes need this
  hasInInventory: boolean;
  inventoryQuantity?: string;
  checked: boolean;
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

  const clearList = () => {
    setShoppingItems([]);
    setSelectedRecipes([]);
  };

  const downloadList = () => {
    const list = shoppingItems
      .map(item => `${item.checked ? '✓' : '○'} ${item.ingredient}${item.hasInInventory ? ` (Have: ${item.inventoryQuantity})` : ' (NEED TO BUY)'}`)
      .join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(list));
    element.setAttribute('download', 'shopping-list.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast({ title: 'Downloaded', description: 'Shopping list saved as shopping-list.txt' });
  };

  const copyToClipboard = () => {
    const list = shoppingItems
      .map(item => `${item.checked ? '✓' : '•'} ${item.ingredient}${item.hasInInventory ? ` (Have: ${item.inventoryQuantity})` : ''}`)
      .join('\n');

    navigator.clipboard.writeText(list);
    toast({ title: 'Copied', description: 'Shopping list copied to clipboard' });
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

                  {/* Items */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {shoppingItems.map((item) => (
                      <div
                        key={item.ingredient}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded border transition-all group",
                          item.checked ? "bg-muted/50 border-muted" : "hover:bg-accent",
                          !item.hasInInventory ? "border-red-200 dark:border-red-900" : ""
                        )}
                      >
                        <Checkbox
                          checked={item.checked}
                          onChange={() => toggleItemChecked(item.ingredient)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            item.checked && "line-through text-muted-foreground"
                          )}>
                            {item.ingredient}
                          </p>
                          {item.hasInInventory && (
                            <p className="text-xs text-muted-foreground">
                              Have: {item.inventoryQuantity}
                            </p>
                          )}
                          {!item.hasInInventory && (
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                              Need to buy
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.ingredient)}
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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

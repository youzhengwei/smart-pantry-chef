import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getRecommendedRecipes, saveRecipe, getSavedRecipes, getRecipes, unsaveRecipe } from '@/services/firebaseService';
import { generateRecipes, saveRecipes, fetchAIGeneratedRecipes, testWebhookConnection } from '@/services/aiRecipeService';
import { RecipeWithScore, SavedRecipe, AIGeneratedRecipe } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import RecipeCard from '@/components/RecipeCard';
import RecommendedRecipeCard from '@/components/RecommendedRecipeCard';
import {
  ChefHat,
  Loader2,
  Heart,
  Clock,
  AlertCircle,
  Check,
  Sparkles,
  Wand2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

const Recipes: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<RecipeWithScore[]>([]);
  const [aiRecipes, setAiRecipes] = useState<AIGeneratedRecipe[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithScore | null>(null);

  // AI Generation state
  const [strictOnly, setStrictOnly] = useState(true);
  const [preferenceText, setPreferenceText] = useState('');

  // Filter state

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [recipesData, savedData, aiRecipesData] = await Promise.all([
        getRecommendedRecipes(user.uid),
        getSavedRecipes(user.uid),
        fetchAIGeneratedRecipes(user.uid)
      ]);
      console.log('[Recipes.loadData] savedData raw =', savedData);
      setRecipes(recipesData);
      setSavedRecipes(savedData);
      setAiRecipes(aiRecipesData);
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recipes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRecipes = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      // Generate recipes via Railway webhook
      const generatedRecipes = await generateRecipes(user.uid, strictOnly, preferenceText);

      if (generatedRecipes.length === 0) {
        toast({
          title: 'No recipes generated',
          description: 'Try adjusting your preferences or check your inventory.',
          variant: 'destructive',
        });
        return;
      }

      // Save recipes to Firestore
      const savedRecipes = await saveRecipes(user.uid, generatedRecipes);

      // Update local state
      setAiRecipes(prev => [...savedRecipes, ...prev]);

      toast({
        title: 'Recipes generated!',
        description: `Created ${savedRecipes.length} new recipe${savedRecipes.length !== 1 ? 's' : ''} based on your preferences.`,
      });

      // Clear form
      setPreferenceText('');

    } catch (error) {
      console.error('Error generating recipes:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate recipes. Please check your webhook configuration and try again.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleFavouriteChange = (recipeId: string, isFavourite: boolean) => {
    setAiRecipes(prev =>
      prev.map(recipe =>
        recipe.id === recipeId
          ? { ...recipe, isFavourite }
          : recipe
      )
    );
  };

  const handleSaveRecipe = async (recipeId: string) => {
    if (!user) return;
    // If already saved -> unsave (delete SavedRecipe document)
    const existing = savedRecipes.find(sr => sr.recipeId === recipeId);
    try {
      if (existing && existing.id) {
        // Unsave
        await unsaveRecipe(existing.id);
        toast({ title: 'Recipe unsaved' });
      } else {
        // Save
        await saveRecipe(user.uid, recipeId);
        toast({ title: 'Recipe saved!' });
      }

      // Refresh saved state
      await loadData();
    } catch (error) {
      console.error('Error toggling save:', error);
      toast({
        title: 'Error',
        description: 'Failed to update saved recipes.',
        variant: 'destructive',
      });
    }
  };

  const isRecipeSaved = (recipeId: string) => {
    return savedRecipes.some(sr => sr.recipeId === recipeId);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Recipe Ideas</h1>
        <p className="text-muted-foreground">
          Recipes recommended based on your inventory. Uses expiring items first!
        </p>
      </div>

      {/* AI Recipe Generation */}
      <Card className="magnet-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Generate AI Recipes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="strict-mode"
              checked={strictOnly}
              onCheckedChange={(checked) => setStrictOnly(checked as boolean)}
            />
            <Label htmlFor="strict-mode" className="text-sm">
              Strictly use available ingredients only (allows small amounts of salt, pepper, oil, butter, sugar, flour, water)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferences" className="text-sm">
              What do you feel like making? (optional)
            </Label>
            <Input
              id="preferences"
              placeholder="e.g., italian style, easy to make, vegetarian"
              value={preferenceText}
              onChange={(e) => setPreferenceText(e.target.value)}
              disabled={generating}
            />
          </div>

          {/* Webhook Status Indicator */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Webhook Status</span>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span>Connected</span>
            </div>
          </div>

          <Button
            onClick={handleGenerateRecipes}
            disabled={generating || !user}
            className="w-full bg-fresh hover:bg-fresh/90"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Recipes...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Recipes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="magnet-card border-l-4 border-l-fresh bg-fresh/5">
        <CardContent className="flex items-start gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fresh/10 text-fresh">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Smart Recipe Matching</h3>
            <p className="text-sm text-muted-foreground">
              Recipes are scored based on ingredients you have. Items expiring soon get priority!
              Only recipes with 1 or fewer missing ingredients are shown.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Recipes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Recommended Recipes
          </h2>
        </div>

        {/* Recipe Grid */}
        {recipes.length === 0 ? (
          <Card className="magnet-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <ChefHat className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold">No recipes available</h3>
              <p className="text-center text-muted-foreground">
                Add more items to your inventory to get recipe recommendations.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recipes
              .filter(recipe => {
                if (showGeneratedOnly && recipe.source !== 'ai') return false;
                if (showFavouritesOnly && !isRecipeSaved(recipe.id!)) return false;
                return true;
              })
              .length === 0 ? (
              <Card className="magnet-card col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <p className="text-muted-foreground">No recipes available</p>
                </CardContent>
              </Card>
            ) : (
              recipes
                .filter(recipe => {
                  if (showGeneratedOnly && recipe.source !== 'ai') return false;
                  if (showFavouritesOnly && !isRecipeSaved(recipe.id!)) return false;
                  return true;
                })
                .map((recipe) => (
                  <RecommendedRecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onSaveRecipe={handleSaveRecipe}
                    isRecipeSaved={isRecipeSaved}
                  />
                ))
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default Recipes;

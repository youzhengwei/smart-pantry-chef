import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSavedRecipes, getRecipeById, getRecipeAI, unsaveRecipe } from '@/services/firebaseService';
import { SavedRecipe, Recipe, RecipeAI, AIGeneratedRecipe, Ingredient, Instruction } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import RecipeCard from '@/components/RecipeCard';
import { Heart, Loader2, ChefHat } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

type SavedRecipeDoc = Recipe & {
  ingredients?: (string | Ingredient)[];
  instructions?: (string | Instruction)[];
  cookingTime?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings?: number;
  imageUrl?: string;
  imageUrls?: string[];
  createdAt?: Timestamp;
  isFavourite?: boolean;
  source?: string;
};

interface SavedRecipeWithDetails extends SavedRecipe {
  recipe?: SavedRecipeDoc;
  aiData?: RecipeAI;
}

const SavedRecipes: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const formatIngredient = (ingredient: string | { name: string; quantity?: string | number; unit?: string }) => {
    if (typeof ingredient === 'string') return ingredient;
    const quantity = ingredient.quantity ?? '';
    const unit = ingredient.unit ?? '';
    const parts = [quantity, unit, ingredient.name].filter(Boolean);
    return parts.join(' ');
  };

  useEffect(() => {
    loadSavedRecipes();
  }, [user]);

  const loadSavedRecipes = async () => {
    if (!user) return;
    try {
      const saved = await getSavedRecipes(user.uid);

      const enrichedSaved: SavedRecipeWithDetails[] = await Promise.all(
        saved.map(async (sr) => {
          const recipe = await getRecipeById(sr.recipeId);
          const aiData = recipe ? await getRecipeAI(recipe.id!) : null;
          return {
            ...sr,
            recipe: recipe || undefined,
            aiData: aiData || undefined
          };
        })
      );

      setSavedRecipes(enrichedSaved);
    } catch (error) {
      console.error('Error loading saved recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (savedRecipeId: string) => {
    try {
      await unsaveRecipe(savedRecipeId);
      await loadSavedRecipes();
      toast({ title: 'Recipe removed from favorites' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove recipe.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const toRecipeCard = (saved: SavedRecipeWithDetails): AIGeneratedRecipe => {
    const recipeId = saved.recipe?.id || saved.recipeId;
    const baseName = saved.recipe?.name || 'Unknown Recipe';
    const ingredients = saved.recipe?.ingredients || [];
    const instructions = saved.recipe?.instructions || saved.aiData?.steps || [];
    const imageUrl = saved.recipe?.imageUrl || saved.recipe?.imageUrls?.[0];

    return {
      id: recipeId,
      name: baseName,
      ingredients,
      instructions,
      cookingTime: saved.recipe?.cookingTime || '',
      difficulty: saved.recipe?.difficulty || 'medium',
      servings: saved.recipe?.servings || 0,
      isFavourite: saved.recipe?.isFavourite ?? true,
      createdAt: saved.recipe?.createdAt || saved.savedAt || Timestamp.now(),
      source: saved.recipe?.source || 'saved',
      imageUrl
    } as AIGeneratedRecipe;
  };

  const handleSaveToggle = async (recipeId: string) => {
    const target = savedRecipes.find(sr => (sr.recipe?.id || sr.recipeId) === recipeId);
    if (!target?.id) return;
    await handleUnsave(target.id);
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Saved Recipes</h1>
        <p className="text-muted-foreground">Your favorite recipes collection</p>
      </div>

      {savedRecipes.length === 0 ? (
        <Card className="magnet-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Heart className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-display text-xl font-semibold">No saved recipes yet</h3>
            <p className="text-muted-foreground">
              Save your favorite recipes from the Recipes page to see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {savedRecipes.map((saved) => {
            const cardRecipe = toRecipeCard(saved);
            return (
              <RecipeCard
                key={saved.id}
                recipe={cardRecipe}
                isSaved
                onSaveToggle={handleSaveToggle}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedRecipes;

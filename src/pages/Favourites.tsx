import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSavedRecipes, addManualRecipe } from '@/services/aiRecipeService';
import { AIGeneratedRecipe } from '@/types';
import { useToast } from '@/hooks/use-toast';
import RecipeCard from '@/components/RecipeCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Heart,
  Loader2,
  RefreshCw,
  ChefHat,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

const Favourites: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [favourites, setFavourites] = useState<AIGeneratedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ingredients: '',
    instructions: '',
    cookingTime: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    servings: 4
  });

  useEffect(() => {
    loadFavourites();
  }, [user]);

  const loadFavourites = async () => {
    if (!user) return;

    setLoading(true);
    try {
      console.log('Loading saved recipes for user:', user.uid);
      const savedRecipes = await fetchSavedRecipes(user.uid);
      console.log('Loaded saved recipes:', savedRecipes);
      setFavourites(savedRecipes);
    } catch (error) {
      console.error('Error loading saved recipes:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Error',
        description: `Failed to load saved recipes: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFavouriteChange = (recipeId: string, isFavourite: boolean) => {
    if (!isFavourite) {
      // Remove from favourites list if unfavourited
      setFavourites(prev => prev.filter(recipe => recipe.id !== recipeId));
    }
  };

  const handleAddManualRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    if (!formData.name.trim() || !formData.ingredients.trim() || !formData.instructions.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please fill in recipe name, ingredients, and instructions.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const ingredients = formData.ingredients
        .split('\n')
        .map(ing => ing.trim())
        .filter(ing => ing.length > 0);

      const instructions = formData.instructions
        .split('\n')
        .map(step => step.trim())
        .filter(step => step.length > 0);

      const newRecipe = await addManualRecipe(user.uid, {
        name: formData.name.trim(),
        ingredients,
        instructions,
        cookingTime: formData.cookingTime.trim() || '30 mins',
        difficulty: formData.difficulty,
        servings: formData.servings
      });

      setFavourites(prev => [newRecipe, ...prev]);
      
      setFormData({
        name: '',
        ingredients: '',
        instructions: '',
        cookingTime: '',
        difficulty: 'medium',
        servings: 4
      });

      setIsDialogOpen(false);

      toast({
        title: 'Recipe added!',
        description: `"${newRecipe.name}" has been added to your favorites.`,
      });
    } catch (error) {
      console.error('Error adding recipe:', error);
      toast({
        title: 'Error',
        description: 'Failed to add recipe to favorites.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
            <Heart className="h-8 w-8 text-red-500" />
            Favorite Recipes
          </h1>
          <p className="text-muted-foreground">
            Your favorite AI-generated recipes
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-fresh hover:bg-fresh/90">
                <Plus className="mr-2 h-4 w-4" />
                Add Recipe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add a Recipe to Favorites</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddManualRecipe} className="space-y-4">
                <div>
                  <Label htmlFor="name">Recipe Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Pasta Carbonara"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <Label htmlFor="ingredients">Ingredients * (one per line)</Label>
                  <Textarea
                    id="ingredients"
                    placeholder="e.g.&#10;2 cups flour&#10;1 egg&#10;Salt and pepper"
                    value={formData.ingredients}
                    onChange={(e) => setFormData({...formData, ingredients: e.target.value})}
                    disabled={isSubmitting}
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="instructions">Instructions * (one per line)</Label>
                  <Textarea
                    id="instructions"
                    placeholder="e.g.&#10;1. Mix dry ingredients&#10;2. Add wet ingredients&#10;3. Cook for 10 minutes"
                    value={formData.instructions}
                    onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                    disabled={isSubmitting}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cookingTime">Cooking Time</Label>
                    <Input
                      id="cookingTime"
                      placeholder="e.g., 30 mins"
                      value={formData.cookingTime}
                      onChange={(e) => setFormData({...formData, cookingTime: e.target.value})}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="servings">Servings</Label>
                    <Input
                      id="servings"
                      type="number"
                      min="1"
                      value={formData.servings}
                      onChange={(e) => setFormData({...formData, servings: parseInt(e.target.value) || 4})}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <select
                    id="difficulty"
                    value={formData.difficulty}
                    onChange={(e) => setFormData({...formData, difficulty: e.target.value as 'easy' | 'medium' | 'hard'})}
                    disabled={isSubmitting}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-fresh hover:bg-fresh/90"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Recipe
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={loadFavourites}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Favourites Grid */}
      {Array.isArray(favourites) && favourites.length === 0 ? (
        <Card className="magnet-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Heart className="h-10 w-10" />
            </div>
            <h3 className="mb-2 font-display text-xl font-semibold">No favorite recipes yet</h3>
            <p className="text-center text-muted-foreground mb-4">
              Generate some AI recipes and mark them as favorites to see them here.
            </p>
            <Button
              onClick={() => window.location.href = '/recipes'}
              className="bg-fresh hover:bg-fresh/90"
            >
              <ChefHat className="mr-2 h-4 w-4" />
              Generate Recipes
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {favourites.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onFavouriteChange={handleFavouriteChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favourites;
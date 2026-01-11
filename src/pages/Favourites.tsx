import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFavourites } from '@/services/aiRecipeService';
import { AIGeneratedRecipe } from '@/types';
import { useToast } from '@/hooks/use-toast';
import RecipeCard from '@/components/RecipeCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Heart,
  Loader2,
  RefreshCw,
  ChefHat
} from 'lucide-react';
import { cn } from '@/lib/utils';

const Favourites: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [favourites, setFavourites] = useState<AIGeneratedRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavourites();
  }, [user]);

  const loadFavourites = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const favouriteRecipes = await fetchFavourites(user.uid);
      setFavourites(favouriteRecipes);
    } catch (error) {
      console.error('Error loading favourites:', error);
      toast({
        title: 'Error',
        description: 'Failed to load favourite recipes.',
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
        <Button
          variant="outline"
          onClick={loadFavourites}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Favourites Grid */}
      {favourites.length === 0 ? (
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
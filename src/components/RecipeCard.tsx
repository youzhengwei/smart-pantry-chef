import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AIGeneratedRecipe } from '@/types';
import { toggleFavourite } from '@/services/aiRecipeService';
import { useAuth } from '@/contexts/AuthContext';
import {
  Clock,
  Users,
  Star,
  Heart,
  Loader2,
  ChefHat,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecipeCardProps {
  recipe: AIGeneratedRecipe;
  onFavouriteChange?: (recipeId: string, isFavourite: boolean) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onFavouriteChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [togglingFavourite, setTogglingFavourite] = useState(false);

  const handleToggleFavourite = async () => {
    if (!user) return;

    setTogglingFavourite(true);
    try {
      const newFavouriteStatus = !recipe.isFavourite;
      await toggleFavourite(user.uid, recipe.id!, newFavouriteStatus);

      toast({
        title: newFavouriteStatus ? 'Added to favourites!' : 'Removed from favourites',
        description: `"${recipe.name}" has been ${newFavouriteStatus ? 'added to' : 'removed from'} your favourites.`,
      });

      onFavouriteChange?.(recipe.id!, newFavouriteStatus);
    } catch (error) {
      console.error('Error toggling favourite:', error);
      toast({
        title: 'Error',
        description: 'Failed to update favourite status.',
        variant: 'destructive',
      });
    } finally {
      setTogglingFavourite(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="magnet-card overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-primary/5 to-fresh/5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="font-display text-xl mb-2">{recipe.name}</CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge className={cn("text-xs capitalize", getDifficultyColor(recipe.difficulty))}>
                {recipe.difficulty}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {recipe.cookingTime}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {recipe.servings} servings
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleFavourite}
            disabled={togglingFavourite}
            className={cn(
              "ml-2 transition-colors",
              recipe.isFavourite
                ? "text-red-500 hover:text-red-600"
                : "text-gray-400 hover:text-red-500"
            )}
          >
            {togglingFavourite ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart className={cn("h-4 w-4", recipe.isFavourite && "fill-current")} />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Ingredients */}
        <div>
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <ChefHat className="h-4 w-4" />
            Ingredients
          </h4>
          <ul className="space-y-1">
            {recipe.ingredients.map((ingredient, index) => {
              // Handle both string and object formats
              const ingredientText = typeof ingredient === 'string' 
                ? ingredient 
                : `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`;
              
              return (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                  {ingredientText}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Instructions */}
        <div>
          <h4 className="font-semibold text-foreground mb-2">Instructions</h4>
          <ol className="space-y-2">
            {recipe.instructions.map((instruction, index) => (
              <li key={index} className="text-sm text-muted-foreground flex gap-2">
                <span className="font-medium text-primary flex-shrink-0 w-5">
                  {index + 1}.
                </span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Generated by AI</span>
            {recipe.isFavourite && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span>Favourite</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecipeCard;
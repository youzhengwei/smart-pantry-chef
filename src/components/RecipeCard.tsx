import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AIGeneratedRecipe } from '@/types';
import { toggleFavourite } from '@/services/aiRecipeService';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Clock, Users, Heart, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecipeCardProps {
  recipe: AIGeneratedRecipe;
  onFavouriteChange?: (recipeId: string, isFavourite: boolean) => void;
  isSaved?: boolean;
  onSaveToggle?: (recipeId: string) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onFavouriteChange, isSaved, onSaveToggle }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [togglingFavourite, setTogglingFavourite] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleToggleFavourite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) return;

    setTogglingFavourite(true);
    try {
      const newFavouriteStatus = !recipe.isFavourite;
      await toggleFavourite(user.uid, recipe.id!, newFavouriteStatus);

      toast({
        title: newFavouriteStatus ? 'Added to favourites!' : 'Removed from favourites',
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

  const imageUrl = recipe.imageUrl || (recipe.imageUrls && recipe.imageUrls[0]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Card className="magnet-card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
          {/* Image with Favorite Button Overlay */}
          <div className="relative">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={recipe.name}
                className="h-48 w-full object-cover"
              />
            ) : (
              <div className="h-48 w-full bg-gradient-to-br from-primary/10 to-fresh/10 flex items-center justify-center">
                <ChefHat className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}

            {/* Favorite / Saved Button Overlay */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onSaveToggle) {
                  onSaveToggle(recipe.id!);
                } else {
                  handleToggleFavourite(e as any);
                }
              }}
              disabled={togglingFavourite}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
            >
              <Heart
                className={cn(
                  'h-5 w-5 transition-colors',
                  (recipe.isFavourite || isSaved) ? 'fill-red-500 text-red-500' : 'text-white'
                )}
              />
            </button>
          </div>

          {/* Card Content */}
          <CardContent className="p-4">
            <h3 className="font-display text-lg font-semibold mb-2 line-clamp-2">{recipe.name}</h3>

            {/* Metadata Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs capitalize">
                  {recipe.difficulty || 'unknown'}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {recipe.cookingTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {recipe.cookingTime}
                  </div>
                )}
                {recipe.servings && (
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {recipe.servings}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      {/* Modal Dialog */}
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{recipe.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt={recipe.name}
              className="w-full h-64 object-cover rounded-lg"
            />
          )}

          {/* Metadata */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Difficulty</p>
              <Badge variant="outline" className="capitalize">{recipe.difficulty || 'unknown'}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Cooking Time</p>
              <p className="text-sm font-medium">{recipe.cookingTime || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Servings</p>
              <p className="text-sm font-medium">{recipe.servings || '-'}</p>
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-2">
            <h4 className="font-semibold">Ingredients</h4>
            <ul className="space-y-1">
              {(recipe.ingredients || []).map((ingredient, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  • {typeof ingredient === 'string' ? ingredient : `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`}
                </li>
              ))}
            </ul>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <h4 className="font-semibold">Instructions</h4>
            <ol className="space-y-2">
              {(recipe.instructions || []).map((instruction, index) => {
                const text = typeof instruction === 'string' ? instruction : instruction.text;
                const step = typeof instruction === 'string' ? (index + 1) : (instruction.step || (index + 1));
                return (
                  <li key={index} className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{step}.</span> {text}
                  </li>
                );
              })}
            </ol>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecipeCard;
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RecipeWithScore } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecommendedRecipeCardProps {
  recipe: RecipeWithScore;
  onSaveRecipe: (recipeId: string) => void;
  isRecipeSaved: (recipeId: string) => boolean;
}

const RecommendedRecipeCard: React.FC<RecommendedRecipeCardProps> = ({
  recipe,
  onSaveRecipe,
  isRecipeSaved,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Card className="magnet-card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
          {/* Image */}
          <div className="relative">
            {recipe.imageUrl && (
              <img
                src={recipe.imageUrl}
                alt={recipe.name}
                className="h-48 w-full object-cover"
              />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSaveRecipe(recipe.id!);
              }}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
              aria-label={isRecipeSaved(recipe.id!) ? 'Unsave recipe' : 'Save recipe'}
            >
              <Heart
                className={cn(
                  'h-5 w-5 transition-colors',
                  isRecipeSaved(recipe.id!) ? 'fill-red-500 text-red-500' : 'text-white'
                )}
              />
            </button>
          </div>

          <CardHeader className="bg-gradient-to-br from-primary/5 to-fresh/5 pb-2">
            <CardTitle className="font-display text-lg line-clamp-2">{recipe.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-3 text-sm text-muted-foreground">
              {recipe.cookingTime && (
                <span>⏱ {recipe.cookingTime}</span>
              )}
              {recipe.difficulty && (
                <Badge variant="outline" className="text-xs capitalize">
                  {recipe.difficulty}
                </Badge>
              )}
            </div>

          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{recipe.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Image */}
          {recipe.imageUrl && (
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-full h-64 object-cover rounded-lg"
            />
          )}
          
          {/* Metadata */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Difficulty</p>
              <Badge variant="outline" className="capitalize">{recipe.difficulty || '-'}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cooking Time</p>
              <p className="text-sm font-medium">{recipe.cookingTime || '-'}</p>
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <h4 className="font-semibold mb-2">Ingredients:</h4>
            <ul className="space-y-1">
              {(recipe.ingredients || []).map((ingredient, index) => {
                if (typeof ingredient === 'string') {
                  return (
                    <li key={index} className="text-sm">
                      • {ingredient}
                    </li>
                  );
                }
                return (
                  <li key={index} className="text-sm">
                    • {ingredient.quantity} {ingredient.unit} {ingredient.name}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Instructions:</h4>
              <ol className="space-y-2">
                {recipe.instructions.map((instruction, index) => {
                  const text = typeof instruction === 'string' ? instruction : instruction.text;
                  const step = typeof instruction === 'string' ? (index + 1) : (instruction.step || (index + 1));
                  return (
                    <li key={index} className="text-sm">
                      <span className="font-medium">{step}.</span> {text}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecommendedRecipeCard;

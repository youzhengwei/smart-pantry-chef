import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
          {recipe.imageUrl && (
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="h-48 w-full object-cover"
            />
          )}

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

            <Button
              size="icon"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onSaveRecipe(recipe.id!);
              }}
              className="w-full"
            >
              <Heart
                className={cn('h-4 w-4 mr-2', isRecipeSaved(recipe.id!) && 'fill-current text-red-500')}
              />
              {isRecipeSaved(recipe.id!) ? 'Unsave' : 'Save'}
            </Button>
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

          <Button
            onClick={() => onSaveRecipe(recipe.id!)}
            className="w-full gap-2"
            variant={isRecipeSaved(recipe.id!) ? 'destructive' : 'default'}
          >
            <Heart
              className={cn('h-4 w-4', isRecipeSaved(recipe.id!) && 'fill-current')}
            />
            {isRecipeSaved(recipe.id!) ? 'Unsave Recipe' : 'Save Recipe'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecommendedRecipeCard;

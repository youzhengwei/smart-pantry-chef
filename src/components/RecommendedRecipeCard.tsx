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
    <Card className="magnet-card overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-primary/5 to-fresh/5 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-display text-xl">{recipe.name}</CardTitle>
            <div className="mt-2 flex flex-wrap gap-1">
              {(recipe.tags || []).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs capitalize">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-display text-lg font-bold text-primary">
            {recipe.score}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-4 space-y-3">
          <h4 className="font-semibold text-foreground">Ingredients:</h4>
          <ul className="space-y-1">
            {(recipe.ingredients || []).map((ingredient, index) => (
              <li key={index} className="text-sm text-muted-foreground">
                • {typeof ingredient === 'string' ? ingredient : ingredient?.name || String(ingredient)}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                View Recipe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{recipe.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Ingredients:</h4>
                  <ul className="space-y-1">
                    {(recipe.ingredients || []).map((ingredient, index) => (
                      <li key={index} className="text-sm">
                        • {typeof ingredient === 'string' ? ingredient : ingredient?.name || String(ingredient)}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={() => onSaveRecipe(recipe.id!)}
                  className="w-full gap-2"
                  disabled={isRecipeSaved(recipe.id!)}
                >
                  <Heart
                    className={cn('h-4 w-4', isRecipeSaved(recipe.id!) && 'fill-current')}
                  />
                  {isRecipeSaved(recipe.id!) ? 'Saved' : 'Save Recipe'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="icon"
            onClick={() => onSaveRecipe(recipe.id!)}
            disabled={isRecipeSaved(recipe.id!)}
          >
            <Heart
              className={cn('h-4 w-4', isRecipeSaved(recipe.id!) && 'fill-current text-primary')}
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecommendedRecipeCard;

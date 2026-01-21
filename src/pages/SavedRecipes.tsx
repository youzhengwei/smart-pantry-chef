import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSavedRecipes, getRecipeById, getRecipeAI, unsaveRecipe } from '@/services/firebaseService';
import { SavedRecipe, Recipe, RecipeAI } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Heart, Loader2, Trash2, ChefHat } from 'lucide-react';

interface SavedRecipeWithDetails extends SavedRecipe {
  recipe?: Recipe;
  aiData?: RecipeAI;
}

const SavedRecipes: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

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
          {savedRecipes.map((saved) => (
            <Card key={saved.id} className="magnet-card overflow-hidden">
              <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/10 pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="font-display text-xl">
                    {saved.recipe?.name || 'Unknown Recipe'}
                  </CardTitle>
                  <Heart className="h-5 w-5 fill-primary text-primary" />
                </div>
                {saved.recipe?.tags && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {saved.recipe.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs capitalize">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4">
                {saved.aiData && (
                  <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                    {saved.aiData.description}
                  </p>
                )}

                {saved.recipe?.ingredients && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {saved.recipe.ingredients.slice(0, 5).map((ingredient, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {ingredient}
                        </Badge>
                      ))}
                      {saved.recipe.ingredients.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{saved.recipe.ingredients.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        View Recipe
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[80vh] overflow-y-auto bg-card sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="font-display text-2xl">
                          {saved.recipe?.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6">
                        {saved.aiData && (
                          <>
                            <p className="text-muted-foreground">{saved.aiData.description}</p>
                            
                            <div>
                              <h4 className="mb-3 font-semibold">Ingredients</h4>
                              <div className="flex flex-wrap gap-2">
                                {saved.recipe?.ingredients.map((ingredient, idx) => (
                                  <Badge key={idx} variant="outline">{ingredient}</Badge>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="mb-3 font-semibold">Steps</h4>
                              <ol className="space-y-3">
                                {saved.aiData.steps.map((step, idx) => (
                                  <li key={idx} className="flex gap-3">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                      {idx + 1}
                                    </span>
                                    <span className="text-muted-foreground">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleUnsave(saved.id!)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedRecipes;

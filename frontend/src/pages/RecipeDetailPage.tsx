import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeftIcon, StarIcon, ShoppingCartIcon, PlusIcon, PrinterIcon, PlayIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { MainLayout } from "@/components/templates/MainLayout";
import { Button } from "@/components/atoms/Button";
import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { StarRating } from "@/components/atoms/StarRating";
import { TimeBadge } from "@/components/atoms/TimeBadge";
import { ServingScaler, scaleQuantity } from "@/components/molecules/ServingScaler";
import { FeedbackButton } from "@/components/molecules/FeedbackButton";
import { AddFeedbackBottomSheet } from "@/components/molecules/AddFeedbackBottomSheet";
import { FeedbackTimeline } from "@/components/molecules/FeedbackTimeline";
import AddToShoppingListBottomSheet from "@/components/molecules/AddToShoppingListBottomSheet";
import { ConfirmDeleteBottomSheet } from "@/components/molecules/ConfirmDeleteBottomSheet";
import { useRecipe, useRecipeData } from "@/hooks/recipe/useRecipes";
import { useRecipeFeedback, useRecipeFeedbackMutations } from "@/hooks/recipe/useRecipeFeedback";
import { useAuth } from "@/hooks/useAuth";
import { categoryLabels } from "@/types/recipe";

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const recipeId = parseInt(id || "0", 10);
  const [currentServings, setCurrentServings] = useState<number | null>(null);
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false);

  const { data: recipe, isLoading } = useRecipe(recipeId);
  const { delete: deleteRecipe, toggleFavorite, edit: editRecipe } = useRecipeData();
  const { data: feedback, isLoading: isFeedbackLoading } = useRecipeFeedback(recipeId);
  const { addFeedback, deleteFeedback, isAdding, isDeleting } = useRecipeFeedbackMutations(recipeId);

  const handleBack = () => {
    navigate("/recipes");
  };

  const handleToggleFavorite = async () => {
    if (!recipe) return;
    await toggleFavorite(recipeId);
  };

  const handleDelete = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeletingRecipe(true);
    try {
      await deleteRecipe(recipeId);
      setIsDeleteConfirmOpen(false);
      navigate("/recipes");
    } finally {
      setIsDeletingRecipe(false);
    }
  };

  const handleAddFeedback = async (isLike: boolean, note: string) => {
    await addFeedback({ isLike, note: note || undefined });
  };

  const handleDeleteFeedback = async (feedbackId: number) => {
    await deleteFeedback(feedbackId);
  };

  const handleRatingChange = async (rating: number) => {
    if (!recipe) return;
    await editRecipe(recipeId, { rating });
  };

  const parseInstructions = (instructions: string): string[] => {
    try {
      const parsed = JSON.parse(instructions);
      return Array.isArray(parsed) ? parsed : [instructions];
    } catch {
      // If not JSON, split by newlines or return as single item
      return instructions.split('\n').filter(s => s.trim());
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="animate-spin h-8 w-8 text-primary-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-sm text-gray-600">Loading recipe...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!recipe) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Recipe not found
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              The recipe you're looking for doesn't exist.
            </p>
            <button
              onClick={handleBack}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              ← Back to Recipes
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const instructions = parseInstructions(recipe.instructions);

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>Back to Recipes</span>
        </button>

        {/* Recipe Image */}
        {recipe.imageUrl && (
          <div className="mb-4 rounded-lg overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-full h-64 md:h-80 object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{recipe.name}</h1>
            {recipe.description && (
              <p className="mt-2 text-gray-600">{recipe.description}</p>
            )}
          </div>
          <button
            onClick={handleToggleFavorite}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label={recipe.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {recipe.isFavorite ? (
              <StarIconSolid className="w-6 h-6 text-yellow-500" />
            ) : (
              <StarIcon className="w-6 h-6 text-gray-400" />
            )}
          </button>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <TimeBadge
            prepTimeMinutes={recipe.prepTimeMinutes}
            cookTimeMinutes={recipe.cookTimeMinutes}
          />
          <StarRating
            value={recipe.rating}
            onChange={handleRatingChange}
            size="sm"
          />
        </div>

        {/* Feedback buttons */}
        <div className="flex items-center gap-3 mt-4">
          <FeedbackButton
            type="like"
            count={feedback?.likes ?? 0}
            disabled={isFeedbackLoading}
          />
          <FeedbackButton
            type="dislike"
            count={feedback?.dislikes ?? 0}
            disabled={isFeedbackLoading}
          />
          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Feedback
          </button>
        </div>

        {/* Serving Scaler */}
        {recipe.servings && (
          <div className="mt-4">
            <ServingScaler
              originalServings={recipe.servings}
              currentServings={currentServings ?? recipe.servings}
              onServingsChange={setCurrentServings}
            />
          </div>
        )}

        {/* Categories */}
        {recipe.categories && recipe.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {recipe.categories.map((cat) => (
              <Badge
                key={`${cat.categoryType}-${cat.categoryValue}`}
                variant={
                  cat.categoryType === "allergen"
                    ? "warning"
                    : cat.categoryType === "dietary"
                    ? "success"
                    : "primary"
                }
              >
                {categoryLabels[cat.categoryValue] || cat.categoryValue}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ingredients */}
        <Card className="lg:col-span-1">
          <div className="p-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Ingredients</h2>
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <ul className="space-y-2">
                {recipe.ingredients.map((ing) => {
                  const multiplier = recipe.servings
                    ? (currentServings ?? recipe.servings) / recipe.servings
                    : 1;
                  const scaledQuantity = scaleQuantity(ing.quantity, multiplier);

                  return (
                    <li key={ing.id} className="flex items-start gap-2">
                      <span className="text-primary-600 mt-1">•</span>
                      <span>
                        {scaledQuantity && (
                          <span className="font-medium">{scaledQuantity} </span>
                        )}
                        {ing.unit && <span>{ing.unit} </span>}
                        <span>{ing.name}</span>
                        {ing.notes && (
                          <span className="text-gray-500 text-sm"> ({ing.notes})</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No ingredients listed</p>
            )}
          </div>
        </Card>

        {/* Instructions */}
        <Card className="lg:col-span-2">
          <div className="p-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Instructions</h2>
            <ol className="space-y-4">
              {instructions.map((step, index) => (
                <li key={index} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </span>
                  <p className="text-gray-700 pt-1">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </div>

      {/* Notes */}
      {recipe.notes && (
        <Card className="mt-6">
          <div className="p-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Notes</h2>
            <p className="text-gray-600 whitespace-pre-wrap">{recipe.notes}</p>
          </div>
        </Card>
      )}

      {/* Source URL */}
      {recipe.sourceUrl && (
        <div className="mt-6 text-sm text-gray-500">
          Source:{" "}
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 underline"
          >
            {(() => {
              try {
                return new URL(recipe.sourceUrl).hostname;
              } catch {
                return recipe.sourceUrl;
              }
            })()}
          </a>
        </div>
      )}

      {/* Feedback Timeline */}
      <div className="mt-6">
        <FeedbackTimeline
          entries={feedback?.entries ?? []}
          currentUserId={user?.id}
          onDelete={handleDeleteFeedback}
          isDeleting={isDeleting}
        />
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap gap-4 print:hidden">
        {instructions.length > 0 && (
          <Button
            variant="primary"
            onClick={() => navigate(`/recipes/${recipeId}/cook`)}
          >
            <PlayIcon className="w-5 h-5 mr-2" />
            Start Cooking
          </Button>
        )}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => setIsShoppingListOpen(true)}
          >
            <ShoppingCartIcon className="w-5 h-5 mr-2" />
            Add to Shopping List
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => window.print()}
        >
          <PrinterIcon className="w-5 h-5 mr-2" />
          Print
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate(`/recipes/${recipeId}/edit`)}
        >
          Edit Recipe
        </Button>
        <Button
          variant="secondary"
          onClick={handleDelete}
          className="text-red-600 hover:bg-red-50"
        >
          Delete
        </Button>
      </div>

      {/* Shopping List Bottom Sheet */}
      {recipe.ingredients && (
        <AddToShoppingListBottomSheet
          isOpen={isShoppingListOpen}
          onClose={() => setIsShoppingListOpen(false)}
          recipeId={recipeId}
          recipeName={recipe.name}
          ingredients={recipe.ingredients}
          originalServings={recipe.servings || 4}
          currentServings={currentServings ?? recipe.servings ?? 4}
        />
      )}

      {/* Add Feedback Bottom Sheet */}
      <AddFeedbackBottomSheet
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        onSubmit={handleAddFeedback}
        recipeName={recipe.name}
        isLoading={isAdding}
      />

      {/* Delete Confirmation Bottom Sheet */}
      <ConfirmDeleteBottomSheet
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={recipe.name}
        itemType="recipe"
        isDeleting={isDeletingRecipe}
        warningMessage="Deleting this recipe will also permanently remove all ingredients, categories, and feedback associated with it."
      />
    </MainLayout>
  );
}

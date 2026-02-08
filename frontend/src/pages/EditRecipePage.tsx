import { useParams, useNavigate } from "react-router";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { MainLayout } from "@/components/templates/MainLayout";
import { RecipeForm } from "@/components/organisms/RecipeForm";
import { useRecipe, useRecipeData } from "@/hooks/recipe/useRecipes";
import type { Recipe } from "@/types/recipe";
import type { RecipeFormSubmitData } from "@/lib/schemas";

export function EditRecipePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recipeId = parseInt(id || "0", 10);

  const { data: recipe, isLoading } = useRecipe(recipeId);
  const { edit } = useRecipeData();

  const handleSubmit = async (data: RecipeFormSubmitData) => {
    try {
      // Convert form data to API format
      const recipeData = {
        name: data.name,
        description: data.description,
        servings: data.servings,
        prepTimeMinutes: typeof data.prepTimeMinutes === "number" ? data.prepTimeMinutes : undefined,
        cookTimeMinutes: typeof data.cookTimeMinutes === "number" ? data.cookTimeMinutes : undefined,
        instructions: JSON.stringify(data.instructions),
        difficulty: data.difficulty,
        cuisine: data.cuisine,
        notes: data.notes,
        ingredients: data.ingredients.map((ing) => ({
          name: ing.name,
          quantity: typeof ing.quantity === "number" ? ing.quantity : undefined,
          unit: ing.unit,
          notes: ing.notes,
        })),
        categories: data.categories?.map((cat) => ({
          type: cat.type,
          value: cat.value,
        })),
      };

      await edit(recipeId, recipeData as Partial<Recipe>);
      navigate(`/recipes/${recipeId}`);
    } catch {
      // Error toast handled by useData hook
    }
  };

  const handleCancel = () => {
    navigate(`/recipes/${recipeId}`);
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Recipe not found
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              The recipe you're trying to edit doesn't exist.
            </p>
            <button
              onClick={() => navigate("/recipes")}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              ← Back to Recipes
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>Back to Recipe</span>
        </button>

        <h1 className="text-3xl font-bold text-gray-900">Edit Recipe</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update the details of your recipe
        </p>
      </div>

      <RecipeForm
        initialData={recipe}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </MainLayout>
  );
}

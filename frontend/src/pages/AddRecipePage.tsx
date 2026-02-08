import { useNavigate } from "react-router";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { MainLayout } from "@/components/templates/MainLayout";
import { RecipeForm } from "@/components/organisms/RecipeForm";
import { useRecipeData } from "@/hooks/recipe/useRecipes";
import type { Recipe } from "@/types/recipe";
import type { RecipeFormSubmitData } from "@/lib/schemas";

export function AddRecipePage() {
  const navigate = useNavigate();
  const { create } = useRecipeData();

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

      const newRecipe = await create(recipeData as Partial<Recipe>);
      navigate(`/recipes/${newRecipe.id}`);
    } catch (error) {
      console.error("Failed to create recipe:", error);
    }
  };

  const handleCancel = () => {
    navigate("/recipes");
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>Back to Recipes</span>
        </button>

        <h1 className="text-3xl font-bold text-gray-900">Add New Recipe</h1>
        <p className="mt-1 text-sm text-gray-500">
          Fill in the details to create a new recipe
        </p>
      </div>

      <RecipeForm onSubmit={handleSubmit} onCancel={handleCancel} />
    </MainLayout>
  );
}

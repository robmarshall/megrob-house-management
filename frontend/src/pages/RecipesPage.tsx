import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { PlusIcon, BookOpenIcon, LinkIcon } from "@heroicons/react/24/outline";
import { MainLayout } from "@/components/templates/MainLayout";
import { EmptyState } from "@/components/molecules/EmptyState";
import ImportRecipeBottomSheet from "@/components/molecules/ImportRecipeBottomSheet";
import { ConfirmDeleteBottomSheet } from "@/components/molecules/ConfirmDeleteBottomSheet";
import { RecipeFilters } from "@/components/organisms/RecipeFilters";
import { Pagination } from "@/components/molecules/Pagination";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Badge } from "@/components/atoms/Badge";
import { useRecipes, useRecipeData, type RecipePaginationOptions } from "@/hooks/recipe/useRecipes";
import type { Recipe } from "@/types/recipe";

const PAGE_SIZE = 12;

export function RecipesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current page from URL, default to 1
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [filters, setFilters] = useState<RecipePaginationOptions>({});
  const { data: recipes, isLoading, error, total } = useRecipes({
    ...filters,
    page: currentPage,
    pageSize: PAGE_SIZE,
  });
  const { delete: deleteRecipe } = useRecipeData();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; recipe: Recipe | null; isDeleting: boolean }>({
    isOpen: false,
    recipe: null,
    isDeleting: false,
  });

  // Calculate total pages
  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : 1;

  // Handle page change
  const handlePageChange = (page: number) => {
    setSearchParams((prev) => {
      if (page === 1) {
        prev.delete('page');
      } else {
        prev.set('page', String(page));
      }
      return prev;
    });
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to page 1 when filters change
  const handleFiltersChange = (newFilters: RecipePaginationOptions) => {
    setFilters(newFilters);
    // Reset to page 1 when filters change
    setSearchParams((prev) => {
      prev.delete('page');
      return prev;
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.favorite ||
    filters.mealType?.length ||
    filters.dietary?.length ||
    filters.allergenFree?.length ||
    filters.cuisine ||
    filters.difficulty;

  const handleOpenRecipe = (recipeId: number) => {
    navigate(`/recipes/${recipeId}`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.recipe) return;
    setDeleteConfirm((prev) => ({ ...prev, isDeleting: true }));
    try {
      await deleteRecipe(deleteConfirm.recipe.id);
      setDeleteConfirm({ isOpen: false, recipe: null, isDeleting: false });
    } catch {
      // Error toast handled by useData hook
      setDeleteConfirm((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const formatTime = (minutes: number | null | undefined) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTotalTime = (recipe: Recipe) => {
    const total = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);
    return total > 0 ? formatTime(total) : null;
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
            <p className="text-sm text-gray-600">Loading recipes...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Failed to load recipes
            </h3>
            <p className="text-sm text-gray-500">{error.message}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recipes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your collection of delicious recipes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsImportOpen(true)}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <LinkIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Import from URL</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button
            onClick={() => navigate("/recipes/new")}
            variant="primary"
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Add Recipe</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <RecipeFilters filters={filters} onFiltersChange={handleFiltersChange} />
      </div>

      {/* Results count */}
      {!isLoading && total !== undefined && total > 0 && (
        <p className="text-sm text-gray-500 mb-4">
          {total} {total === 1 ? "recipe" : "recipes"} found
          {hasActiveFilters && " matching your filters"}
        </p>
      )}

      {recipes.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={<BookOpenIcon className="w-16 h-16" />}
            title="No matching recipes"
            description="Try adjusting your filters or search terms"
            action={{
              label: "Clear Filters",
              onClick: () => setFilters({}),
            }}
          />
        ) : (
          <EmptyState
            icon={<BookOpenIcon className="w-16 h-16" />}
            title="No recipes yet"
            description="Add your first recipe to start building your collection"
            action={{
              label: "Add Your First Recipe",
              onClick: () => navigate("/recipes/new"),
            }}
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <Card
                key={recipe.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleOpenRecipe(recipe.id)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {recipe.name}
                    </h3>
                    {recipe.isFavorite && (
                      <span className="text-yellow-500 ml-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </span>
                    )}
                  </div>

                  {recipe.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {recipe.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    {getTotalTime(recipe) && (
                      <Badge variant="gray">
                        {getTotalTime(recipe)}
                      </Badge>
                    )}
                    {recipe.servings && (
                      <Badge variant="gray">
                        {recipe.servings} servings
                      </Badge>
                    )}
                    {recipe.difficulty && (
                      <Badge
                        variant={
                          recipe.difficulty === "easy"
                            ? "success"
                            : recipe.difficulty === "medium"
                            ? "warning"
                            : "error"
                        }
                      >
                        {recipe.difficulty}
                      </Badge>
                    )}
                  </div>

                  {recipe.cuisine && (
                    <p className="text-xs text-gray-500">
                      {recipe.cuisine}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => navigate("/recipes/new")}
          variant="primary"
          className="rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Add new recipe"
        >
          <PlusIcon className="h-6 w-6" />
        </Button>
      </div>

      {/* Import Recipe Bottom Sheet */}
      <ImportRecipeBottomSheet
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />

      {/* Delete Confirmation Bottom Sheet */}
      <ConfirmDeleteBottomSheet
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, recipe: null, isDeleting: false })}
        onConfirm={handleConfirmDelete}
        itemName={deleteConfirm.recipe?.name || ''}
        itemType="recipe"
        isDeleting={deleteConfirm.isDeleting}
        warningMessage="This will permanently delete the recipe along with all its ingredients, categories, and feedback."
      />
    </MainLayout>
  );
}

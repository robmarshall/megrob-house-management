import { useState } from "react";
import {
  FunnelIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/atoms/Button";
import { Badge } from "@/components/atoms/Badge";
import {
  MEAL_TYPES,
  DIETARY_OPTIONS,
  ALLERGENS,
  categoryLabels,
} from "@/types/recipe";
import type { RecipePaginationOptions } from "@/hooks/recipe/useRecipes";
import { cn } from "@/lib/utils";

interface RecipeFiltersProps {
  filters: RecipePaginationOptions;
  onFiltersChange: (filters: RecipePaginationOptions) => void;
}

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;

const CUISINE_OPTIONS = [
  "Italian",
  "Mexican",
  "Chinese",
  "Japanese",
  "Indian",
  "Thai",
  "French",
  "Mediterranean",
  "American",
  "Korean",
  "Vietnamese",
  "Greek",
  "Middle Eastern",
  "Spanish",
  "British",
] as const;

export function RecipeFilters({ filters, onFiltersChange }: RecipeFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search || "");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ ...filters, search: searchInput.trim() || undefined });
  };

  const handleSearchClear = () => {
    setSearchInput("");
    onFiltersChange({ ...filters, search: undefined });
  };

  const toggleMealType = (mealType: string) => {
    const current = filters.mealType || [];
    const updated = current.includes(mealType)
      ? current.filter((t) => t !== mealType)
      : [...current, mealType];
    onFiltersChange({ ...filters, mealType: updated.length ? updated : undefined });
  };

  const toggleDietary = (dietary: string) => {
    const current = filters.dietary || [];
    const updated = current.includes(dietary)
      ? current.filter((d) => d !== dietary)
      : [...current, dietary];
    onFiltersChange({ ...filters, dietary: updated.length ? updated : undefined });
  };

  const toggleAllergenFree = (allergen: string) => {
    const current = filters.allergenFree || [];
    const updated = current.includes(allergen)
      ? current.filter((a) => a !== allergen)
      : [...current, allergen];
    onFiltersChange({ ...filters, allergenFree: updated.length ? updated : undefined });
  };

  const setDifficulty = (difficulty: string | undefined) => {
    onFiltersChange({
      ...filters,
      difficulty: difficulty as "easy" | "medium" | "hard" | undefined,
    });
  };

  const setCuisine = (cuisine: string | undefined) => {
    onFiltersChange({ ...filters, cuisine });
  };

  const toggleFavorite = () => {
    onFiltersChange({ ...filters, favorite: !filters.favorite });
  };

  const clearAllFilters = () => {
    setSearchInput("");
    onFiltersChange({
      page: filters.page,
      pageSize: filters.pageSize,
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

  const activeFilterCount = [
    filters.search ? 1 : 0,
    filters.favorite ? 1 : 0,
    filters.mealType?.length || 0,
    filters.dietary?.length || 0,
    filters.allergenFree?.length || 0,
    filters.cuisine ? 1 : 0,
    filters.difficulty ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search recipes, ingredients..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <FunnelIcon className="h-5 w-5" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleFavorite}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                filters.favorite
                  ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
              )}
            >
              ⭐ Favorites
            </button>
          </div>

          {/* Meal Type */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Meal Type</h4>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleMealType(type)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-colors",
                    filters.mealType?.includes(type)
                      ? "bg-primary-100 text-primary-700 border border-primary-300"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                  )}
                >
                  {categoryLabels[type] || type}
                </button>
              ))}
            </div>
          </div>

          {/* Dietary */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Dietary</h4>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => toggleDietary(option)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-colors",
                    filters.dietary?.includes(option)
                      ? "bg-green-100 text-green-700 border border-green-300"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                  )}
                >
                  {categoryLabels[option] || option}
                </button>
              ))}
            </div>
          </div>

          {/* Allergen-Free */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Allergen-Free (exclude recipes with)
            </h4>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((allergen) => (
                <button
                  key={allergen}
                  onClick={() => toggleAllergenFree(allergen)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-colors",
                    filters.allergenFree?.includes(allergen)
                      ? "bg-red-100 text-red-700 border border-red-300"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                  )}
                >
                  No {categoryLabels[allergen] || allergen}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Difficulty</h4>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_OPTIONS.map((diff) => (
                <button
                  key={diff}
                  onClick={() =>
                    setDifficulty(filters.difficulty === diff ? undefined : diff)
                  }
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm capitalize transition-colors",
                    filters.difficulty === diff
                      ? diff === "easy"
                        ? "bg-green-100 text-green-700 border border-green-300"
                        : diff === "medium"
                        ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                        : "bg-red-100 text-red-700 border border-red-300"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                  )}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Cuisine */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Cuisine</h4>
            <select
              value={filters.cuisine || ""}
              onChange={(e) => setCuisine(e.target.value || undefined)}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All cuisines</option>
              {CUISINE_OPTIONS.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisine}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Active Filter Tags */}
      {hasActiveFilters && !isExpanded && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="info" className="flex items-center gap-1">
              Search: {filters.search}
              <button
                onClick={() => {
                  setSearchInput("");
                  onFiltersChange({ ...filters, search: undefined });
                }}
                className="ml-1 hover:text-blue-900"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.favorite && (
            <Badge variant="warning" className="flex items-center gap-1">
              Favorites
              <button onClick={toggleFavorite} className="ml-1 hover:text-yellow-900">
                <XMarkIcon className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.mealType?.map((type) => (
            <Badge key={type} variant="default" className="flex items-center gap-1">
              {categoryLabels[type] || type}
              <button
                onClick={() => toggleMealType(type)}
                className="ml-1 hover:text-gray-900"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.dietary?.map((diet) => (
            <Badge key={diet} variant="success" className="flex items-center gap-1">
              {categoryLabels[diet] || diet}
              <button
                onClick={() => toggleDietary(diet)}
                className="ml-1 hover:text-green-900"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.allergenFree?.map((allergen) => (
            <Badge key={allergen} variant="error" className="flex items-center gap-1">
              No {categoryLabels[allergen] || allergen}
              <button
                onClick={() => toggleAllergenFree(allergen)}
                className="ml-1 hover:text-red-900"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.difficulty && (
            <Badge
              variant={
                filters.difficulty === "easy"
                  ? "success"
                  : filters.difficulty === "medium"
                  ? "warning"
                  : "error"
              }
              className="flex items-center gap-1 capitalize"
            >
              {filters.difficulty}
              <button
                onClick={() => setDifficulty(undefined)}
                className="ml-1"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.cuisine && (
            <Badge variant="info" className="flex items-center gap-1">
              {filters.cuisine}
              <button
                onClick={() => setCuisine(undefined)}
                className="ml-1 hover:text-blue-900"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

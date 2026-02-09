import { useState, useEffect } from 'react';
import BottomSheet from '@/components/atoms/BottomSheet';
import { Button } from '@/components/atoms/Button';
import { useRecipes } from '@/hooks/recipe/useRecipes';
import { cn } from '@/lib/utils';
import type { MealType, CreateMealPlanEntryInput } from '@/types/mealPlan';
import { MEAL_TYPES, MEAL_TYPE_LABELS, DAY_SHORT_LABELS } from '@/types/mealPlan';
import type { Recipe } from '@/types/recipe';

type InputMode = 'recipe' | 'custom';

interface AddMealEntryBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateMealPlanEntryInput) => Promise<void>;
  defaultDayOfWeek?: number;
  defaultMealType?: MealType;
}

export default function AddMealEntryBottomSheet({
  isOpen,
  onClose,
  onSubmit,
  defaultDayOfWeek,
  defaultMealType,
}: AddMealEntryBottomSheetProps) {
  const [mode, setMode] = useState<InputMode>('recipe');
  const [selectedDay, setSelectedDay] = useState<number | null>(defaultDayOfWeek ?? null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(defaultMealType ?? null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [customText, setCustomText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: recipes, isLoading: recipesLoading } = useRecipes({
    search: searchTerm,
    pageSize: 10,
  });

  // Reset state when bottom sheet closes
  useEffect(() => {
    if (!isOpen) {
      setMode('recipe');
      setSelectedDay(defaultDayOfWeek ?? null);
      setSelectedMealType(defaultMealType ?? null);
      setSelectedRecipe(null);
      setCustomText('');
      setSearchTerm('');
      setIsSubmitting(false);
    }
  }, [isOpen, defaultDayOfWeek, defaultMealType]);

  const canSubmit =
    selectedDay !== null &&
    selectedMealType !== null &&
    (mode === 'recipe' ? selectedRecipe !== null : customText.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || selectedDay === null || selectedMealType === null) return;

    setIsSubmitting(true);
    try {
      const input: CreateMealPlanEntryInput = {
        dayOfWeek: selectedDay,
        mealType: selectedMealType,
        ...(mode === 'recipe' && selectedRecipe
          ? { recipeId: selectedRecipe.id }
          : { customText: customText.trim() }),
      };
      await onSubmit(input);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Meal">
      <div className="flex flex-col gap-4">
        {/* Mode Toggle */}
        <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setMode('recipe')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'recipe'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Recipe
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'custom'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Custom Text
          </button>
        </div>

        {/* Day Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Day
          </label>
          <div className="flex gap-1">
            {DAY_SHORT_LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setSelectedDay(index)}
                className={cn(
                  'flex-1 rounded-full px-1 py-1.5 text-xs font-medium transition-colors',
                  selectedDay === index
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Meal Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meal Type
          </label>
          <div className="flex gap-2">
            {MEAL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedMealType(type)}
                className={cn(
                  'flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors',
                  selectedMealType === type
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {MEAL_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Recipe Picker */}
        {mode === 'recipe' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Recipes
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            />
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200">
              {recipesLoading && (
                <div className="flex items-center justify-center p-4">
                  <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">Loading recipes...</span>
                </div>
              )}
              {!recipesLoading && recipes.length === 0 && (
                <p className="p-4 text-sm text-gray-500 text-center">
                  {searchTerm ? 'No recipes found.' : 'Start typing to search recipes.'}
                </p>
              )}
              {!recipesLoading &&
                recipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => setSelectedRecipe(recipe)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors border-b border-gray-100 last:border-b-0',
                      selectedRecipe?.id === recipe.id
                        ? 'bg-primary-50 text-primary-700'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    {recipe.imageUrl && (
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.name}
                        className="h-8 w-8 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <span className="text-sm font-medium truncate">
                      {recipe.name}
                    </span>
                  </button>
                ))}
            </div>
            {selectedRecipe && (
              <p className="mt-2 text-sm text-primary-700">
                Selected: <span className="font-medium">{selectedRecipe.name}</span>
              </p>
            )}
          </div>
        )}

        {/* Custom Text Input */}
        {mode === 'custom' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meal Description
            </label>
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="e.g., Leftover pasta, Takeout sushi..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            />
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="button"
          variant="primary"
          disabled={!canSubmit || isSubmitting}
          isLoading={isSubmitting}
          onClick={handleSubmit}
          className="w-full"
        >
          Add Meal
        </Button>
      </div>
    </BottomSheet>
  );
}

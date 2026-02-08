import { useState, useEffect } from "react";
import { CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import BottomSheet from "@/components/atoms/BottomSheet";
import { Button } from "@/components/atoms/Button";
import { useShoppingLists } from "@/hooks/shoppingList/useShoppingLists";
import { useRecipeData } from "@/hooks/recipe/useRecipes";
import type { RecipeIngredient } from "@/types/recipe";
import { cn } from "@/lib/utils";
import { scaleQuantity } from "./ServingScaler";

interface AddToShoppingListBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: number;
  recipeName: string;
  ingredients: RecipeIngredient[];
  originalServings: number;
  currentServings: number;
}

export default function AddToShoppingListBottomSheet({
  isOpen,
  onClose,
  recipeId,
  recipeName: _recipeName,
  ingredients,
  originalServings,
  currentServings,
}: AddToShoppingListBottomSheetProps) {
  const { data: shoppingLists, isLoading: isLoadingLists } = useShoppingLists();
  const { addToShoppingList, isAddingToShoppingList } = useRecipeData();

  // Selection state
  const [selectedIngredients, setSelectedIngredients] = useState<Set<number>>(
    new Set()
  );
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [newListName, setNewListName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calculate multiplier
  const multiplier = currentServings / originalServings;

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      // Select all ingredients by default
      setSelectedIngredients(new Set(ingredients.map((ing) => ing.id)));
      setSelectedListId(null);
      setNewListName("");
      setIsCreatingNew(false);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, ingredients]);

  const toggleIngredient = (id: number) => {
    setSelectedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIngredients(new Set(ingredients.map((ing) => ing.id)));
  };

  const deselectAll = () => {
    setSelectedIngredients(new Set());
  };

  const handleSubmit = async () => {
    setError(null);

    if (selectedIngredients.size === 0) {
      setError("Please select at least one ingredient");
      return;
    }

    if (!selectedListId && !newListName.trim()) {
      setError("Please select a list or enter a name for a new list");
      return;
    }

    try {
      await addToShoppingList({
        recipeId,
        shoppingListId: selectedListId || undefined,
        newListName: isCreatingNew ? newListName.trim() : undefined,
        ingredientIds: Array.from(selectedIngredients),
        servingMultiplier: multiplier,
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      if (err && typeof err === "object" && "message" in err) {
        setError((err as { message: string }).message);
      } else {
        setError("Failed to add ingredients. Please try again.");
      }
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={`Add to Shopping List`}
    >
      <div className="flex flex-col gap-4 flex-1 overflow-hidden">
        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckIcon className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-lg font-medium text-gray-900">
              Added to shopping list!
            </p>
            <p className="text-sm text-gray-500">
              {selectedIngredients.size} ingredients added
            </p>
          </div>
        ) : (
          <>
            {/* Ingredients selection */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Select Ingredients
                </h3>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto border rounded-lg divide-y">
                {ingredients.map((ing) => {
                  const isSelected = selectedIngredients.has(ing.id);
                  const scaledQty = scaleQuantity(ing.quantity, multiplier);

                  return (
                    <label
                      key={ing.id}
                      className={cn(
                        "flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors",
                        isSelected && "bg-primary-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleIngredient(ing.id)}
                        className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                      />
                      <span className="flex-1 text-sm">
                        {scaledQty && (
                          <span className="font-medium">{scaledQty} </span>
                        )}
                        {ing.unit && <span>{ing.unit} </span>}
                        {ing.name}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {selectedIngredients.size} of {ingredients.length} selected
                {multiplier !== 1 && ` (scaled for ${currentServings} servings)`}
              </p>
            </div>

            {/* List selection */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Choose Shopping List
              </h3>

              {isLoadingLists ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Existing lists */}
                  {shoppingLists && shoppingLists.length > 0 && !isCreatingNew && (
                    <div className="grid grid-cols-2 gap-2">
                      {shoppingLists.map((list) => (
                        <button
                          key={list.id}
                          type="button"
                          onClick={() => setSelectedListId(list.id)}
                          className={cn(
                            "p-3 rounded-lg border text-left transition-colors",
                            selectedListId === list.id
                              ? "border-primary-500 bg-primary-50 text-primary-700"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <p className="font-medium text-sm truncate">
                            {list.name}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Create new list */}
                  {!isCreatingNew ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNew(true);
                        setSelectedListId(null);
                      }}
                      className="flex items-center gap-2 w-full p-3 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-primary-500 hover:text-primary-600 transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                      <span className="text-sm">Create new list</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="Enter list name..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNew(false);
                          setNewListName("");
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel and choose existing list
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isAddingToShoppingList}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                disabled={
                  selectedIngredients.size === 0 ||
                  (!selectedListId && !newListName.trim()) ||
                  isAddingToShoppingList
                }
                isLoading={isAddingToShoppingList}
                className="flex-1"
              >
                Add to List
              </Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

import { useForm, FormProvider, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Input } from "@/components/atoms/Input";
import { Textarea } from "@/components/atoms/Textarea";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { IngredientInput } from "@/components/molecules/IngredientInput";
import { CategoryPicker } from "@/components/molecules/CategoryPicker";
import {
  createRecipeSchema,
  type CreateRecipeFormData,
  type RecipeFormSubmitData,
} from "@/lib/schemas";
import type { Recipe, RecipeCategoryType } from "@/types/recipe";
import { cn } from "@/lib/utils";

interface RecipeFormProps {
  initialData?: Partial<Recipe>;
  onSubmit: (data: RecipeFormSubmitData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const DIFFICULTY_OPTIONS = [
  { value: "", label: "Select difficulty" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const CUISINE_OPTIONS = [
  "",
  "Italian",
  "Mexican",
  "Asian",
  "Indian",
  "American",
  "French",
  "Mediterranean",
  "Japanese",
  "Chinese",
  "Thai",
  "Greek",
  "Middle Eastern",
  "Other",
];

export function RecipeForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: RecipeFormProps) {
  // Parse existing data if editing
  const parseInstructions = (instructions?: string): { step: string }[] => {
    if (!instructions) return [{ step: "" }];
    try {
      const parsed = JSON.parse(instructions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s: string) => ({ step: s }));
      }
      return [{ step: "" }];
    } catch {
      const lines = instructions.split("\n").filter((s) => s.trim());
      return lines.length > 0 ? lines.map((s) => ({ step: s })) : [{ step: "" }];
    }
  };

  const parseCategories = (
    categories?: Array<{ categoryType: string; categoryValue: string }>
  ): Array<{ type: RecipeCategoryType; value: string }> => {
    if (!categories) return [];
    return categories.map((c) => ({
      type: c.categoryType as RecipeCategoryType,
      value: c.categoryValue,
    }));
  };

  const methods = useForm<CreateRecipeFormData>({
    resolver: zodResolver(createRecipeSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      servings: initialData?.servings || 4,
      prepTimeMinutes: initialData?.prepTimeMinutes || "",
      cookTimeMinutes: initialData?.cookTimeMinutes || "",
      difficulty: (initialData?.difficulty as "easy" | "medium" | "hard") || undefined,
      cuisine: initialData?.cuisine || "",
      notes: initialData?.notes || "",
      ingredients: initialData?.ingredients?.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity ? parseFloat(ing.quantity) : undefined,
        unit: ing.unit || undefined,
        notes: ing.notes || undefined,
      })) || [{ name: "", quantity: undefined, unit: undefined, notes: undefined }],
      instructions: parseInstructions(initialData?.instructions),
      categories: parseCategories(initialData?.categories),
    },
  });

  const {
    fields: ingredientFields,
    append: appendIngredient,
    remove: removeIngredient,
  } = useFieldArray({
    control: methods.control,
    name: "ingredients",
  });

  const {
    fields: instructionFields,
    append: appendInstruction,
    remove: removeInstruction,
  } = useFieldArray({
    control: methods.control,
    name: "instructions",
  });

  const handleFormSubmit = async (data: CreateRecipeFormData) => {
    // Clean up empty values and transform instructions to string array for API
    const cleanedData: RecipeFormSubmitData = {
      ...data,
      prepTimeMinutes: data.prepTimeMinutes || undefined,
      cookTimeMinutes: data.cookTimeMinutes || undefined,
      ingredients: data.ingredients.map((ing) => ({
        ...ing,
        quantity: ing.quantity || undefined,
        unit: ing.unit || undefined,
        notes: ing.notes || undefined,
      })),
      // Convert { step: string }[] to string[] for API
      instructions: data.instructions
        .map((inst) => inst.step)
        .filter((s) => s.trim()),
    };
    await onSubmit(cleanedData);
  };

  const isSubmitting = methods.formState.isSubmitting || isLoading;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(handleFormSubmit)}
        className="space-y-6"
      >
        {/* Basic Info */}
        <Card>
          <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

            <Input
              name="name"
              label="Recipe Name"
              placeholder="Enter recipe name"
              required
              disabled={isSubmitting}
            />

            <Textarea
              name="description"
              label="Description"
              placeholder="Brief description of the recipe"
              rows={3}
              disabled={isSubmitting}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Servings
                </label>
                <Controller
                  name="servings"
                  control={methods.control}
                  render={({ field, fieldState }) => (
                    <>
                      <input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 4)}
                        disabled={isSubmitting}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border bg-white",
                          "focus:outline-none focus:ring-2 focus:ring-primary-500",
                          "disabled:bg-gray-100 disabled:cursor-not-allowed",
                          fieldState.error ? "border-red-500" : "border-gray-300"
                        )}
                      />
                      {fieldState.error && (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldState.error.message}
                        </p>
                      )}
                    </>
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prep Time (min)
                </label>
                <Controller
                  name="prepTimeMinutes"
                  control={methods.control}
                  render={({ field }) => (
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={field.value || ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseInt(e.target.value) : ""
                        )
                      }
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cook Time (min)
                </label>
                <Controller
                  name="cookTimeMinutes"
                  control={methods.control}
                  render={({ field }) => (
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={field.value || ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseInt(e.target.value) : ""
                        )
                      }
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty
                </label>
                <Controller
                  name="difficulty"
                  control={methods.control}
                  render={({ field }) => (
                    <select
                      {...field}
                      value={field.value || ""}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      {DIFFICULTY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cuisine
              </label>
              <Controller
                name="cuisine"
                control={methods.control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value || ""}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select cuisine (optional)</option>
                    {CUISINE_OPTIONS.filter(Boolean).map((cuisine) => (
                      <option key={cuisine} value={cuisine}>
                        {cuisine}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
          </div>
        </Card>

        {/* Ingredients */}
        <Card>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  appendIngredient({ name: "", quantity: undefined, unit: undefined, notes: undefined })
                }
                disabled={isSubmitting}
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Ingredient
              </Button>
            </div>

            {methods.formState.errors.ingredients?.message && (
              <p className="text-sm text-red-600">
                {methods.formState.errors.ingredients.message}
              </p>
            )}

            <div className="space-y-3">
              {ingredientFields.map((field, index) => (
                <Controller
                  key={field.id}
                  name={`ingredients.${index}`}
                  control={methods.control}
                  render={({ field: controllerField, fieldState }) => (
                    <IngredientInput
                      index={index}
                      value={controllerField.value}
                      onChange={controllerField.onChange}
                      onRemove={() => removeIngredient(index)}
                      error={fieldState.error?.message}
                      disabled={isSubmitting}
                    />
                  )}
                />
              ))}
            </div>
          </div>
        </Card>

        {/* Instructions */}
        <Card>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Instructions</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => appendInstruction({ step: "" })}
                disabled={isSubmitting}
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Step
              </Button>
            </div>

            {methods.formState.errors.instructions?.message && (
              <p className="text-sm text-red-600">
                {methods.formState.errors.instructions.message}
              </p>
            )}

            <div className="space-y-3">
              {instructionFields.map((field, index) => (
                <Controller
                  key={field.id}
                  name={`instructions.${index}.step`}
                  control={methods.control}
                  render={({ field: controllerField, fieldState }) => (
                    <div className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm mt-2">
                        {index + 1}
                      </span>
                      <textarea
                        {...controllerField}
                        placeholder={`Step ${index + 1}`}
                        rows={2}
                        disabled={isSubmitting}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg border bg-white",
                          "focus:outline-none focus:ring-2 focus:ring-primary-500",
                          "disabled:bg-gray-100 disabled:cursor-not-allowed",
                          "resize-none",
                          fieldState.error ? "border-red-500" : "border-gray-300"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => removeInstruction(index)}
                        disabled={isSubmitting || instructionFields.length <= 1}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Remove step ${index + 1}`}
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                />
              ))}
            </div>
          </div>
        </Card>

        {/* Categories */}
        <Card>
          <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Categories & Tags</h2>

            <Controller
              name="categories"
              control={methods.control}
              render={({ field }) => (
                <CategoryPicker
                  selectedCategories={field.value || []}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Notes</h2>

            <Textarea
              name="notes"
              label=""
              placeholder="Add any additional notes, tips, or variations..."
              rows={4}
              disabled={isSubmitting}
            />
          </div>
        </Card>

        {/* Form Actions */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {initialData?.id ? "Save Changes" : "Create Recipe"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

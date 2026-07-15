import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { recipeIngredients, recipeCategories } from '../db/schema.js';

/**
 * Drizzle transaction handle type, derived from the callback argument passed to
 * `db.transaction(async (tx) => ...)`. Using this keeps the helper usable with
 * whatever transaction implementation the singleton `db` provides.
 */
export type RecipeTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RecipeIngredientInput {
  name: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

export interface RecipeCategoryInput {
  type: string;
  value: string;
}

export interface ReplaceRecipeRelationsInput {
  ingredients?: RecipeIngredientInput[];
  categories?: RecipeCategoryInput[];
}

/**
 * Replace a recipe's child rows (ingredients and/or categories) atomically,
 * using the provided transaction handle `tx`.
 *
 * Each relation is only touched when its input is provided (defined and an
 * array). This mirrors the original inline delete-then-insert logic exactly,
 * but by running inside the caller's transaction a failure rolls back the
 * delete instead of silently leaving the recipe with zero child rows.
 */
export async function replaceRecipeRelations(
  tx: RecipeTx,
  recipeId: number,
  { ingredients, categories }: ReplaceRecipeRelationsInput
): Promise<void> {
  // Replace ingredients if provided
  if (ingredients !== undefined && Array.isArray(ingredients)) {
    // Delete existing ingredients
    await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));

    // Insert new ingredients
    if (ingredients.length > 0) {
      await tx.insert(recipeIngredients).values(
        ingredients.map((ing, index) => ({
          recipeId,
          name: ing.name,
          quantity: ing.quantity?.toString() || null,
          unit: ing.unit || null,
          notes: ing.notes || null,
          position: index,
        }))
      );
    }
  }

  // Replace categories if provided
  if (categories !== undefined && Array.isArray(categories)) {
    // Delete existing categories
    await tx.delete(recipeCategories).where(eq(recipeCategories.recipeId, recipeId));

    // Insert new categories
    if (categories.length > 0) {
      await tx.insert(recipeCategories).values(
        categories.map((cat) => ({
          recipeId,
          categoryType: cat.type,
          categoryValue: cat.value,
        }))
      );
    }
  }
}

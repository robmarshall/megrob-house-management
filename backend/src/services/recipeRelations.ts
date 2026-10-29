import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { recipeIngredients, recipeCategories } from '../db/schema.js';
import { RECIPE_MEAL_TYPES } from '../lib/validation.js';

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
    const normalized = normalizeCategoryInputs(categories);
    if (normalized.length > 0) {
      await tx.insert(recipeCategories).values(
        normalized.map((cat) => ({
          recipeId,
          categoryType: cat.type,
          categoryValue: cat.value,
        }))
      );
    }
  }
}

const MEAL_TYPE_SET = new Set<string>(RECIPE_MEAL_TYPES);

/**
 * Tidy category inputs before they're stored:
 * - a meal_type outside the fixed list becomes a tag, since the app has no
 *   meal-type filter for it (this is how "Camping" went missing from filters);
 * - tag whitespace (and any commas) is collapsed;
 * - duplicates are dropped, case-insensitively for tags ("Camping" vs
 *   "camping"), so the unique constraint can't reject the whole save.
 */
export function normalizeCategoryInputs(
  categories: RecipeCategoryInput[]
): RecipeCategoryInput[] {
  const seen = new Set<string>();
  const result: RecipeCategoryInput[] = [];
  for (const cat of categories) {
    let { type, value } = cat;
    value = value.trim();
    if (type === 'meal_type' && !MEAL_TYPE_SET.has(value.toLowerCase())) {
      type = 'tag';
    }
    // Commas are stripped too: the list endpoint takes tags comma-separated.
    if (type === 'tag') value = value.replace(/[,\s]+/g, ' ').trim();
    if (!value) continue;

    const key = `${type}:${type === 'tag' ? value.toLowerCase() : value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ type, value });
  }
  return result;
}

/**
 * Meal plan service: week-scoped plan retrieval, entry mutations, and
 * generating shopping lists from a plan's recipes. Shared by the REST
 * routes and the MCP tools.
 */

import { eq, and, or, isNull, asc, inArray, SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  mealPlans,
  mealPlanEntries,
  recipes,
  recipeIngredients,
  recipeNutrition,
  shoppingLists,
  shoppingListItems,
} from '../db/schema.js';
import { getUserHouseholdId } from '../lib/household.js';
import { verifyShoppingListAccess } from '../lib/shoppingListAccess.js';
import { addOrMergeItems, type AddItemInput } from './shoppingListItemService.js';
import { resolveItemCategories } from './categoryService.js';

type MealPlanRow = typeof mealPlans.$inferSelect;
type MealPlanEntryRow = typeof mealPlanEntries.$inferSelect;
type ShoppingListRow = typeof shoppingLists.$inferSelect;
type ShoppingListItemRow = typeof shoppingListItems.$inferSelect;

/** Per-serving nutrition of an entry's linked recipe (ready rows only). */
export interface EntryNutrition {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  estimated: boolean;
}

export interface MealPlanEntryWithRecipe extends MealPlanEntryRow {
  recipeName: string | null;
  recipeImageUrl: string | null;
  /** Null for custom-text entries and recipes not yet enriched */
  nutrition: EntryNutrition | null;
}

export interface MealPlanWithEntries extends MealPlanRow {
  entries: MealPlanEntryWithRecipe[];
}

/**
 * Household/personal access filter for meal plans. A user has access if the
 * plan belongs to their household, or is a personal plan they created.
 */
export async function buildMealPlanAccessFilter(userId: string): Promise<SQL> {
  const householdId = await getUserHouseholdId(userId);

  if (householdId) {
    return or(
      eq(mealPlans.householdId, householdId),
      and(eq(mealPlans.createdBy, userId), isNull(mealPlans.householdId))
    )!;
  }

  return eq(mealPlans.createdBy, userId);
}

/**
 * Verify meal plan access (household or personal ownership).
 * Returns the meal plan if the user has access, null otherwise.
 */
export async function verifyMealPlanAccess(
  mealPlanId: number,
  userId: string
): Promise<MealPlanRow | null> {
  const accessFilter = await buildMealPlanAccessFilter(userId);

  const [plan] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.id, mealPlanId), accessFilter));

  return plan ?? null;
}

/**
 * Verify recipe access (household or personal ownership).
 * Returns the recipe if the user has access, null otherwise.
 */
export async function verifyRecipeAccess(recipeId: number, userId: string) {
  const householdId = await getUserHouseholdId(userId);

  let accessFilter: SQL;
  if (householdId) {
    accessFilter = or(
      eq(recipes.householdId, householdId),
      and(eq(recipes.createdBy, userId), isNull(recipes.householdId))
    )!;
  } else {
    accessFilter = eq(recipes.createdBy, userId);
  }

  const [recipe] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), accessFilter));

  return recipe ?? null;
}

/**
 * Entries for one plan, joined with recipe name/image and per-serving
 * nutrition (when the recipe has a completed enrichment), in display order.
 */
export async function getMealPlanEntries(
  mealPlanId: number
): Promise<MealPlanEntryWithRecipe[]> {
  const rows = await db
    .select({
      id: mealPlanEntries.id,
      mealPlanId: mealPlanEntries.mealPlanId,
      dayOfWeek: mealPlanEntries.dayOfWeek,
      mealType: mealPlanEntries.mealType,
      recipeId: mealPlanEntries.recipeId,
      customText: mealPlanEntries.customText,
      position: mealPlanEntries.position,
      createdAt: mealPlanEntries.createdAt,
      recipeName: recipes.name,
      recipeImageUrl: recipes.imageUrl,
      nutritionStatus: recipeNutrition.status,
      nutritionCalories: recipeNutrition.caloriesKcal,
      nutritionProtein: recipeNutrition.proteinG,
      nutritionCarbs: recipeNutrition.carbsG,
      nutritionFat: recipeNutrition.fatG,
      nutritionEstimated: recipeNutrition.estimated,
    })
    .from(mealPlanEntries)
    .leftJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
    .leftJoin(recipeNutrition, eq(mealPlanEntries.recipeId, recipeNutrition.recipeId))
    .where(eq(mealPlanEntries.mealPlanId, mealPlanId))
    .orderBy(asc(mealPlanEntries.dayOfWeek), asc(mealPlanEntries.position));

  const toNum = (value: string | null) =>
    value === null ? null : parseFloat(value);

  return rows.map(
    ({
      nutritionStatus,
      nutritionCalories,
      nutritionProtein,
      nutritionCarbs,
      nutritionFat,
      nutritionEstimated,
      ...entry
    }) => ({
      ...entry,
      nutrition:
        nutritionStatus === 'ready'
          ? {
              caloriesKcal: toNum(nutritionCalories),
              proteinG: toNum(nutritionProtein),
              carbsG: toNum(nutritionCarbs),
              fatG: toNum(nutritionFat),
              estimated: nutritionEstimated ?? false,
            }
          : null,
    })
  );
}

/** Recipe name/image for one entry, when a recipe is linked. */
async function withRecipeInfo(
  entry: MealPlanEntryRow
): Promise<MealPlanEntryWithRecipe> {
  let recipeName: string | null = null;
  let recipeImageUrl: string | null = null;

  if (entry.recipeId) {
    const [recipeData] = await db
      .select({ name: recipes.name, imageUrl: recipes.imageUrl })
      .from(recipes)
      .where(eq(recipes.id, entry.recipeId));
    if (recipeData) {
      recipeName = recipeData.name;
      recipeImageUrl = recipeData.imageUrl;
    }
  }

  // Nutrition is deliberately not fetched here: this shape is used for
  // just-mutated single entries, where the caller re-fetches the full plan
  // (with nutrition) to render.
  return { ...entry, recipeName, recipeImageUrl, nutrition: null };
}

/**
 * The meal plan for a given week (weekStartDate, the Monday), with entries.
 * Returns null when no plan exists for that week in the user's scope.
 */
export async function getMealPlanForWeek(
  userId: string,
  weekStartDate: string
): Promise<MealPlanWithEntries | null> {
  const accessFilter = await buildMealPlanAccessFilter(userId);

  const [plan] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.weekStartDate, weekStartDate), accessFilter));

  if (!plan) return null;

  return { ...plan, entries: await getMealPlanEntries(plan.id) };
}

/**
 * Find the plan for a week, creating an empty one when none exists.
 * Handles the create race via the partial unique indexes on
 * (week, user) / (week, household): the loser re-reads the winner's row.
 */
export async function getOrCreateMealPlanForWeek(
  userId: string,
  weekStartDate: string,
  name?: string
): Promise<{ plan: MealPlanRow; created: boolean }> {
  const accessFilter = await buildMealPlanAccessFilter(userId);

  const [existing] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.weekStartDate, weekStartDate), accessFilter));

  if (existing) return { plan: existing, created: false };

  const householdId = await getUserHouseholdId(userId);

  try {
    const [created] = await db
      .insert(mealPlans)
      .values({
        name: name || null,
        weekStartDate,
        householdId,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();
    return { plan: created, created: true };
  } catch (err) {
    const [winner] = await db
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.weekStartDate, weekStartDate), accessFilter));
    if (winner) return { plan: winner, created: false };
    throw err;
  }
}

export interface AddEntryInput {
  dayOfWeek: number;
  mealType: string;
  recipeId?: number | null;
  customText?: string | null;
  position?: number;
}

export interface UpdateEntryInput {
  dayOfWeek?: number;
  mealType?: string;
  recipeId?: number | null;
  customText?: string | null;
  position?: number;
}

export type EntryMutationResult =
  | { ok: true; entry: MealPlanEntryWithRecipe }
  | {
      ok: false;
      reason:
        | 'plan_not_found'
        | 'entry_not_found'
        | 'entry_not_in_plan'
        | 'recipe_not_found';
    };

/**
 * Add an entry to a meal plan the user can access. When no position is
 * given the entry is appended after existing entries in the same slot.
 */
export async function addEntryToPlan(
  userId: string,
  mealPlanId: number,
  input: AddEntryInput
): Promise<EntryMutationResult> {
  const plan = await verifyMealPlanAccess(mealPlanId, userId);
  if (!plan) return { ok: false, reason: 'plan_not_found' };

  const { dayOfWeek, mealType, recipeId, customText, position } = input;

  if (recipeId) {
    const recipe = await verifyRecipeAccess(recipeId, userId);
    if (!recipe) return { ok: false, reason: 'recipe_not_found' };
  }

  let entryPosition = position;
  if (entryPosition === undefined) {
    const existingEntries = await db
      .select({ position: mealPlanEntries.position })
      .from(mealPlanEntries)
      .where(
        and(
          eq(mealPlanEntries.mealPlanId, mealPlanId),
          eq(mealPlanEntries.dayOfWeek, dayOfWeek),
          eq(mealPlanEntries.mealType, mealType)
        )
      )
      .orderBy(asc(mealPlanEntries.position));

    entryPosition =
      existingEntries.length > 0
        ? Math.max(...existingEntries.map((e) => e.position)) + 1
        : 0;
  }

  const [newEntry] = await db
    .insert(mealPlanEntries)
    .values({
      mealPlanId,
      dayOfWeek,
      mealType,
      recipeId: recipeId || null,
      customText: customText || null,
      position: entryPosition,
    })
    .returning();

  return { ok: true, entry: await withRecipeInfo(newEntry) };
}

/**
 * Partial update of one entry. Only fields passed as non-undefined change.
 * Also bumps the parent plan's updatedAt/updatedBy.
 */
export async function updateEntry(
  userId: string,
  mealPlanId: number,
  entryId: number,
  input: UpdateEntryInput
): Promise<EntryMutationResult> {
  const plan = await verifyMealPlanAccess(mealPlanId, userId);
  if (!plan) return { ok: false, reason: 'plan_not_found' };

  const [existingEntry] = await db
    .select()
    .from(mealPlanEntries)
    .where(eq(mealPlanEntries.id, entryId));

  if (!existingEntry) return { ok: false, reason: 'entry_not_found' };
  if (existingEntry.mealPlanId !== mealPlanId) {
    return { ok: false, reason: 'entry_not_in_plan' };
  }

  const { dayOfWeek, mealType, recipeId, customText, position } = input;

  if (recipeId !== undefined && recipeId !== null) {
    const recipe = await verifyRecipeAccess(recipeId, userId);
    if (!recipe) return { ok: false, reason: 'recipe_not_found' };
  }

  const [updatedEntry] = await db
    .update(mealPlanEntries)
    .set({
      dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : existingEntry.dayOfWeek,
      mealType: mealType !== undefined ? mealType : existingEntry.mealType,
      recipeId: recipeId !== undefined ? recipeId : existingEntry.recipeId,
      customText:
        customText !== undefined ? customText : existingEntry.customText,
      position: position !== undefined ? position : existingEntry.position,
    })
    .where(eq(mealPlanEntries.id, entryId))
    .returning();

  await db
    .update(mealPlans)
    .set({ updatedBy: userId, updatedAt: new Date() })
    .where(eq(mealPlans.id, mealPlanId));

  return { ok: true, entry: await withRecipeInfo(updatedEntry) };
}

/**
 * Remove one entry from a plan the user can access.
 * Also bumps the parent plan's updatedAt/updatedBy.
 */
export async function removeEntry(
  userId: string,
  mealPlanId: number,
  entryId: number
): Promise<EntryMutationResult> {
  const plan = await verifyMealPlanAccess(mealPlanId, userId);
  if (!plan) return { ok: false, reason: 'plan_not_found' };

  const [existingEntry] = await db
    .select()
    .from(mealPlanEntries)
    .where(eq(mealPlanEntries.id, entryId));

  if (!existingEntry) return { ok: false, reason: 'entry_not_found' };
  if (existingEntry.mealPlanId !== mealPlanId) {
    return { ok: false, reason: 'entry_not_in_plan' };
  }

  await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, entryId));

  await db
    .update(mealPlans)
    .set({ updatedBy: userId, updatedAt: new Date() })
    .where(eq(mealPlans.id, mealPlanId));

  return {
    ok: true,
    entry: {
      ...existingEntry,
      recipeName: null,
      recipeImageUrl: null,
      nutrition: null,
    },
  };
}

export interface ToShoppingListInput {
  shoppingListId?: number;
  newListName?: string;
}

export type ToShoppingListResult =
  | {
      ok: true;
      list: ShoppingListRow;
      items: ShoppingListItemRow[];
      addedCount: number;
      mergedCount: number;
      totalIngredients: number;
    }
  | {
      ok: false;
      reason:
        | 'plan_not_found'
        | 'no_recipes'
        | 'no_ingredients'
        | 'list_not_found'
        | 'missing_target';
    };

/**
 * Gather all ingredients from recipes linked in the plan's entries and add
 * them to a shopping list (existing or newly created) with add-or-merge
 * logic. Quantities scale by how many times a recipe appears in the plan.
 */
export async function mealPlanToShoppingList(
  userId: string,
  mealPlanId: number,
  { shoppingListId, newListName }: ToShoppingListInput
): Promise<ToShoppingListResult> {
  const plan = await verifyMealPlanAccess(mealPlanId, userId);
  if (!plan) return { ok: false, reason: 'plan_not_found' };

  const entriesWithRecipes = await db
    .select({ recipeId: mealPlanEntries.recipeId })
    .from(mealPlanEntries)
    .where(eq(mealPlanEntries.mealPlanId, mealPlanId));

  const recipeIds = entriesWithRecipes
    .map((e) => e.recipeId)
    .filter((id): id is number => id !== null);

  if (recipeIds.length === 0) return { ok: false, reason: 'no_recipes' };

  // A recipe may appear multiple times in a week
  const uniqueRecipeIds = [...new Set(recipeIds)];

  const ingredients = await db
    .select({
      recipeId: recipeIngredients.recipeId,
      name: recipeIngredients.name,
      quantity: recipeIngredients.quantity,
      unit: recipeIngredients.unit,
      notes: recipeIngredients.notes,
    })
    .from(recipeIngredients)
    .where(inArray(recipeIngredients.recipeId, uniqueRecipeIds))
    .orderBy(asc(recipeIngredients.position));

  if (ingredients.length === 0) return { ok: false, reason: 'no_ingredients' };

  // Count how many times each recipe appears in the plan (for quantity scaling)
  const recipeCountMap = new Map<number, number>();
  for (const rid of recipeIds) {
    recipeCountMap.set(rid, (recipeCountMap.get(rid) || 0) + 1);
  }

  const recipeRows = await db
    .select({ id: recipes.id, name: recipes.name })
    .from(recipes)
    .where(inArray(recipes.id, uniqueRecipeIds));
  const recipeNameMap = new Map(recipeRows.map((r) => [r.id, r.name]));

  const householdId = await getUserHouseholdId(userId);
  let targetListId: number;

  if (newListName) {
    const planLabel = plan.name || `Week of ${plan.weekStartDate}`;
    const [newList] = await db
      .insert(shoppingLists)
      .values({
        name: newListName,
        description: `Ingredients from meal plan: ${planLabel}`,
        householdId,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();
    targetListId = newList.id;
  } else if (shoppingListId) {
    const existingList = await verifyShoppingListAccess(shoppingListId, userId);
    if (!existingList) return { ok: false, reason: 'list_not_found' };
    targetListId = shoppingListId;
  } else {
    return { ok: false, reason: 'missing_target' };
  }

  // Build item inputs, scaling quantity by the number of times the recipe appears
  const itemInputs: AddItemInput[] = ingredients.map((ing) => {
    const count = recipeCountMap.get(ing.recipeId) || 1;
    let quantity = ing.quantity || '1';

    if (count > 1) {
      const numericQty = parseFloat(quantity);
      if (!isNaN(numericQty)) {
        quantity = (numericQty * count).toString();
      }
    }

    const recipeName = recipeNameMap.get(ing.recipeId) || 'Unknown recipe';

    return {
      listId: targetListId,
      name: ing.name,
      quantity,
      unit: ing.unit,
      notes: ing.notes ? `${ing.notes} (from ${recipeName})` : `From ${recipeName}`,
      createdBy: userId,
      updatedBy: userId,
    };
  });

  // Auto-categorize (learned memory, then keyword dictionary), then add
  // items with automatic merging of duplicates
  const results = await addOrMergeItems(
    await resolveItemCategories(userId, itemInputs)
  );
  const mergedCount = results.filter((r) => r.merged).length;
  const addedCount = results.filter((r) => !r.merged).length;

  const [updatedList] = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.id, targetListId));

  const listItems = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.listId, targetListId))
    .orderBy(asc(shoppingListItems.position));

  return {
    ok: true,
    list: updatedList,
    items: listItems,
    addedCount,
    mergedCount,
    totalIngredients: ingredients.length,
  };
}

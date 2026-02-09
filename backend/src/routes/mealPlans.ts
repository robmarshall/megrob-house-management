import { Hono } from 'hono';
import { eq, and, or, isNull, asc, SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mealPlans, mealPlanEntries, recipes, recipeIngredients, shoppingLists, shoppingListItems } from '../db/schema.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';
import { validateBody, getValidatedBody } from '../middleware/validation.js';
import { logger } from '../lib/logger.js';
import { getUserHouseholdId } from '../lib/household.js';
import {
  createMealPlanSchema,
  updateMealPlanSchema,
  createMealPlanEntrySchema,
  updateMealPlanEntrySchema,
  copyMealPlanSchema,
  mealPlanToShoppingListSchema,
  type CreateMealPlanInput,
  type UpdateMealPlanInput,
  type CreateMealPlanEntryInput,
  type UpdateMealPlanEntryInput,
  type CopyMealPlanInput,
  type MealPlanToShoppingListInput,
} from '../lib/validation.js';
import { addOrMergeItems, type AddItemInput } from '../services/shoppingListItemService.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper to verify recipe access (household or personal ownership).
 * Returns the recipe if the user has access, null otherwise.
 */
async function verifyRecipeAccess(recipeId: number, userId: string) {
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
 * Helper to verify shopping list access (household or personal ownership).
 * Returns the list if the user has access, null otherwise.
 */
async function verifyListAccess(listId: number, userId: string) {
  const householdId = await getUserHouseholdId(userId);

  let accessFilter: SQL;
  if (householdId) {
    accessFilter = or(
      eq(shoppingLists.householdId, householdId),
      and(eq(shoppingLists.createdBy, userId), isNull(shoppingLists.householdId))
    )!;
  } else {
    accessFilter = eq(shoppingLists.createdBy, userId);
  }

  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, listId), accessFilter));

  return list ?? null;
}

/**
 * Helper to build the household/personal access filter for meal plans.
 * A user has access if:
 *   - The meal plan belongs to their household, OR
 *   - The meal plan is a personal plan (no household) created by them
 */
async function buildAccessFilter(userId: string): Promise<SQL> {
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
 * Helper to verify meal plan access (household or personal ownership).
 * Returns the meal plan if the user has access, null otherwise.
 */
async function verifyMealPlanAccess(mealPlanId: number, userId: string) {
  const accessFilter = await buildAccessFilter(userId);

  const [plan] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.id, mealPlanId), accessFilter));

  return plan ?? null;
}

/**
 * GET /api/meal-plans
 * Get the meal plan for a specific week.
 *
 * Query Parameters:
 * - week: YYYY-MM-DD string for the week start date (required)
 *
 * Returns the meal plan with its entries (joined with recipe name/imageUrl).
 * If no plan exists for the week, returns { data: null }.
 */
app.get('/', async (c) => {
  const userId = getUserId(c);
  const week = c.req.query('week');

  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return c.json({ error: 'Invalid or missing week parameter. Must be YYYY-MM-DD format.' }, 400);
  }

  try {
    const accessFilter = await buildAccessFilter(userId);

    // Find the meal plan for the given week
    const [plan] = await db
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.weekStartDate, week), accessFilter));

    if (!plan) {
      return c.json({ data: null });
    }

    // Get entries with recipe info via left join
    const entries = await db
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
      })
      .from(mealPlanEntries)
      .leftJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
      .where(eq(mealPlanEntries.mealPlanId, plan.id))
      .orderBy(asc(mealPlanEntries.dayOfWeek), asc(mealPlanEntries.position));

    return c.json({
      data: {
        ...plan,
        entries,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error fetching meal plan");
    return c.json({ error: 'Failed to fetch meal plan' }, 500);
  }
});

/**
 * POST /api/meal-plans
 * Create a new meal plan for a week.
 *
 * Body: { weekStartDate: string, name?: string }
 * Auto-assigns householdId from the user's household membership.
 */
app.post('/', validateBody(createMealPlanSchema), async (c) => {
  const userId = getUserId(c);
  const { weekStartDate, name } = getValidatedBody<CreateMealPlanInput>(c);

  try {
    const householdId = await getUserHouseholdId(userId);

    // Check if a plan already exists for this week in the same scope
    const accessFilter = await buildAccessFilter(userId);
    const [existing] = await db
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.weekStartDate, weekStartDate), accessFilter));

    if (existing) {
      return c.json({ error: 'A meal plan already exists for this week' }, 409);
    }

    const [newPlan] = await db
      .insert(mealPlans)
      .values({
        name: name || null,
        weekStartDate,
        householdId,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return c.json({ data: newPlan }, 201);
  } catch (error) {
    logger.error({ err: error }, "Error creating meal plan");
    return c.json({ error: 'Failed to create meal plan' }, 500);
  }
});

/**
 * POST /api/meal-plans/copy
 * Copy a previous week's meal plan to a new week.
 *
 * Body: { sourceWeek: string, targetWeek: string }
 * Both must be in YYYY-MM-DD format.
 *
 * Finds the source plan, creates a new target plan, and copies all entries.
 * NOTE: This route must be registered before /:id routes to avoid matching "copy" as an ID.
 */
app.post('/copy', validateBody(copyMealPlanSchema), async (c) => {
  const userId = getUserId(c);
  const { sourceWeek, targetWeek } = getValidatedBody<CopyMealPlanInput>(c);

  if (sourceWeek === targetWeek) {
    return c.json({ error: 'Source and target weeks must be different' }, 400);
  }

  try {
    const accessFilter = await buildAccessFilter(userId);

    // Find the source plan
    const [sourcePlan] = await db
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.weekStartDate, sourceWeek), accessFilter));

    if (!sourcePlan) {
      return c.json({ error: 'Source meal plan not found' }, 404);
    }

    // Check if a plan already exists for the target week
    const [existingTarget] = await db
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.weekStartDate, targetWeek), accessFilter));

    if (existingTarget) {
      return c.json({ error: 'A meal plan already exists for the target week' }, 409);
    }

    const householdId = await getUserHouseholdId(userId);

    // Create the target plan
    const [targetPlan] = await db
      .insert(mealPlans)
      .values({
        name: sourcePlan.name,
        weekStartDate: targetWeek,
        householdId,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    // Get all entries from the source plan
    const sourceEntries = await db
      .select()
      .from(mealPlanEntries)
      .where(eq(mealPlanEntries.mealPlanId, sourcePlan.id))
      .orderBy(asc(mealPlanEntries.dayOfWeek), asc(mealPlanEntries.position));

    // Copy entries to the new plan
    if (sourceEntries.length > 0) {
      await db.insert(mealPlanEntries).values(
        sourceEntries.map((entry) => ({
          mealPlanId: targetPlan.id,
          dayOfWeek: entry.dayOfWeek,
          mealType: entry.mealType,
          recipeId: entry.recipeId,
          customText: entry.customText,
          position: entry.position,
        }))
      );
    }

    // Fetch the new entries with recipe info
    const newEntries = await db
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
      })
      .from(mealPlanEntries)
      .leftJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
      .where(eq(mealPlanEntries.mealPlanId, targetPlan.id))
      .orderBy(asc(mealPlanEntries.dayOfWeek), asc(mealPlanEntries.position));

    return c.json({
      data: {
        ...targetPlan,
        entries: newEntries,
      },
    }, 201);
  } catch (error) {
    logger.error({ err: error }, "Error copying meal plan");
    return c.json({ error: 'Failed to copy meal plan' }, 500);
  }
});

/**
 * PATCH /api/meal-plans/:id
 * Update meal plan metadata (name).
 */
app.patch('/:id', validateBody(updateMealPlanSchema), async (c) => {
  const userId = getUserId(c);
  const id = Number(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid meal plan ID' }, 400);
  }

  try {
    const existingPlan = await verifyMealPlanAccess(id, userId);

    if (!existingPlan) {
      return c.json({ error: 'Meal plan not found' }, 404);
    }

    const { name } = getValidatedBody<UpdateMealPlanInput>(c);

    const [updatedPlan] = await db
      .update(mealPlans)
      .set({
        name: name !== undefined ? name : existingPlan.name,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(mealPlans.id, id))
      .returning();

    return c.json({ data: updatedPlan });
  } catch (error) {
    logger.error({ err: error }, "Error updating meal plan");
    return c.json({ error: 'Failed to update meal plan' }, 500);
  }
});

/**
 * DELETE /api/meal-plans/:id
 * Delete a meal plan. Only the creator can delete it.
 * Entries are cascade-deleted via the foreign key constraint.
 */
app.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const id = Number(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid meal plan ID' }, 400);
  }

  try {
    const existingPlan = await verifyMealPlanAccess(id, userId);

    if (!existingPlan) {
      return c.json({ error: 'Meal plan not found' }, 404);
    }

    // Only the creator can delete
    if (existingPlan.createdBy !== userId) {
      return c.json({ error: 'You do not have permission to delete this meal plan' }, 403);
    }

    await db.delete(mealPlans).where(eq(mealPlans.id, id));

    return c.json({ message: 'Meal plan deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, "Error deleting meal plan");
    return c.json({ error: 'Failed to delete meal plan' }, 500);
  }
});

/**
 * POST /api/meal-plans/:id/entries
 * Add an entry to a meal plan.
 *
 * Body: { dayOfWeek, mealType, recipeId?, customText?, position? }
 */
app.post('/:id/entries', validateBody(createMealPlanEntrySchema), async (c) => {
  const userId = getUserId(c);
  const mealPlanId = Number(c.req.param('id'));

  if (isNaN(mealPlanId)) {
    return c.json({ error: 'Invalid meal plan ID' }, 400);
  }

  try {
    const plan = await verifyMealPlanAccess(mealPlanId, userId);

    if (!plan) {
      return c.json({ error: 'Meal plan not found' }, 404);
    }

    const { dayOfWeek, mealType, recipeId, customText, position } =
      getValidatedBody<CreateMealPlanEntryInput>(c);

    // If recipeId is provided, verify the recipe exists AND the user has access
    if (recipeId) {
      const recipe = await verifyRecipeAccess(recipeId, userId);

      if (!recipe) {
        return c.json({ error: 'Recipe not found' }, 404);
      }
    }

    // Determine position if not provided
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

    // Fetch recipe info if a recipe was linked
    let recipeName: string | null = null;
    let recipeImageUrl: string | null = null;
    if (newEntry.recipeId) {
      const [recipeData] = await db
        .select({ name: recipes.name, imageUrl: recipes.imageUrl })
        .from(recipes)
        .where(eq(recipes.id, newEntry.recipeId));
      if (recipeData) {
        recipeName = recipeData.name;
        recipeImageUrl = recipeData.imageUrl;
      }
    }

    return c.json({
      data: {
        ...newEntry,
        recipeName,
        recipeImageUrl,
      },
    }, 201);
  } catch (error) {
    logger.error({ err: error }, "Error adding meal plan entry");
    return c.json({ error: 'Failed to add meal plan entry' }, 500);
  }
});

/**
 * PATCH /api/meal-plans/:id/entries/:entryId
 * Update an existing meal plan entry.
 *
 * Body: { dayOfWeek?, mealType?, recipeId?, customText?, position? }
 */
app.patch('/:id/entries/:entryId', validateBody(updateMealPlanEntrySchema), async (c) => {
  const userId = getUserId(c);
  const mealPlanId = Number(c.req.param('id'));
  const entryId = Number(c.req.param('entryId'));

  if (isNaN(mealPlanId) || isNaN(entryId)) {
    return c.json({ error: 'Invalid meal plan ID or entry ID' }, 400);
  }

  try {
    const plan = await verifyMealPlanAccess(mealPlanId, userId);

    if (!plan) {
      return c.json({ error: 'Meal plan not found' }, 404);
    }

    // Verify the entry belongs to this plan
    const [existingEntry] = await db
      .select()
      .from(mealPlanEntries)
      .where(eq(mealPlanEntries.id, entryId));

    if (!existingEntry) {
      return c.json({ error: 'Entry not found' }, 404);
    }

    if (existingEntry.mealPlanId !== mealPlanId) {
      return c.json({ error: 'Entry does not belong to this meal plan' }, 400);
    }

    const { dayOfWeek, mealType, recipeId, customText, position } =
      getValidatedBody<UpdateMealPlanEntryInput>(c);

    // If recipeId is being updated to a new recipe, verify it exists AND the user has access
    if (recipeId !== undefined && recipeId !== null) {
      const recipe = await verifyRecipeAccess(recipeId, userId);

      if (!recipe) {
        return c.json({ error: 'Recipe not found' }, 404);
      }
    }

    const [updatedEntry] = await db
      .update(mealPlanEntries)
      .set({
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : existingEntry.dayOfWeek,
        mealType: mealType !== undefined ? mealType : existingEntry.mealType,
        recipeId: recipeId !== undefined ? recipeId : existingEntry.recipeId,
        customText: customText !== undefined ? customText : existingEntry.customText,
        position: position !== undefined ? position : existingEntry.position,
      })
      .where(eq(mealPlanEntries.id, entryId))
      .returning();

    // Fetch recipe info if a recipe is linked
    let recipeName: string | null = null;
    let recipeImageUrl: string | null = null;
    if (updatedEntry.recipeId) {
      const [recipeData] = await db
        .select({ name: recipes.name, imageUrl: recipes.imageUrl })
        .from(recipes)
        .where(eq(recipes.id, updatedEntry.recipeId));
      if (recipeData) {
        recipeName = recipeData.name;
        recipeImageUrl = recipeData.imageUrl;
      }
    }

    // Update the parent meal plan's updatedAt/updatedBy
    await db
      .update(mealPlans)
      .set({ updatedBy: userId, updatedAt: new Date() })
      .where(eq(mealPlans.id, mealPlanId));

    return c.json({
      data: {
        ...updatedEntry,
        recipeName,
        recipeImageUrl,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error updating meal plan entry");
    return c.json({ error: 'Failed to update meal plan entry' }, 500);
  }
});

/**
 * DELETE /api/meal-plans/:id/entries/:entryId
 * Remove an entry from a meal plan.
 */
app.delete('/:id/entries/:entryId', async (c) => {
  const userId = getUserId(c);
  const mealPlanId = Number(c.req.param('id'));
  const entryId = Number(c.req.param('entryId'));

  if (isNaN(mealPlanId) || isNaN(entryId)) {
    return c.json({ error: 'Invalid meal plan ID or entry ID' }, 400);
  }

  try {
    const plan = await verifyMealPlanAccess(mealPlanId, userId);

    if (!plan) {
      return c.json({ error: 'Meal plan not found' }, 404);
    }

    // Verify the entry belongs to this plan
    const [existingEntry] = await db
      .select()
      .from(mealPlanEntries)
      .where(eq(mealPlanEntries.id, entryId));

    if (!existingEntry) {
      return c.json({ error: 'Entry not found' }, 404);
    }

    if (existingEntry.mealPlanId !== mealPlanId) {
      return c.json({ error: 'Entry does not belong to this meal plan' }, 400);
    }

    await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, entryId));

    // Update the parent meal plan's updatedAt/updatedBy
    await db
      .update(mealPlans)
      .set({ updatedBy: userId, updatedAt: new Date() })
      .where(eq(mealPlans.id, mealPlanId));

    return c.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, "Error deleting meal plan entry");
    return c.json({ error: 'Failed to delete meal plan entry' }, 500);
  }
});

/**
 * POST /api/meal-plans/:id/to-shopping-list
 * Generate a shopping list from the meal plan's recipe ingredients.
 *
 * Body: { shoppingListId?: number, newListName?: string }
 * Either shoppingListId or newListName must be provided.
 *
 * Gathers all ingredients from recipes linked in the plan entries
 * and adds them to the target shopping list using add-or-merge logic.
 */
app.post('/:id/to-shopping-list', validateBody(mealPlanToShoppingListSchema), async (c) => {
  const userId = getUserId(c);
  const mealPlanId = Number(c.req.param('id'));

  if (isNaN(mealPlanId)) {
    return c.json({ error: 'Invalid meal plan ID' }, 400);
  }

  try {
    const plan = await verifyMealPlanAccess(mealPlanId, userId);

    if (!plan) {
      return c.json({ error: 'Meal plan not found' }, 404);
    }

    const { shoppingListId, newListName } =
      getValidatedBody<MealPlanToShoppingListInput>(c);

    // Get all entries with recipe IDs for this plan
    const entriesWithRecipes = await db
      .select({ recipeId: mealPlanEntries.recipeId })
      .from(mealPlanEntries)
      .where(eq(mealPlanEntries.mealPlanId, mealPlanId));

    // Filter to only entries that have a linked recipe
    const recipeIds = entriesWithRecipes
      .map((e) => e.recipeId)
      .filter((id): id is number => id !== null);

    if (recipeIds.length === 0) {
      return c.json({ error: 'No recipes found in this meal plan. Add recipes to entries before generating a shopping list.' }, 400);
    }

    // Deduplicate recipe IDs (a recipe may appear multiple times in a week)
    const uniqueRecipeIds = [...new Set(recipeIds)];

    // Gather all ingredients from the linked recipes
    const ingredients = await db
      .select({
        recipeId: recipeIngredients.recipeId,
        name: recipeIngredients.name,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
        notes: recipeIngredients.notes,
      })
      .from(recipeIngredients)
      .where(
        uniqueRecipeIds.length === 1
          ? eq(recipeIngredients.recipeId, uniqueRecipeIds[0])
          : or(...uniqueRecipeIds.map((rid) => eq(recipeIngredients.recipeId, rid)))!
      )
      .orderBy(asc(recipeIngredients.position));

    if (ingredients.length === 0) {
      return c.json({ error: 'No ingredients found in the linked recipes' }, 400);
    }

    // Count how many times each recipe appears in the plan (for quantity scaling)
    const recipeCountMap = new Map<number, number>();
    for (const rid of recipeIds) {
      recipeCountMap.set(rid, (recipeCountMap.get(rid) || 0) + 1);
    }

    // Get recipe names for notes
    const recipeRows = await db
      .select({ id: recipes.id, name: recipes.name })
      .from(recipes)
      .where(
        uniqueRecipeIds.length === 1
          ? eq(recipes.id, uniqueRecipeIds[0])
          : or(...uniqueRecipeIds.map((rid) => eq(recipes.id, rid)))!
      );
    const recipeNameMap = new Map(recipeRows.map((r) => [r.id, r.name]));

    const householdId = await getUserHouseholdId(userId);
    let targetListId: number;

    // Create new list or use existing
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
      // Verify list exists AND the user has household-scoped access
      const existingList = await verifyListAccess(shoppingListId, userId);

      if (!existingList) {
        return c.json({ error: 'Shopping list not found' }, 404);
      }
      targetListId = shoppingListId;
    } else {
      return c.json({ error: 'Either shoppingListId or newListName is required' }, 400);
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

    // Add items with automatic merging of duplicates
    const results = await addOrMergeItems(itemInputs);
    const mergedCount = results.filter((r) => r.merged).length;
    const insertedCount = results.filter((r) => !r.merged).length;

    // Fetch the updated list
    const [updatedList] = await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.id, targetListId));

    const listItems = await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, targetListId))
      .orderBy(asc(shoppingListItems.position));

    return c.json({
      data: {
        ...updatedList,
        items: listItems,
        addedCount: insertedCount,
        mergedCount,
        totalIngredients: ingredients.length,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error generating shopping list from meal plan");
    return c.json({ error: 'Failed to generate shopping list from meal plan' }, 500);
  }
});

export default app;

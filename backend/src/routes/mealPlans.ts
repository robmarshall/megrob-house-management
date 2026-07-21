import { Hono, type Context } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mealPlans, mealPlanEntries } from '../db/schema.js';
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
import {
  buildMealPlanAccessFilter,
  verifyMealPlanAccess,
  getMealPlanForWeek,
  getMealPlanEntries,
  addEntryToPlan,
  updateEntry,
  removeEntry,
  mealPlanToShoppingList,
  type EntryMutationResult,
} from '../services/mealPlanService.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/** Map an entry-mutation failure reason to the HTTP response. */
function entryErrorResponse(
  c: Context,
  reason: Extract<EntryMutationResult, { ok: false }>['reason']
) {
  switch (reason) {
    case 'plan_not_found':
      return c.json({ error: 'Meal plan not found' }, 404);
    case 'recipe_not_found':
      return c.json({ error: 'Recipe not found' }, 404);
    case 'entry_not_found':
      return c.json({ error: 'Entry not found' }, 404);
    case 'entry_not_in_plan':
      return c.json({ error: 'Entry does not belong to this meal plan' }, 400);
  }
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
    const plan = await getMealPlanForWeek(userId, week);
    return c.json({ data: plan });
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
    const accessFilter = await buildMealPlanAccessFilter(userId);
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
    const accessFilter = await buildMealPlanAccessFilter(userId);

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

    // Get all entries from the source plan
    const sourceEntries = await db
      .select()
      .from(mealPlanEntries)
      .where(eq(mealPlanEntries.mealPlanId, sourcePlan.id))
      .orderBy(asc(mealPlanEntries.dayOfWeek), asc(mealPlanEntries.position));

    // Create the target plan and copy its entries atomically so a failure
    // copying entries cannot leave an empty target plan behind.
    const targetPlan = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(mealPlans)
        .values({
          name: sourcePlan.name,
          weekStartDate: targetWeek,
          householdId,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Copy entries to the new plan
      if (sourceEntries.length > 0) {
        await tx.insert(mealPlanEntries).values(
          sourceEntries.map((entry) => ({
            mealPlanId: created.id,
            dayOfWeek: entry.dayOfWeek,
            mealType: entry.mealType,
            recipeId: entry.recipeId,
            customText: entry.customText,
            position: entry.position,
          }))
        );
      }

      return created;
    });

    // Fetch the new entries with recipe info
    const newEntries = await getMealPlanEntries(targetPlan.id);

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
    const input = getValidatedBody<CreateMealPlanEntryInput>(c);
    const result = await addEntryToPlan(userId, mealPlanId, input);

    if (!result.ok) {
      return entryErrorResponse(c, result.reason);
    }

    return c.json({ data: result.entry }, 201);
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
    const input = getValidatedBody<UpdateMealPlanEntryInput>(c);
    const result = await updateEntry(userId, mealPlanId, entryId, input);

    if (!result.ok) {
      return entryErrorResponse(c, result.reason);
    }

    return c.json({ data: result.entry });
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
    const result = await removeEntry(userId, mealPlanId, entryId);

    if (!result.ok) {
      return entryErrorResponse(c, result.reason);
    }

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
    const { shoppingListId, newListName } =
      getValidatedBody<MealPlanToShoppingListInput>(c);

    const result = await mealPlanToShoppingList(userId, mealPlanId, {
      shoppingListId,
      newListName,
    });

    if (!result.ok) {
      switch (result.reason) {
        case 'plan_not_found':
          return c.json({ error: 'Meal plan not found' }, 404);
        case 'no_recipes':
          return c.json({ error: 'No recipes found in this meal plan. Add recipes to entries before generating a shopping list.' }, 400);
        case 'no_ingredients':
          return c.json({ error: 'No ingredients found in the linked recipes' }, 400);
        case 'list_not_found':
          return c.json({ error: 'Shopping list not found' }, 404);
        case 'missing_target':
          return c.json({ error: 'Either shoppingListId or newListName is required' }, 400);
      }
    }

    return c.json({
      data: {
        ...result.list,
        items: result.items,
        addedCount: result.addedCount,
        mergedCount: result.mergedCount,
        totalIngredients: result.totalIngredients,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error generating shopping list from meal plan");
    return c.json({ error: 'Failed to generate shopping list from meal plan' }, 500);
  }
});

export default app;

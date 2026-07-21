import { Hono } from 'hono';
import { eq, desc, asc, like, or, inArray, and, sql, ilike, exists, notExists, SQL, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { recipes, recipeIngredients, recipeCategories, recipeFeedback, shoppingLists, shoppingListItems, user, userFavorites } from '../db/schema.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { getUserHouseholdId } from '../lib/household.js';
import { verifyShoppingListAccess } from '../lib/shoppingListAccess.js';
import { validateBody, getValidatedBody } from '../middleware/validation.js';
import {
  createRecipeSchema,
  updateRecipeSchema,
  importRecipeSchema,
  createFeedbackSchema,
  addToShoppingListSchema,
  shareRecipeSchema,
  type CreateRecipeInput,
  type UpdateRecipeInput,
  type ImportRecipeInput,
  type CreateFeedbackInput,
  type AddToShoppingListInput,
  type ShareRecipeInput,
} from '../lib/validation.js';
import { enqueueRecipeImport } from '../lib/queue.js';
import { addOrMergeItems, type AddItemInput } from '../services/shoppingListItemService.js';
import { resolveItemCategories } from '../services/categoryService.js';
import {
  verifyRecipeAccess,
  searchRecipes,
  getRecipeDetail,
  createRecipe,
  updateRecipe,
  setRecipeSharing,
} from '../services/recipeService.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper to verify recipe ownership (creator only)
 * Used for destructive operations like DELETE
 */
async function verifyRecipeOwnership(recipeId: number, userId: string) {
  const recipe = await verifyRecipeAccess(recipeId, userId);

  if (!recipe) {
    return { recipe: null, error: 'Recipe not found', status: 404 as const };
  }

  if (recipe.createdBy !== userId) {
    return { recipe: null, error: 'You do not have permission to modify this recipe', status: 403 as const };
  }

  return { recipe, error: null, status: 200 as const };
}

/**
 * GET /api/recipes
 * Get all recipes with pagination, search, and filters
 *
 * Optimized to use database-level filtering for better performance.
 *
 * Query Parameters:
 * - page, pageSize: Pagination
 * - search: Search in name, description, and ingredients
 * - favorite: Only show favorites (true/false)
 * - status: Filter by status (pending/ready/failed/all)
 * - mealType: Filter by meal type (comma-separated for multiple)
 * - dietary: Filter by dietary (comma-separated for multiple)
 * - allergenFree: Exclude recipes with specific allergens (comma-separated)
 * - cuisine: Filter by cuisine
 * - difficulty: Filter by difficulty (easy/medium/hard)
 */
app.get('/', async (c) => {
  const userId = getUserId(c);
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');

  if (isNaN(page) || page < 1) {
    return c.json({ error: 'Invalid page parameter: must be a positive integer' }, 400);
  }
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    return c.json({ error: 'Invalid pageSize parameter: must be between 1 and 100' }, 400);
  }

  const offset = (page - 1) * pageSize;

  // Get query parameters
  const search = c.req.query('search');
  const favorite = c.req.query('favorite');
  const status = c.req.query('status');
  const mealType = c.req.query('mealType');
  const dietary = c.req.query('dietary');
  const allergenFree = c.req.query('allergenFree');
  const cuisine = c.req.query('cuisine');
  const difficulty = c.req.query('difficulty');

  try {
    const result = await searchRecipes(userId, {
      page,
      pageSize,
      search,
      favorite: favorite === 'true',
      status,
      mealTypes: mealType ? mealType.split(',') : undefined,
      dietary: dietary ? dietary.split(',') : undefined,
      allergenFree: allergenFree ? allergenFree.split(',') : undefined,
      cuisine,
      difficulty,
    });

    return c.json(result);
  } catch (error) {
    logger.error({ err: error }, "Error fetching recipes");
    return c.json({ error: 'Failed to fetch recipes' }, 500);
  }
});

/**
 * POST /api/recipes/import
 * Import a recipe from a URL by scraping structured data
 *
 * This endpoint creates a pending recipe and enqueues the import job on the
 * pg-boss queue. The actual scraping happens asynchronously in the worker process.
 *
 * Returns 202 Accepted with the pending recipe.
 * Frontend should poll GET /api/recipes/:id/status to check progress.
 */
app.post('/import', validateBody(importRecipeSchema), async (c) => {
  const userId = getUserId(c);
  const { url } = getValidatedBody<ImportRecipeInput>(c);

  try {

    const householdId = await getUserHouseholdId(userId);

    // Create a pending recipe
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        name: 'Importing...',
        instructions: '[]',
        sourceUrl: url,
        status: 'pending',
        householdId,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    // Enqueue the import job for the worker process to pick up.
    try {
      const jobId = await enqueueRecipeImport({
        recipeId: newRecipe.id,
        url,
        userId,
      });

      logger.info({ recipeId: newRecipe.id, jobId }, "Enqueued recipe import job");
    } catch (queueError) {
      // If queueing fails, update recipe to failed status
      logger.error({ err: queueError, recipeId: newRecipe.id }, "Failed to queue import job");

      await db
        .update(recipes)
        .set({
          status: 'failed',
          errorMessage: 'Failed to start import process. Please try again.',
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, newRecipe.id));

      return c.json({
        ...newRecipe,
        status: 'failed',
        errorMessage: 'Failed to start import process. Please try again.',
        ingredients: [],
        categories: [],
      }, 500);
    }

    // Return the pending recipe
    return c.json({
      ...newRecipe,
      ingredients: [],
      categories: [],
    }, 202);

  } catch (error) {
    logger.error({ err: error }, "Error creating import job");
    return c.json({ error: 'Failed to start recipe import. Please try again.' }, 500);
  }
});

/**
 * GET /api/recipes/:id/status
 * Get the import status of a recipe
 *
 * Used by frontend to poll for import completion.
 * Returns: { status: 'pending' | 'ready' | 'failed', errorMessage?: string }
 */
app.get('/:id/status', async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid recipe ID' }, 400);
  }

  try {
    // Use household-scoped access so any household member can poll import status
    const recipe = await verifyRecipeAccess(id, userId);

    if (!recipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    return c.json({
      id: recipe.id,
      status: recipe.status,
      errorMessage: recipe.errorMessage,
      name: recipe.status === 'ready' ? recipe.name : null,
    });
  } catch (error) {
    logger.error({ err: error }, "Error fetching recipe status");
    return c.json({ error: 'Failed to fetch recipe status' }, 500);
  }
});

/**
 * GET /api/recipes/:id
 * Get a single recipe with ingredients and categories
 */
app.get('/:id', async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid recipe ID' }, 400);
  }

  try {
    const recipe = await getRecipeDetail(userId, id);

    if (!recipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    return c.json(recipe);
  } catch (error) {
    logger.error({ err: error }, "Error fetching recipe");
    return c.json({ error: 'Failed to fetch recipe' }, 500);
  }
});

/**
 * POST /api/recipes
 * Create a new recipe manually
 */
app.post('/', validateBody(createRecipeSchema), async (c) => {
  const userId = getUserId(c);
  const body = getValidatedBody<CreateRecipeInput>(c);

  try {
    const newRecipe = await createRecipe(userId, body);
    return c.json(newRecipe, 201);
  } catch (error) {
    logger.error({ err: error }, "Error creating recipe");
    return c.json({ error: 'Failed to create recipe' }, 500);
  }
});

/**
 * PATCH /api/recipes/:id
 * Update a recipe
 *
 * Authorization: Shared-edit policy — any authenticated user can edit any recipe.
 * This is intentional for a household app where recipes are collaborative.
 * Only DELETE requires ownership (creator only). See Spec 012 for rationale.
 */
app.patch('/:id', validateBody(updateRecipeSchema), async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid recipe ID' }, 400);
  }

  try {
    // Shared-edit: any household member can edit any household recipe
    // (intentional policy; the service enforces access + atomic child-row
    // replacement).
    const updatedRecipe = await updateRecipe(
      userId,
      id,
      getValidatedBody<UpdateRecipeInput>(c)
    );

    if (!updatedRecipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    return c.json(updatedRecipe);
  } catch (error) {
    logger.error({ err: error }, "Error updating recipe");
    return c.json({ error: 'Failed to update recipe' }, 500);
  }
});

/**
 * DELETE /api/recipes/:id
 * Delete a recipe (cascade deletes ingredients and categories)
 * Only the recipe owner can delete it
 */
app.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid recipe ID' }, 400);
  }

  try {
    // Verify recipe exists and user owns it
    const { recipe: existingRecipe, error, status } = await verifyRecipeOwnership(id, userId);
    if (!existingRecipe) {
      return c.json({ error }, status);
    }

    // Delete the recipe (ingredients and categories will cascade delete)
    await db.delete(recipes).where(eq(recipes.id, id));

    return c.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, "Error deleting recipe");
    return c.json({ error: 'Failed to delete recipe' }, 500);
  }
});

/**
 * POST /api/recipes/:id/share
 * Enable/disable public sharing for a recipe.
 * Shared-edit policy: any user with access to the recipe may toggle sharing.
 * Returns { isPublic, publicId } — the frontend builds the share URL from publicId.
 */
app.post('/:id/share', validateBody(shareRecipeSchema), async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid recipe ID' }, 400);
  }

  try {
    const { isPublic } = getValidatedBody<ShareRecipeInput>(c);
    const result = await setRecipeSharing(userId, id, isPublic);

    if (!result) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    return c.json(result);
  } catch (error) {
    logger.error({ err: error }, "Error updating recipe sharing");
    return c.json({ error: 'Failed to update recipe sharing' }, 500);
  }
});

/**
 * POST /api/recipes/:id/favorite
 * Toggle favorite status for the current user
 * Any authenticated user can favorite/unfavorite any recipe
 */
app.post('/:id/favorite', async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid recipe ID' }, 400);
  }

  try {
    // Verify recipe exists and user has access
    const existingRecipe = await verifyRecipeAccess(id, userId);

    if (!existingRecipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    // Check if user already has this as a favorite
    const [existingFavorite] = await db
      .select()
      .from(userFavorites)
      .where(and(eq(userFavorites.userId, userId), eq(userFavorites.recipeId, id)));

    let isFavorite: boolean;

    if (existingFavorite) {
      // Remove from favorites
      await db
        .delete(userFavorites)
        .where(and(eq(userFavorites.userId, userId), eq(userFavorites.recipeId, id)));
      isFavorite = false;
    } else {
      // Add to favorites
      await db
        .insert(userFavorites)
        .values({
          userId,
          recipeId: id,
        });
      isFavorite = true;
    }

    return c.json({
      ...existingRecipe,
      isFavorite,
    });
  } catch (error) {
    logger.error({ err: error }, "Error toggling favorite");
    return c.json({ error: 'Failed to toggle favorite' }, 500);
  }
});

/**
 * POST /api/recipes/:id/to-shopping-list
 * Add selected ingredients to a shopping list
 *
 * Body:
 * - shoppingListId: (optional) ID of existing list to add to
 * - newListName: (optional) Name for a new list to create
 * - ingredientIds: Array of ingredient IDs to add
 * - servingMultiplier: (optional) Multiplier for scaling quantities (default 1)
 *
 * Either shoppingListId OR newListName must be provided
 */
app.post('/:id/to-shopping-list', validateBody(addToShoppingListSchema), async (c) => {
  const userId = getUserId(c);
  const recipeId = parseInt(c.req.param('id'));

  if (isNaN(recipeId)) {
    return c.json({ error: 'Invalid recipe ID' }, 400);
  }

  try {
    const { shoppingListId, newListName, ingredientIds, servingMultiplier } = getValidatedBody<AddToShoppingListInput>(c);

    // Verify recipe exists and user has access
    const recipe = await verifyRecipeAccess(recipeId, userId);

    if (!recipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    // Get the selected ingredients
    const selectedIngredients = await db
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipeId));

    const ingredientsToAdd = selectedIngredients.filter((ing) =>
      ingredientIds.includes(ing.id)
    );

    if (ingredientsToAdd.length === 0) {
      return c.json({ error: 'No valid ingredients selected' }, 400);
    }

    const householdId = await getUserHouseholdId(userId);
    let targetListId: number;

    // Create new list or use existing
    if (newListName) {
      const [newList] = await db
        .insert(shoppingLists)
        .values({
          name: newListName,
          description: `Ingredients from ${recipe.name}`,
          householdId,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();
      targetListId = newList.id;
    } else if (shoppingListId) {
      // Verify list exists AND the user has household-scoped access
      const existingList = await verifyShoppingListAccess(shoppingListId, userId);

      if (!existingList) {
        return c.json({ error: 'Shopping list not found' }, 404);
      }
      targetListId = shoppingListId;
    } else {
      // This shouldn't happen due to Zod refine, but TypeScript needs it
      return c.json({ error: 'Either shoppingListId or newListName is required' }, 400);
    }

    // Build item inputs for add-or-merge
    const itemInputs: AddItemInput[] = ingredientsToAdd.map((ing) => {
      // Scale quantity if multiplier is provided
      let quantity = ing.quantity;
      if (quantity && servingMultiplier !== 1) {
        const numericQty = parseFloat(quantity);
        if (!isNaN(numericQty)) {
          quantity = (numericQty * servingMultiplier).toString();
        }
      }

      return {
        listId: targetListId,
        name: ing.name,
        quantity: quantity || '1',
        unit: ing.unit,
        notes: ing.notes ? `${ing.notes} (from ${recipe.name})` : `From ${recipe.name}`,
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
      ...updatedList,
      items: listItems,
      addedCount: insertedCount,
      mergedCount,
      totalAffected: ingredientsToAdd.length,
    });

  } catch (error) {
    logger.error({ err: error }, "Error adding to shopping list");
    return c.json({ error: 'Failed to add ingredients to shopping list' }, 500);
  }
});

/**
 * GET /api/recipes/:id/feedback
 * Get all feedback for a recipe with summary counts
 */
app.get('/:id/feedback', async (c) => {
  const userId = getUserId(c);
  const recipeId = parseInt(c.req.param('id'));

  if (isNaN(recipeId)) {
    return c.json({ error: 'Invalid recipe ID' }, 400);
  }

  try {
    // Verify recipe exists and user has access
    const recipe = await verifyRecipeAccess(recipeId, userId);

    if (!recipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    // Get all feedback with user names
    const feedbackEntries = await db
      .select({
        id: recipeFeedback.id,
        recipeId: recipeFeedback.recipeId,
        userId: recipeFeedback.userId,
        userName: user.name,
        isLike: recipeFeedback.isLike,
        note: recipeFeedback.note,
        createdAt: recipeFeedback.createdAt,
      })
      .from(recipeFeedback)
      .leftJoin(user, eq(recipeFeedback.userId, user.id))
      .where(eq(recipeFeedback.recipeId, recipeId))
      .orderBy(desc(recipeFeedback.createdAt));

    // Calculate counts
    const likes = feedbackEntries.filter((f) => f.isLike).length;
    const dislikes = feedbackEntries.filter((f) => !f.isLike).length;

    return c.json({
      likes,
      dislikes,
      entries: feedbackEntries,
    });
  } catch (error) {
    logger.error({ err: error }, "Error fetching feedback");
    return c.json({ error: 'Failed to fetch feedback' }, 500);
  }
});

/**
 * POST /api/recipes/:id/feedback
 * Add new feedback (like/dislike with optional note)
 */
app.post('/:id/feedback', validateBody(createFeedbackSchema), async (c) => {
  const userId = getUserId(c);
  const recipeId = parseInt(c.req.param('id'));

  if (isNaN(recipeId)) {
    return c.json({ error: 'Invalid recipe ID' }, 400);
  }

  try {
    const { isLike, note } = getValidatedBody<CreateFeedbackInput>(c);

    // Verify recipe exists and user has access
    const recipe = await verifyRecipeAccess(recipeId, userId);

    if (!recipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    // Upsert feedback (update if user already left feedback on this recipe)
    const [newFeedback] = await db
      .insert(recipeFeedback)
      .values({
        recipeId,
        userId,
        isLike,
        note: note || null,
      })
      .onConflictDoUpdate({
        target: [recipeFeedback.recipeId, recipeFeedback.userId],
        set: {
          isLike,
          note: note || null,
        },
      })
      .returning();

    // Get user name for response
    const [userData] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId));

    return c.json({
      ...newFeedback,
      userName: userData?.name || 'Unknown',
    }, 201);
  } catch (error) {
    logger.error({ err: error }, "Error adding feedback");
    return c.json({ error: 'Failed to add feedback' }, 500);
  }
});

/**
 * DELETE /api/recipes/:id/feedback/:feedbackId
 * Delete a feedback entry (only the owner can delete)
 */
app.delete('/:id/feedback/:feedbackId', async (c) => {
  const userId = getUserId(c);
  const recipeId = parseInt(c.req.param('id'));
  const feedbackId = parseInt(c.req.param('feedbackId'));

  if (isNaN(recipeId) || isNaN(feedbackId)) {
    return c.json({ error: 'Invalid recipe ID or feedback ID' }, 400);
  }

  try {
    // Verify recipe exists and user has access
    const recipe = await verifyRecipeAccess(recipeId, userId);
    if (!recipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    // Get the feedback entry
    const [feedback] = await db
      .select()
      .from(recipeFeedback)
      .where(eq(recipeFeedback.id, feedbackId));

    if (!feedback) {
      return c.json({ error: 'Feedback not found' }, 404);
    }

    if (feedback.recipeId !== recipeId) {
      return c.json({ error: 'Feedback does not belong to this recipe' }, 400);
    }

    // Only allow owner to delete their own feedback
    if (feedback.userId !== userId) {
      return c.json({ error: 'You can only delete your own feedback' }, 403);
    }

    // Delete the feedback
    await db.delete(recipeFeedback).where(eq(recipeFeedback.id, feedbackId));

    return c.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, "Error deleting feedback");
    return c.json({ error: 'Failed to delete feedback' }, 500);
  }
});

export default app;

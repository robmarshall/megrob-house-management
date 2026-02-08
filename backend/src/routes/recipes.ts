import { Hono } from 'hono';
import { eq, desc, asc, like, or, inArray, and, sql, ilike, exists, notExists, SQL, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { recipes, recipeIngredients, recipeCategories, recipeFeedback, shoppingLists, shoppingListItems, user, userFavorites } from '../db/schema.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { getUserHouseholdId } from '../lib/household.js';
import { validateBody, getValidatedBody } from '../middleware/validation.js';
import {
  createRecipeSchema,
  updateRecipeSchema,
  importRecipeSchema,
  createFeedbackSchema,
  addToShoppingListSchema,
  type CreateRecipeInput,
  type UpdateRecipeInput,
  type ImportRecipeInput,
  type CreateFeedbackInput,
  type AddToShoppingListInput,
} from '../lib/validation.js';
import { qb, getWebhookUrl } from '../lib/queuebear.js';
import { addOrMergeItems, type AddItemInput } from '../services/shoppingListItemService.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper to verify recipe access (household or personal ownership)
 * Returns the recipe if the user has access, null otherwise.
 * A user has access if:
 *   - The recipe belongs to their household, OR
 *   - The recipe is a personal recipe (no household) created by them
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
    const householdId = await getUserHouseholdId(userId);

    // Build WHERE conditions dynamically
    const conditions: SQL[] = [];

    // Scope to household (or personal recipes if no household)
    if (householdId) {
      conditions.push(
        or(
          eq(recipes.householdId, householdId),
          and(eq(recipes.createdBy, userId), isNull(recipes.householdId))
        )!
      );
    } else {
      conditions.push(eq(recipes.createdBy, userId));
    }

    // Status filter (default to 'ready' if not specified)
    if (!status) {
      conditions.push(eq(recipes.status, 'ready'));
    } else if (status !== 'all') {
      conditions.push(eq(recipes.status, status));
    }

    // Cuisine filter
    if (cuisine) {
      conditions.push(ilike(recipes.cuisine, cuisine));
    }

    // Difficulty filter
    if (difficulty) {
      conditions.push(ilike(recipes.difficulty, difficulty));
    }

    // Search filter (name, description, or ingredient name)
    if (search) {
      const searchPattern = `%${search}%`;
      const ingredientSearchSubquery = db
        .select({ recipeId: recipeIngredients.recipeId })
        .from(recipeIngredients)
        .where(and(
          eq(recipeIngredients.recipeId, recipes.id),
          ilike(recipeIngredients.name, searchPattern)
        ));

      conditions.push(
        or(
          ilike(recipes.name, searchPattern),
          ilike(recipes.description, searchPattern),
          exists(ingredientSearchSubquery)
        )!
      );
    }

    // Favorites filter (per-user)
    if (favorite === 'true') {
      const favoritesSubquery = db
        .select({ recipeId: userFavorites.recipeId })
        .from(userFavorites)
        .where(and(
          eq(userFavorites.recipeId, recipes.id),
          eq(userFavorites.userId, userId)
        ));
      conditions.push(exists(favoritesSubquery));
    }

    // Meal type filter (any of the specified types)
    if (mealType) {
      const mealTypes = mealType.split(',').map((t) => t.trim().toLowerCase());
      const mealTypeSubquery = db
        .select({ recipeId: recipeCategories.recipeId })
        .from(recipeCategories)
        .where(and(
          eq(recipeCategories.recipeId, recipes.id),
          eq(recipeCategories.categoryType, 'meal_type'),
          inArray(sql`LOWER(${recipeCategories.categoryValue})`, mealTypes)
        ));
      conditions.push(exists(mealTypeSubquery));
    }

    // Dietary filter (must have ALL specified dietary options)
    if (dietary) {
      const dietaryOptions = dietary.split(',').map((d) => d.trim().toLowerCase());
      for (const diet of dietaryOptions) {
        const dietarySubquery = db
          .select({ recipeId: recipeCategories.recipeId })
          .from(recipeCategories)
          .where(and(
            eq(recipeCategories.recipeId, recipes.id),
            eq(recipeCategories.categoryType, 'dietary'),
            ilike(recipeCategories.categoryValue, diet)
          ));
        conditions.push(exists(dietarySubquery));
      }
    }

    // Allergen-free filter (must NOT have any of the specified allergens)
    if (allergenFree) {
      const allergensToExclude = allergenFree.split(',').map((a) => a.trim().toLowerCase());
      const allergenSubquery = db
        .select({ recipeId: recipeCategories.recipeId })
        .from(recipeCategories)
        .where(and(
          eq(recipeCategories.recipeId, recipes.id),
          eq(recipeCategories.categoryType, 'allergen'),
          inArray(sql`LOWER(${recipeCategories.categoryValue})`, allergensToExclude)
        ));
      conditions.push(notExists(allergenSubquery));
    }

    // Build the WHERE clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count with filters applied
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recipes)
      .where(whereClause);
    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Get paginated data
    const data = await db
      .select()
      .from(recipes)
      .where(whereClause)
      .orderBy(desc(recipes.updatedAt))
      .limit(pageSize)
      .offset(offset);

    if (data.length === 0) {
      return c.json({
        data: [],
        total,
        page,
        pageSize,
        totalPages,
      });
    }

    // Get user's favorites for the returned recipes
    const recipeIds = data.map((r) => r.id);
    const userFavoritesList = await db
      .select({ recipeId: userFavorites.recipeId })
      .from(userFavorites)
      .where(and(
        eq(userFavorites.userId, userId),
        inArray(userFavorites.recipeId, recipeIds)
      ));
    const userFavoriteIds = new Set(userFavoritesList.map((f) => f.recipeId));

    // Get categories only for the returned recipes
    const categoriesForRecipes = await db
      .select()
      .from(recipeCategories)
      .where(inArray(recipeCategories.recipeId, recipeIds));

    const categoriesByRecipe = new Map<number, typeof categoriesForRecipes>();
    for (const cat of categoriesForRecipes) {
      if (!categoriesByRecipe.has(cat.recipeId)) {
        categoriesByRecipe.set(cat.recipeId, []);
      }
      categoriesByRecipe.get(cat.recipeId)!.push(cat);
    }

    // Attach categories and user-specific favorite status to each recipe
    const dataWithCategories = data.map((recipe) => ({
      ...recipe,
      isFavorite: userFavoriteIds.has(recipe.id),
      categories: categoriesByRecipe.get(recipe.id) || [],
    }));

    return c.json({
      data: dataWithCategories,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    logger.error({ err: error }, "Error fetching recipes");
    return c.json({ error: 'Failed to fetch recipes' }, 500);
  }
});

/**
 * POST /api/recipes/import
 * Import a recipe from a URL by scraping structured data
 *
 * This endpoint creates a pending recipe and queues the import job via QueueBear.
 * The actual scraping happens asynchronously via the webhook endpoint.
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

    // Trigger the import workflow via QueueBear
    try {
      const workflowUrl = getWebhookUrl('/api/webhooks/recipe-import');

      const { id: workflowRunId } = await qb.workflows.trigger(
        `recipe-import-${newRecipe.id}`,
        workflowUrl,
        {
          recipeId: newRecipe.id,
          url,
          userId,
        },
        {
          idempotencyKey: `recipe-import-${newRecipe.id}`,
        }
      );

      logger.info({ recipeId: newRecipe.id, workflowRunId }, "Triggered recipe import workflow");
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
    const recipe = await verifyRecipeAccess(id, userId);

    if (!recipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    // Check if user has favorited this recipe
    const [userFavorite] = await db
      .select()
      .from(userFavorites)
      .where(and(eq(userFavorites.userId, userId), eq(userFavorites.recipeId, id)));

    // Get ingredients
    const ingredients = await db
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, id))
      .orderBy(asc(recipeIngredients.position));

    // Get categories
    const categories = await db
      .select()
      .from(recipeCategories)
      .where(eq(recipeCategories.recipeId, id));

    return c.json({
      ...recipe,
      isFavorite: !!userFavorite, // Per-user favorite status
      ingredients,
      categories,
    });
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
    const {
      name,
      description,
      servings,
      prepTimeMinutes,
      cookTimeMinutes,
      instructions,
      difficulty,
      cuisine,
      notes,
      ingredients,
      categories,
    } = body;

    const householdId = await getUserHouseholdId(userId);

    // Create the recipe
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        name,
        description: description || null,
        householdId,
        servings: servings || 4,
        prepTimeMinutes: prepTimeMinutes || null,
        cookTimeMinutes: cookTimeMinutes || null,
        instructions: typeof instructions === 'string' ? instructions : JSON.stringify(instructions),
        difficulty: difficulty || null,
        cuisine: cuisine || null,
        notes: notes || null,
        status: 'ready',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    // Insert ingredients if provided
    if (ingredients && ingredients.length > 0) {
      await db.insert(recipeIngredients).values(
        ingredients.map((ing, index) => ({
          recipeId: newRecipe.id,
          name: ing.name,
          quantity: ing.quantity?.toString() || null,
          unit: ing.unit || null,
          notes: ing.notes || null,
          position: index,
        }))
      );
    }

    // Insert categories if provided
    if (categories && categories.length > 0) {
      await db.insert(recipeCategories).values(
        categories.map((cat) => ({
          recipeId: newRecipe.id,
          categoryType: cat.type,
          categoryValue: cat.value,
        }))
      );
    }

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
    // Shared-edit: any household member can edit any household recipe (intentional policy)
    const existingRecipe = await verifyRecipeAccess(id, userId);

    if (!existingRecipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    const {
      name,
      description,
      servings,
      prepTimeMinutes,
      cookTimeMinutes,
      instructions,
      difficulty,
      cuisine,
      notes,
      rating,
      ingredients,
      categories,
    } = getValidatedBody<UpdateRecipeInput>(c);

    // Update the recipe
    const [updatedRecipe] = await db
      .update(recipes)
      .set({
        name: name !== undefined ? name : existingRecipe.name,
        description: description !== undefined ? description : existingRecipe.description,
        servings: servings !== undefined ? servings : existingRecipe.servings,
        prepTimeMinutes: prepTimeMinutes !== undefined ? prepTimeMinutes : existingRecipe.prepTimeMinutes,
        cookTimeMinutes: cookTimeMinutes !== undefined ? cookTimeMinutes : existingRecipe.cookTimeMinutes,
        instructions: instructions !== undefined
          ? (typeof instructions === 'string' ? instructions : JSON.stringify(instructions))
          : existingRecipe.instructions,
        difficulty: difficulty !== undefined ? difficulty : existingRecipe.difficulty,
        cuisine: cuisine !== undefined ? cuisine : existingRecipe.cuisine,
        notes: notes !== undefined ? notes : existingRecipe.notes,
        rating: rating !== undefined ? rating : existingRecipe.rating,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, id))
      .returning();

    // Update ingredients if provided
    if (ingredients !== undefined && Array.isArray(ingredients)) {
      // Delete existing ingredients
      await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));

      // Insert new ingredients
      if (ingredients.length > 0) {
        await db.insert(recipeIngredients).values(
          ingredients.map((ing: { name: string; quantity?: number; unit?: string; notes?: string }, index: number) => ({
            recipeId: id,
            name: ing.name,
            quantity: ing.quantity?.toString() || null,
            unit: ing.unit || null,
            notes: ing.notes || null,
            position: index,
          }))
        );
      }
    }

    // Update categories if provided
    if (categories !== undefined && Array.isArray(categories)) {
      // Delete existing categories
      await db.delete(recipeCategories).where(eq(recipeCategories.recipeId, id));

      // Insert new categories
      if (categories.length > 0) {
        await db.insert(recipeCategories).values(
          categories.map((cat: { type: string; value: string }) => ({
            recipeId: id,
            categoryType: cat.type,
            categoryValue: cat.value,
          }))
        );
      }
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
      // Verify list exists
      const [existingList] = await db
        .select()
        .from(shoppingLists)
        .where(eq(shoppingLists.id, shoppingListId));

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

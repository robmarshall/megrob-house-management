import { Hono } from 'hono';
import { eq, and, desc, or, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { shoppingLists } from '../db/schema.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';
import { validateBody, getValidatedBody } from '../middleware/validation.js';
import { logger } from '../lib/logger.js';
import { getUserHouseholdId } from '../lib/household.js';
import {
  listShoppingLists,
  listAccessCondition,
} from '../services/shoppingListService.js';
import {
  createShoppingListSchema,
  updateShoppingListSchema,
  type CreateShoppingListInput,
  type UpdateShoppingListInput,
} from '../lib/validation.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * GET /api/shopping-lists
 * Get all shopping lists for the authenticated user's household with pagination
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

  try {
    const result = await listShoppingLists(userId, { page, pageSize });
    return c.json(result);
  } catch (error) {
    logger.error({ err: error }, "Error fetching shopping lists");
    return c.json({ error: 'Failed to fetch shopping lists' }, 500);
  }
});

/**
 * POST /api/shopping-lists
 * Create a new shopping list (automatically assigned to user's household)
 */
app.post('/', validateBody(createShoppingListSchema), async (c) => {
  const userId = getUserId(c);
  const { name, description } = getValidatedBody<CreateShoppingListInput>(c);

  try {
    const householdId = await getUserHouseholdId(userId);

    const [newList] = await db
      .insert(shoppingLists)
      .values({
        name,
        description: description || null,
        householdId,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return c.json(newList, 201);
  } catch (error) {
    logger.error({ err: error }, "Error creating shopping list");
    return c.json({ error: 'Failed to create shopping list' }, 500);
  }
});

/**
 * GET /api/shopping-lists/:id
 * Get a single shopping list by ID (must belong to user's household or be user's own)
 */
app.get('/:id', async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid list ID' }, 400);
  }

  try {
    const householdId = await getUserHouseholdId(userId);
    const accessFilter = listAccessCondition(userId, householdId);

    const [list] = await db
      .select()
      .from(shoppingLists)
      .where(and(eq(shoppingLists.id, id), accessFilter));

    if (!list) {
      return c.json({ error: 'Shopping list not found' }, 404);
    }

    return c.json(list);
  } catch (error) {
    logger.error({ err: error }, "Error fetching shopping list");
    return c.json({ error: 'Failed to fetch shopping list' }, 500);
  }
});

/**
 * PATCH /api/shopping-lists/:id
 * Update a shopping list (any household member can edit shared lists)
 */
app.patch('/:id', validateBody(updateShoppingListSchema), async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid list ID' }, 400);
  }

  try {
    const { name, description } = getValidatedBody<UpdateShoppingListInput>(c);
    const householdId = await getUserHouseholdId(userId);
    const accessFilter = listAccessCondition(userId, householdId);

    // Verify access
    const [existingList] = await db
      .select()
      .from(shoppingLists)
      .where(and(eq(shoppingLists.id, id), accessFilter));

    if (!existingList) {
      return c.json({ error: 'Shopping list not found' }, 404);
    }

    // Update the list
    const [updatedList] = await db
      .update(shoppingLists)
      .set({
        name: name || existingList.name,
        description: description !== undefined ? description : existingList.description,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(shoppingLists.id, id))
      .returning();

    return c.json(updatedList);
  } catch (error) {
    logger.error({ err: error }, "Error updating shopping list");
    return c.json({ error: 'Failed to update shopping list' }, 500);
  }
});

/**
 * DELETE /api/shopping-lists/:id
 * Delete a shopping list (cascade deletes items)
 * Any household member can delete shared lists.
 */
app.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid list ID' }, 400);
  }

  try {
    const householdId = await getUserHouseholdId(userId);
    const accessFilter = listAccessCondition(userId, householdId);

    // Verify access
    const [existingList] = await db
      .select()
      .from(shoppingLists)
      .where(and(eq(shoppingLists.id, id), accessFilter));

    if (!existingList) {
      return c.json({ error: 'Shopping list not found' }, 404);
    }

    // Delete the list (items will be cascade deleted)
    await db
      .delete(shoppingLists)
      .where(eq(shoppingLists.id, id));

    return c.json({ message: 'Shopping list deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, "Error deleting shopping list");
    return c.json({ error: 'Failed to delete shopping list' }, 500);
  }
});

export default app;

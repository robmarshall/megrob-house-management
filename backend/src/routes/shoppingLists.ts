import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { shoppingLists } from '../db/schema.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * GET /api/shopping-lists
 * Get all shopping lists for the authenticated user with pagination
 */
app.get('/', async (c) => {
  const userId = getUserId(c);
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const offset = (page - 1) * pageSize;

  try {
    // Get total count
    const allLists = await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.createdBy, userId));

    const total = allLists.length;
    const totalPages = Math.ceil(total / pageSize);

    // Get paginated data
    const data = await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.createdBy, userId))
      .orderBy(desc(shoppingLists.updatedAt))
      .limit(pageSize)
      .offset(offset);

    return c.json({
      data,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    return c.json({ error: 'Failed to fetch shopping lists' }, 500);
  }
});

/**
 * POST /api/shopping-lists
 * Create a new shopping list
 */
app.post('/', async (c) => {
  const userId = getUserId(c);

  try {
    const body = await c.req.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return c.json({ error: 'Name is required and must be a string' }, 400);
    }

    const [newList] = await db
      .insert(shoppingLists)
      .values({
        name,
        description: description || null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return c.json(newList, 201);
  } catch (error) {
    console.error('Error creating shopping list:', error);
    return c.json({ error: 'Failed to create shopping list' }, 500);
  }
});

/**
 * GET /api/shopping-lists/:id
 * Get a single shopping list by ID
 */
app.get('/:id', async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid list ID' }, 400);
  }

  try {
    const [list] = await db
      .select()
      .from(shoppingLists)
      .where(
        and(
          eq(shoppingLists.id, id),
          eq(shoppingLists.createdBy, userId)
        )
      );

    if (!list) {
      return c.json({ error: 'Shopping list not found' }, 404);
    }

    return c.json(list);
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    return c.json({ error: 'Failed to fetch shopping list' }, 500);
  }
});

/**
 * PATCH /api/shopping-lists/:id
 * Update a shopping list
 */
app.patch('/:id', async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid list ID' }, 400);
  }

  try {
    const body = await c.req.json();
    const { name, description } = body;

    // Verify ownership
    const [existingList] = await db
      .select()
      .from(shoppingLists)
      .where(
        and(
          eq(shoppingLists.id, id),
          eq(shoppingLists.createdBy, userId)
        )
      );

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
    console.error('Error updating shopping list:', error);
    return c.json({ error: 'Failed to update shopping list' }, 500);
  }
});

/**
 * DELETE /api/shopping-lists/:id
 * Delete a shopping list (cascade deletes items)
 */
app.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid list ID' }, 400);
  }

  try {
    // Verify ownership
    const [existingList] = await db
      .select()
      .from(shoppingLists)
      .where(
        and(
          eq(shoppingLists.id, id),
          eq(shoppingLists.createdBy, userId)
        )
      );

    if (!existingList) {
      return c.json({ error: 'Shopping list not found' }, 404);
    }

    // Delete the list (items will be cascade deleted)
    await db
      .delete(shoppingLists)
      .where(eq(shoppingLists.id, id));

    return c.json({ message: 'Shopping list deleted successfully' });
  } catch (error) {
    console.error('Error deleting shopping list:', error);
    return c.json({ error: 'Failed to delete shopping list' }, 500);
  }
});

export default app;

import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { shoppingLists, shoppingListItems } from '../db/schema.js';
import { authMiddleware, getUserId } from '../middleware/auth.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper function to verify list ownership
 */
async function verifyListOwnership(listId: number, userId: string) {
  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(
      and(
        eq(shoppingLists.id, listId),
        eq(shoppingLists.createdBy, userId)
      )
    );

  return list;
}

/**
 * GET /api/shopping-lists/:listId/items
 * Get all items for a shopping list with pagination
 */
app.get('/:listId/items', async (c) => {
  const userId = getUserId(c);
  const listId = parseInt(c.req.param('listId'));
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '50');
  const offset = (page - 1) * pageSize;

  if (isNaN(listId)) {
    return c.json({ error: 'Invalid list ID' }, 400);
  }

  try {
    // Verify list ownership
    const list = await verifyListOwnership(listId, userId);
    if (!list) {
      return c.json({ error: 'Shopping list not found' }, 404);
    }

    // Get total count
    const allItems = await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId));

    const total = allItems.length;
    const totalPages = Math.ceil(total / pageSize);

    // Get paginated data ordered by position then creation date
    const data = await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId))
      .orderBy(asc(shoppingListItems.position), asc(shoppingListItems.createdAt))
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
    console.error('Error fetching shopping list items:', error);
    return c.json({ error: 'Failed to fetch shopping list items' }, 500);
  }
});

/**
 * POST /api/shopping-lists/:listId/items
 * Add a new item to a shopping list
 */
app.post('/:listId/items', async (c) => {
  const userId = getUserId(c);
  const listId = parseInt(c.req.param('listId'));

  if (isNaN(listId)) {
    return c.json({ error: 'Invalid list ID' }, 400);
  }

  try {
    // Verify list ownership
    const list = await verifyListOwnership(listId, userId);
    if (!list) {
      return c.json({ error: 'Shopping list not found' }, 404);
    }

    const body = await c.req.json();
    const { name, category, quantity, unit, notes, position } = body;

    if (!name || typeof name !== 'string') {
      return c.json({ error: 'Name is required and must be a string' }, 400);
    }

    const [newItem] = await db
      .insert(shoppingListItems)
      .values({
        listId,
        name,
        category: category || null,
        quantity: quantity?.toString() || '1',
        unit: unit || null,
        notes: notes || null,
        position: position || 0,
        checked: false,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return c.json(newItem, 201);
  } catch (error) {
    console.error('Error creating shopping list item:', error);
    return c.json({ error: 'Failed to create shopping list item' }, 500);
  }
});

/**
 * PATCH /api/shopping-lists/:listId/items/:itemId
 * Update a shopping list item
 */
app.patch('/:listId/items/:itemId', async (c) => {
  const userId = getUserId(c);
  const listId = parseInt(c.req.param('listId'));
  const itemId = parseInt(c.req.param('itemId'));

  if (isNaN(listId) || isNaN(itemId)) {
    return c.json({ error: 'Invalid list ID or item ID' }, 400);
  }

  try {
    // Verify list ownership
    const list = await verifyListOwnership(listId, userId);
    if (!list) {
      return c.json({ error: 'Shopping list not found' }, 404);
    }

    // Verify item exists and belongs to the list
    const [existingItem] = await db
      .select()
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.id, itemId),
          eq(shoppingListItems.listId, listId)
        )
      );

    if (!existingItem) {
      return c.json({ error: 'Shopping list item not found' }, 404);
    }

    const body = await c.req.json();
    const { name, category, quantity, unit, notes, checked, position } = body;

    // Update the item
    const [updatedItem] = await db
      .update(shoppingListItems)
      .set({
        name: name !== undefined ? name : existingItem.name,
        category: category !== undefined ? category : existingItem.category,
        quantity: quantity !== undefined ? quantity.toString() : existingItem.quantity,
        unit: unit !== undefined ? unit : existingItem.unit,
        notes: notes !== undefined ? notes : existingItem.notes,
        checked: checked !== undefined ? checked : existingItem.checked,
        checkedAt: checked === true ? new Date() : (checked === false ? null : existingItem.checkedAt),
        checkedBy: checked === true ? userId : (checked === false ? null : existingItem.checkedBy),
        position: position !== undefined ? position : existingItem.position,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(shoppingListItems.id, itemId))
      .returning();

    return c.json(updatedItem);
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    return c.json({ error: 'Failed to update shopping list item' }, 500);
  }
});

/**
 * PATCH /api/shopping-lists/:listId/items/:itemId/toggle
 * Toggle the checked state of a shopping list item
 */
app.patch('/:listId/items/:itemId/toggle', async (c) => {
  const userId = getUserId(c);
  const listId = parseInt(c.req.param('listId'));
  const itemId = parseInt(c.req.param('itemId'));

  if (isNaN(listId) || isNaN(itemId)) {
    return c.json({ error: 'Invalid list ID or item ID' }, 400);
  }

  try {
    // Verify list ownership
    const list = await verifyListOwnership(listId, userId);
    if (!list) {
      return c.json({ error: 'Shopping list not found' }, 404);
    }

    // Get the current item
    const [existingItem] = await db
      .select()
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.id, itemId),
          eq(shoppingListItems.listId, listId)
        )
      );

    if (!existingItem) {
      return c.json({ error: 'Shopping list item not found' }, 404);
    }

    // Toggle the checked state
    const newCheckedState = !existingItem.checked;

    const [updatedItem] = await db
      .update(shoppingListItems)
      .set({
        checked: newCheckedState,
        checkedAt: newCheckedState ? new Date() : null,
        checkedBy: newCheckedState ? userId : null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(shoppingListItems.id, itemId))
      .returning();

    return c.json(updatedItem);
  } catch (error) {
    console.error('Error toggling shopping list item:', error);
    return c.json({ error: 'Failed to toggle shopping list item' }, 500);
  }
});

/**
 * DELETE /api/shopping-lists/:listId/items/:itemId
 * Delete a shopping list item
 */
app.delete('/:listId/items/:itemId', async (c) => {
  const userId = getUserId(c);
  const listId = parseInt(c.req.param('listId'));
  const itemId = parseInt(c.req.param('itemId'));

  if (isNaN(listId) || isNaN(itemId)) {
    return c.json({ error: 'Invalid list ID or item ID' }, 400);
  }

  try {
    // Verify list ownership
    const list = await verifyListOwnership(listId, userId);
    if (!list) {
      return c.json({ error: 'Shopping list not found' }, 404);
    }

    // Verify item exists and belongs to the list
    const [existingItem] = await db
      .select()
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.id, itemId),
          eq(shoppingListItems.listId, listId)
        )
      );

    if (!existingItem) {
      return c.json({ error: 'Shopping list item not found' }, 404);
    }

    // Delete the item
    await db
      .delete(shoppingListItems)
      .where(eq(shoppingListItems.id, itemId));

    return c.json({ message: 'Shopping list item deleted successfully' });
  } catch (error) {
    console.error('Error deleting shopping list item:', error);
    return c.json({ error: 'Failed to delete shopping list item' }, 500);
  }
});

export default app;

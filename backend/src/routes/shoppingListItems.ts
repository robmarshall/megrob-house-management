import { Hono } from "hono";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { shoppingLists, shoppingListItems } from "../db/schema.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";
import { addOrMergeItem } from "../services/shoppingListItemService.js";
import { validateBody, getValidatedBody } from "../middleware/validation.js";
import { logger } from "../lib/logger.js";
import {
  createShoppingListItemSchema,
  updateShoppingListItemSchema,
  type CreateShoppingListItemInput,
  type UpdateShoppingListItemInput,
} from "../lib/validation.js";

const app = new Hono();

// Apply auth middleware to all routes
app.use("*", authMiddleware);

/**
 * Helper to normalize shopping list item for API response
 * Converts quantity from PostgreSQL numeric (string) to number
 */
function normalizeItem<T extends { quantity: string | null }>(item: T): T & { quantity: number } {
  return {
    ...item,
    quantity: item.quantity ? parseFloat(item.quantity) : 1,
  };
}

/**
 * Helper function to verify list ownership
 */
async function verifyListOwnership(listId: number, userId: string) {
  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(
      and(eq(shoppingLists.id, listId), eq(shoppingLists.createdBy, userId))
    );

  return list;
}

/**
 * GET /api/shopping-lists/:listId/items
 * Get all items for a shopping list with pagination
 */
app.get("/:listId/items", async (c) => {
  const userId = getUserId(c);
  const listId = parseInt(c.req.param("listId"));
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = parseInt(c.req.query("pageSize") || "50");

  if (isNaN(page) || page < 1) {
    return c.json({ error: "Invalid page parameter: must be a positive integer" }, 400);
  }
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    return c.json({ error: "Invalid pageSize parameter: must be between 1 and 100" }, 400);
  }

  const offset = (page - 1) * pageSize;

  if (isNaN(listId)) {
    return c.json({ error: "Invalid list ID" }, 400);
  }

  try {
    // Verify list ownership
    const list = await verifyListOwnership(listId, userId);
    if (!list) {
      return c.json({ error: "Shopping list not found" }, 404);
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
      .orderBy(
        asc(shoppingListItems.position),
        asc(shoppingListItems.createdAt)
      )
      .limit(pageSize)
      .offset(offset);

    return c.json({
      data: data.map(normalizeItem),
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    logger.error({ err: error }, "Error fetching shopping list items");
    return c.json({ error: "Failed to fetch shopping list items" }, 500);
  }
});

/**
 * POST /api/shopping-lists/:listId/items
 * Add a new item to a shopping list
 */
app.post("/:listId/items", validateBody(createShoppingListItemSchema), async (c) => {
  const userId = getUserId(c);
  const listId = parseInt(c.req.param("listId"));

  if (isNaN(listId)) {
    return c.json({ error: "Invalid list ID" }, 400);
  }

  try {
    // Verify list ownership
    const list = await verifyListOwnership(listId, userId);
    if (!list) {
      return c.json({ error: "Shopping list not found" }, 404);
    }

    const { name, category, quantity, unit, notes, position } = getValidatedBody<CreateShoppingListItemInput>(c);

    const result = await addOrMergeItem({
      listId,
      name,
      category,
      quantity,
      unit,
      notes,
      position,
      createdBy: userId,
      updatedBy: userId,
    });

    return c.json(
      {
        ...normalizeItem(result.item),
        merged: result.merged,
        ...(result.previousQuantity && { previousQuantity: parseFloat(result.previousQuantity) }),
      },
      result.merged ? 200 : 201
    );
  } catch (error) {
    logger.error({ err: error }, "Error creating shopping list item");
    return c.json({ error: "Failed to create shopping list item" }, 500);
  }
});

/**
 * PATCH /api/shopping-lists/:listId/items/:itemId
 * Update a shopping list item
 */
app.patch("/:listId/items/:itemId", validateBody(updateShoppingListItemSchema), async (c) => {
  const userId = getUserId(c);
  const listId = parseInt(c.req.param("listId"));
  const itemId = parseInt(c.req.param("itemId"));

  if (isNaN(listId) || isNaN(itemId)) {
    return c.json({ error: "Invalid list ID or item ID" }, 400);
  }

  try {
    // Verify list ownership
    const list = await verifyListOwnership(listId, userId);
    if (!list) {
      return c.json({ error: "Shopping list not found" }, 404);
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
      return c.json({ error: "Shopping list item not found" }, 404);
    }

    const { name, category, quantity, unit, notes, checked, position } = getValidatedBody<UpdateShoppingListItemInput>(c);

    // Update the item
    const [updatedItem] = await db
      .update(shoppingListItems)
      .set({
        name: name !== undefined ? name : existingItem.name,
        category: category !== undefined ? category : existingItem.category,
        quantity:
          quantity !== undefined ? quantity.toString() : existingItem.quantity,
        unit: unit !== undefined ? unit : existingItem.unit,
        notes: notes !== undefined ? notes : existingItem.notes,
        checked: checked !== undefined ? checked : existingItem.checked,
        checkedAt:
          checked === true
            ? new Date()
            : checked === false
            ? null
            : existingItem.checkedAt,
        checkedBy:
          checked === true
            ? userId
            : checked === false
            ? null
            : existingItem.checkedBy,
        position: position !== undefined ? position : existingItem.position,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(shoppingListItems.id, itemId))
      .returning();

    return c.json(normalizeItem(updatedItem));
  } catch (error) {
    logger.error({ err: error }, "Error updating shopping list item");
    return c.json({ error: "Failed to update shopping list item" }, 500);
  }
});

/**
 * PATCH /api/shopping-lists/:listId/items/:itemId/toggle
 * Toggle the checked state of a shopping list item
 */
app.patch("/:listId/items/:itemId/toggle", async (c) => {
  const userId = getUserId(c);
  const listId = parseInt(c.req.param("listId"));
  const itemId = parseInt(c.req.param("itemId"));

  if (isNaN(listId) || isNaN(itemId)) {
    return c.json({ error: "Invalid list ID or item ID" }, 400);
  }

  try {
    // Verify list ownership
    const list = await verifyListOwnership(listId, userId);
    if (!list) {
      return c.json({ error: "Shopping list not found" }, 404);
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
      return c.json({ error: "Shopping list item not found" }, 404);
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

    return c.json(normalizeItem(updatedItem));
  } catch (error) {
    logger.error({ err: error }, "Error toggling shopping list item");
    return c.json({ error: "Failed to toggle shopping list item" }, 500);
  }
});

/**
 * DELETE /api/shopping-lists/:listId/items/:itemId
 * Delete a shopping list item
 */
app.delete("/:listId/items/:itemId", async (c) => {
  const userId = getUserId(c);
  const listId = parseInt(c.req.param("listId"));
  const itemId = parseInt(c.req.param("itemId"));

  if (isNaN(listId) || isNaN(itemId)) {
    return c.json({ error: "Invalid list ID or item ID" }, 400);
  }

  try {
    // Verify list ownership
    const list = await verifyListOwnership(listId, userId);
    if (!list) {
      return c.json({ error: "Shopping list not found" }, 404);
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
      return c.json({ error: "Shopping list item not found" }, 404);
    }

    // Delete the item
    await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId));

    return c.json({ message: "Shopping list item deleted successfully" });
  } catch (error) {
    logger.error({ err: error }, "Error deleting shopping list item");
    return c.json({ error: "Failed to delete shopping list item" }, 500);
  }
});

export default app;

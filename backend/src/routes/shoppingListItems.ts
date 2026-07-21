import { Hono } from "hono";
// db imports remain for the toggle endpoint, which is frontend-only and stays inline
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { shoppingListItems } from "../db/schema.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";
import {
  addOrMergeItem,
  getShoppingListItems,
  updateShoppingListItem,
  removeShoppingListItem,
  normalizeItem,
} from "../services/shoppingListItemService.js";
import {
  resolveItemCategories,
  rememberItemCategory,
} from "../services/categoryService.js";
import { validateBody, getValidatedBody } from "../middleware/validation.js";
import { logger } from "../lib/logger.js";
import { verifyShoppingListAccess } from "../lib/shoppingListAccess.js";
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

  if (isNaN(listId)) {
    return c.json({ error: "Invalid list ID" }, 400);
  }

  try {
    const result = await getShoppingListItems(userId, listId, { page, pageSize });
    if (!result) {
      return c.json({ error: "Shopping list not found" }, 404);
    }

    return c.json({
      data: result.data.map(normalizeItem),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
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
    const list = await verifyShoppingListAccess(listId, userId);
    if (!list) {
      return c.json({ error: "Shopping list not found" }, 404);
    }

    const { name, category, quantity, unit, notes, position } = getValidatedBody<CreateShoppingListItemInput>(c);

    if (category) {
      // The user picked a category explicitly — learn it for future adds.
      await rememberItemCategory(userId, name, category);
    }

    // Auto-categorize when the user didn't pick one (learned memory, then
    // keyword dictionary, then uncategorized).
    const [input] = await resolveItemCategories(userId, [
      {
        listId,
        name,
        category,
        quantity,
        unit,
        notes,
        position,
        createdBy: userId,
        updatedBy: userId,
      },
    ]);

    const result = await addOrMergeItem(input);

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
    const input = getValidatedBody<UpdateShoppingListItemInput>(c);
    const result = await updateShoppingListItem(userId, listId, itemId, input);

    if (result.ok && input.category) {
      // Manual category corrections are the strongest signal — remember them
      // so future adds of this item are categorized the same way.
      await rememberItemCategory(userId, result.item.name, input.category);
    }

    if (!result.ok) {
      return c.json(
        {
          error:
            result.reason === "list_not_found"
              ? "Shopping list not found"
              : "Shopping list item not found",
        },
        404
      );
    }

    return c.json(normalizeItem(result.item));
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
    const list = await verifyShoppingListAccess(listId, userId);
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
    const result = await removeShoppingListItem(userId, listId, itemId);

    if (!result.ok) {
      return c.json(
        {
          error:
            result.reason === "list_not_found"
              ? "Shopping list not found"
              : "Shopping list item not found",
        },
        404
      );
    }

    return c.json({ message: "Shopping list item deleted successfully" });
  } catch (error) {
    logger.error({ err: error }, "Error deleting shopping list item");
    return c.json({ error: "Failed to delete shopping list item" }, 500);
  }
});

export default app;

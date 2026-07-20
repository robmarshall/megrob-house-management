/**
 * Shopping list item service for add-or-merge logic.
 * Detects duplicate items and merges quantities when appropriate.
 */

import { db } from '../db/index.js';
import { shoppingListItems, shoppingLists } from '../db/schema.js';
import { eq, and, asc, sql } from 'drizzle-orm';
import {
  findMatchingItem,
  combineNotes,
  type MatchableItem,
} from '../lib/itemMatcher.js';
import { verifyShoppingListAccess } from '../lib/shoppingListAccess.js';

// Namespace constant for Postgres advisory locks used to serialize
// add-or-merge operations per shopping list. 0x5348 == 'SH' (arbitrary).
const ADVISORY_LOCK_NAMESPACE = 0x5348;

export interface AddItemInput {
  listId: number;
  name: string;
  quantity?: string | number;
  unit?: string | null;
  notes?: string | null;
  category?: string | null;
  position?: number;
  createdBy: string;
  updatedBy: string;
}

export interface AddItemResult {
  item: typeof shoppingListItems.$inferSelect;
  merged: boolean;
  previousQuantity?: string;
}

/**
 * Add an item to a shopping list, merging with existing items if a match is found.
 *
 * Match criteria:
 * - Name matches (fuzzy singular/plural)
 * - Unit matches exactly (or both null)
 * - Existing item is NOT checked
 *
 * When merging:
 * - Quantity is summed
 * - Notes are combined (avoiding duplicates)
 * - Original item's other properties preserved
 */
export async function addOrMergeItem(
  input: AddItemInput
): Promise<AddItemResult> {
  const {
    listId,
    name,
    quantity = '1',
    unit,
    notes,
    category,
    position,
    createdBy,
    updatedBy,
  } = input;

  // Serialize concurrent add-or-merge operations for the SAME list.
  //
  // Without this, the read (SELECT existing items) -> match -> write
  // (UPDATE or INSERT) sequence is a classic read-modify-write race: two
  // concurrent adds to the same shared list can both read "no match" and
  // both INSERT, producing duplicate rows, lost quantity merges, and
  // colliding sort positions.
  //
  // We wrap the whole read-match-write in a transaction and take a
  // transaction-scoped Postgres advisory lock keyed on the list id as the
  // FIRST statement. Operations on the same list block each other; operations
  // on different lists (different key) do not. The postgres.js driver pools
  // connections, so concurrent db.transaction() calls run on separate
  // connections and the advisory lock correctly serializes them. The lock is
  // released automatically at commit/rollback.
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${ADVISORY_LOCK_NAMESPACE}, ${listId})`
    );

    // Fetch existing items for this list
    const existingItems = await tx
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId))
      .orderBy(asc(shoppingListItems.position));

    // Find a matching item
    const matchingItem = findMatchingItem(
      name,
      unit,
      existingItems as MatchableItem[]
    );

    if (matchingItem) {
      // MERGE: Update existing item
      const existingQty = parseFloat(matchingItem.quantity || '1');
      const newQty = parseFloat(quantity?.toString() || '1');
      const combinedQty = existingQty + newQty;
      const combinedNotes = combineNotes(matchingItem.notes, notes);

      const [updatedItem] = await tx
        .update(shoppingListItems)
        .set({
          quantity: combinedQty.toString(),
          notes: combinedNotes,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(shoppingListItems.id, matchingItem.id))
        .returning();

      return {
        item: updatedItem,
        merged: true,
        previousQuantity: matchingItem.quantity || '1',
      };
    }

    // INSERT: Create new item
    const maxPosition =
      existingItems.length > 0
        ? Math.max(...existingItems.map((i) => i.position))
        : -1;

    const [newItem] = await tx
      .insert(shoppingListItems)
      .values({
        listId,
        name,
        category: category || null,
        quantity: quantity?.toString() || '1',
        unit: unit || null,
        notes: notes || null,
        position: position ?? maxPosition + 1,
        checked: false,
        createdBy,
        updatedBy,
      })
      .returning();

    return {
      item: newItem,
      merged: false,
    };
  });
}

/**
 * Bulk add items with merging support.
 * Items are processed sequentially so earlier items in the batch
 * can be merged with later items in the same batch.
 *
 * Returns results for each item indicating whether it was merged or inserted.
 */
export async function addOrMergeItems(
  items: AddItemInput[]
): Promise<AddItemResult[]> {
  const results: AddItemResult[] = [];

  for (const item of items) {
    const result = await addOrMergeItem(item);
    results.push(result);
  }

  return results;
}

/**
 * Normalize a shopping list item for API/tool responses:
 * converts quantity from PostgreSQL numeric (string) to number.
 */
export function normalizeItem<T extends { quantity: string | null }>(
  item: T
): T & { quantity: number } {
  return {
    ...item,
    quantity: item.quantity ? parseFloat(item.quantity) : 1,
  };
}

type ShoppingListRow = typeof shoppingLists.$inferSelect;
type ShoppingListItemRow = typeof shoppingListItems.$inferSelect;

export interface GetItemsResult {
  list: ShoppingListRow;
  data: ShoppingListItemRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Paginated items for one shopping list. Access is verified against the user
 * (household or personal ownership); returns null when the list doesn't exist
 * or the user can't see it. Shared by the REST route and the MCP tool.
 */
export async function getShoppingListItems(
  userId: string,
  listId: number,
  { page = 1, pageSize = 50 }: { page?: number; pageSize?: number } = {}
): Promise<GetItemsResult | null> {
  const list = await verifyShoppingListAccess(listId, userId);
  if (!list) return null;

  const offset = (page - 1) * pageSize;

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shoppingListItems)
    .where(eq(shoppingListItems.listId, listId));
  const total = countResult[0]?.count || 0;
  const totalPages = Math.ceil(total / pageSize);

  const data = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.listId, listId))
    .orderBy(asc(shoppingListItems.position), asc(shoppingListItems.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { list, data, total, page, pageSize, totalPages };
}

export interface UpdateItemInput {
  name?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  checked?: boolean;
  position?: number;
}

export type ItemMutationResult =
  | { ok: true; item: ShoppingListItemRow }
  | { ok: false; reason: 'list_not_found' | 'item_not_found' };

/**
 * Partial update of one item. Only fields passed as non-undefined change;
 * checking/unchecking also stamps/clears checkedAt + checkedBy.
 */
export async function updateShoppingListItem(
  userId: string,
  listId: number,
  itemId: number,
  input: UpdateItemInput
): Promise<ItemMutationResult> {
  const list = await verifyShoppingListAccess(listId, userId);
  if (!list) return { ok: false, reason: 'list_not_found' };

  const [existingItem] = await db
    .select()
    .from(shoppingListItems)
    .where(
      and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.listId, listId))
    );
  if (!existingItem) return { ok: false, reason: 'item_not_found' };

  const { name, category, quantity, unit, notes, checked, position } = input;

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
        checked === true ? userId : checked === false ? null : existingItem.checkedBy,
      position: position !== undefined ? position : existingItem.position,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(shoppingListItems.id, itemId))
    .returning();

  return { ok: true, item: updatedItem };
}

/**
 * Delete one item from a list the user can access.
 */
export async function removeShoppingListItem(
  userId: string,
  listId: number,
  itemId: number
): Promise<ItemMutationResult> {
  const list = await verifyShoppingListAccess(listId, userId);
  if (!list) return { ok: false, reason: 'list_not_found' };

  const [existingItem] = await db
    .select()
    .from(shoppingListItems)
    .where(
      and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.listId, listId))
    );
  if (!existingItem) return { ok: false, reason: 'item_not_found' };

  await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId));

  return { ok: true, item: existingItem };
}

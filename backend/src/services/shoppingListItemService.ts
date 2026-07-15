/**
 * Shopping list item service for add-or-merge logic.
 * Detects duplicate items and merges quantities when appropriate.
 */

import { db } from '../db/index.js';
import { shoppingListItems } from '../db/schema.js';
import { eq, asc, sql } from 'drizzle-orm';
import {
  findMatchingItem,
  combineNotes,
  type MatchableItem,
} from '../lib/itemMatcher.js';

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

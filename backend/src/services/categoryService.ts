/**
 * Auto-categorization for shopping list items.
 *
 * Resolution order when an item arrives without a category:
 * 1. Learned memory (item_category_memory) — what this household (or user,
 *    when they have no household) last explicitly set for the same
 *    normalized item name.
 * 2. Built-in keyword dictionary (lib/categories.ts).
 * 3. No category (renders as "Uncategorized").
 *
 * Memory is written only on explicit human choices (picking a category when
 * adding an item, or editing an item's category) — never from dictionary
 * guesses, so a bad guess can't reinforce itself.
 */

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { itemCategoryMemory } from '../db/schema.js';
import { guessCategory } from '../lib/categories.js';
import { normalizeItemName } from '../lib/itemMatcher.js';
import { getUserHouseholdId } from '../lib/household.js';

interface CategorizableItem {
  name: string;
  category?: string | null;
}

/**
 * Fetch learned categories for the given item names, scoped to the user's
 * household (or the user themselves when they have no household).
 * Returns a map of normalized name -> category.
 */
async function lookupLearnedCategories(
  userId: string,
  householdId: number | null,
  normalizedNames: string[]
): Promise<Map<string, string>> {
  if (normalizedNames.length === 0) return new Map();

  const scope =
    householdId !== null
      ? eq(itemCategoryMemory.householdId, householdId)
      : and(
          eq(itemCategoryMemory.userId, userId),
          isNull(itemCategoryMemory.householdId)
        );

  const rows = await db
    .select({
      normalizedName: itemCategoryMemory.normalizedName,
      category: itemCategoryMemory.category,
    })
    .from(itemCategoryMemory)
    .where(and(scope, inArray(itemCategoryMemory.normalizedName, normalizedNames)));

  return new Map(rows.map((r) => [r.normalizedName, r.category]));
}

/**
 * Fill in a category for every item that doesn't already have one, using
 * learned memory first and the keyword dictionary as fallback. Items that
 * arrive with a category are passed through untouched.
 */
export async function resolveItemCategories<T extends CategorizableItem>(
  userId: string,
  items: T[]
): Promise<Array<T & { category?: string | null }>> {
  const missing = items.filter((item) => !item.category);
  if (missing.length === 0) return items;

  const householdId = await getUserHouseholdId(userId);
  const normalizedNames = [
    ...new Set(missing.map((item) => normalizeItemName(item.name)).filter(Boolean)),
  ];
  const learned = await lookupLearnedCategories(userId, householdId, normalizedNames);

  return items.map((item) => {
    if (item.category) return item;
    const category =
      learned.get(normalizeItemName(item.name)) ?? guessCategory(item.name);
    return category ? { ...item, category } : item;
  });
}

/**
 * Record an explicit user choice of category for an item name so future adds
 * of the same item are categorized the same way. Upserts into the household
 * scope when the user belongs to one, otherwise into their personal scope.
 *
 * No-ops for empty/`default` categories ("uncategorized" is not a preference
 * worth remembering — the next add just falls back to the dictionary).
 */
export async function rememberItemCategory(
  userId: string,
  itemName: string,
  category: string
): Promise<void> {
  if (!category || category === 'default') return;

  const normalizedName = normalizeItemName(itemName);
  if (!normalizedName) return;

  const householdId = await getUserHouseholdId(userId);
  const values = {
    householdId,
    userId,
    normalizedName,
    category,
    updatedAt: new Date(),
  };

  if (householdId !== null) {
    await db
      .insert(itemCategoryMemory)
      .values(values)
      .onConflictDoUpdate({
        target: [itemCategoryMemory.householdId, itemCategoryMemory.normalizedName],
        targetWhere: sql`${itemCategoryMemory.householdId} is not null`,
        set: { category, userId, updatedAt: values.updatedAt },
      });
  } else {
    await db
      .insert(itemCategoryMemory)
      .values(values)
      .onConflictDoUpdate({
        target: [itemCategoryMemory.userId, itemCategoryMemory.normalizedName],
        targetWhere: sql`${itemCategoryMemory.householdId} is null`,
        set: { category, updatedAt: values.updatedAt },
      });
  }
}

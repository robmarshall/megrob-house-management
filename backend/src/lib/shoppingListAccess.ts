import { eq, and, or, isNull, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { shoppingLists } from "../db/schema.js";
import { getUserHouseholdId } from "./household.js";

/**
 * Verify shopping list access (household or personal ownership).
 *
 * A user has access if:
 *   - The list belongs to their household, OR
 *   - The list is a personal list (no household) created by them
 *
 * Returns the list row if the user has access, or `undefined` otherwise.
 */
export async function verifyShoppingListAccess(listId: number, userId: string) {
  const householdId = await getUserHouseholdId(userId);

  let accessFilter: SQL;
  if (householdId) {
    accessFilter = or(
      eq(shoppingLists.householdId, householdId),
      and(eq(shoppingLists.createdBy, userId), isNull(shoppingLists.householdId))
    )!;
  } else {
    accessFilter = eq(shoppingLists.createdBy, userId);
  }

  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, listId), accessFilter));

  return list;
}

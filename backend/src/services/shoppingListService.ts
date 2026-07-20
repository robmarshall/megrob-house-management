import { eq, and, desc, or, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { shoppingLists } from '../db/schema.js';
import { getUserHouseholdId } from '../lib/household.js';

/**
 * Build a WHERE condition that scopes shopping lists to the user's household
 * or to the user's own lists if they don't belong to a household.
 */
export function listAccessCondition(
  userId: string,
  householdId: number | null
): SQL {
  if (householdId) {
    // User belongs to a household: see all household lists + their own non-household lists
    return or(
      eq(shoppingLists.householdId, householdId),
      and(eq(shoppingLists.createdBy, userId), isNull(shoppingLists.householdId))
    )!;
  }
  // No household: only see own lists
  return eq(shoppingLists.createdBy, userId);
}

export interface ListShoppingListsResult {
  data: (typeof shoppingLists.$inferSelect)[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Paginated shopping lists visible to a user (household-shared plus their own
 * personal lists). Shared by the REST route and the MCP tool.
 */
export async function listShoppingLists(
  userId: string,
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {}
): Promise<ListShoppingListsResult> {
  const offset = (page - 1) * pageSize;

  const householdId = await getUserHouseholdId(userId);
  const accessFilter = listAccessCondition(userId, householdId);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shoppingLists)
    .where(accessFilter);
  const total = countResult[0]?.count || 0;
  const totalPages = Math.ceil(total / pageSize);

  const data = await db
    .select()
    .from(shoppingLists)
    .where(accessFilter)
    .orderBy(desc(shoppingLists.updatedAt))
    .limit(pageSize)
    .offset(offset);

  return { data, total, page, pageSize, totalPages };
}

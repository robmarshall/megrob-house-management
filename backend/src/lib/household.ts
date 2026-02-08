import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { householdMembers } from '../db/schema.js';

/**
 * Get the household ID for a user, or null if they don't belong to one.
 * Used across routes to scope data queries to the user's household.
 */
export async function getUserHouseholdId(userId: string): Promise<number | null> {
  const [membership] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId));

  return membership?.householdId ?? null;
}

import { and, eq, isNull, notExists } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../db/index.js';
import { householdMembers, mealPlans, recipes, shoppingLists } from '../db/schema.js';

/**
 * Drizzle transaction handle type, derived from the callback argument passed to
 * `db.transaction(async (tx) => ...)`.
 */
export type HouseholdTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

/**
 * Adopt a user's personal data (recipes, shopping lists, meal plans with no
 * household) into the given household. Called when the user creates or joins
 * a household so their existing content becomes visible to all members.
 *
 * Meal plans are skipped for any week where the household already has a plan
 * (partial unique index idx_meal_plans_week_household); those stay personal.
 */
export async function adoptPersonalData(
  tx: HouseholdTx,
  userId: string,
  householdId: number
): Promise<void> {
  await tx
    .update(recipes)
    .set({ householdId })
    .where(and(eq(recipes.createdBy, userId), isNull(recipes.householdId)));

  await tx
    .update(shoppingLists)
    .set({ householdId })
    .where(and(eq(shoppingLists.createdBy, userId), isNull(shoppingLists.householdId)));

  const householdPlans = alias(mealPlans, 'household_plans');
  await tx
    .update(mealPlans)
    .set({ householdId })
    .where(
      and(
        eq(mealPlans.createdBy, userId),
        isNull(mealPlans.householdId),
        notExists(
          db
            .select({ id: householdPlans.id })
            .from(householdPlans)
            .where(
              and(
                eq(householdPlans.householdId, householdId),
                eq(householdPlans.weekStartDate, mealPlans.weekStartDate)
              )
            )
        )
      )
    );
}

/**
 * Return a departing user's contributions (records they created in the given
 * household) to personal scope. Called when the user leaves or is removed, so
 * they keep their own content instead of losing access to it — and so a sole
 * owner's data survives the household delete (household_id cascades).
 *
 * Meal plans are skipped for any week where the user already has a personal
 * plan (partial unique index idx_meal_plans_week_user); those stay with the
 * household.
 */
export async function reclaimPersonalData(
  tx: HouseholdTx,
  userId: string,
  householdId: number
): Promise<void> {
  await tx
    .update(recipes)
    .set({ householdId: null })
    .where(and(eq(recipes.createdBy, userId), eq(recipes.householdId, householdId)));

  await tx
    .update(shoppingLists)
    .set({ householdId: null })
    .where(and(eq(shoppingLists.createdBy, userId), eq(shoppingLists.householdId, householdId)));

  const personalPlans = alias(mealPlans, 'personal_plans');
  await tx
    .update(mealPlans)
    .set({ householdId: null })
    .where(
      and(
        eq(mealPlans.createdBy, userId),
        eq(mealPlans.householdId, householdId),
        notExists(
          db
            .select({ id: personalPlans.id })
            .from(personalPlans)
            .where(
              and(
                eq(personalPlans.createdBy, userId),
                isNull(personalPlans.householdId),
                eq(personalPlans.weekStartDate, mealPlans.weekStartDate)
              )
            )
        )
      )
    );
}

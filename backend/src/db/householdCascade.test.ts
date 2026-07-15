import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db } from './index.js';
import {
  user,
  households,
  householdMembers,
  shoppingLists,
  recipes,
  mealPlans,
} from './schema.js';

/**
 * DB-backed regression test for migration 0009 (ON DELETE CASCADE on
 * shopping_lists.household_id, recipes.household_id, meal_plans.household_id).
 *
 * Before the fix, deleting a household that had created any list/recipe/meal
 * plan raised a foreign-key violation (surfaced as a 500 when a sole owner
 * tried to leave/delete their household). This test proves the delete now
 * cascades to the child rows instead of erroring.
 *
 * Wired to the dedicated test database via vitest.config.ts (test.env sets
 * DATABASE_URL before any module loads, so the singleton `db` connects there).
 */

// Unique per-run suffix so fixtures never collide with other data / runs.
const RUN = `hhcascade_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const USER_ID = `${RUN}_owner`;

// Captured fixture IDs (serial PKs) populated during setup.
let householdId: number;

async function cleanup() {
  // FK-safe: TRUNCATE CASCADE clears dependents (household_members,
  // shopping_lists, recipes, meal_plans, households) regardless of
  // ON DELETE rules, giving each test a clean slate.
  await db.execute(
    sql`TRUNCATE TABLE ${mealPlans}, ${recipes}, ${shoppingLists}, ${householdMembers}, ${households}, ${user} RESTART IDENTITY CASCADE`
  );
}

beforeEach(async () => {
  await cleanup();

  await db.insert(user).values({
    id: USER_ID,
    name: 'Cascade Owner',
    email: `${USER_ID}@example.test`,
    emailVerified: true,
  });

  const [hh] = await db
    .insert(households)
    .values({ name: `${RUN}_household`, createdBy: USER_ID })
    .returning();
  householdId = hh.id;

  await db.insert(householdMembers).values({
    householdId,
    userId: USER_ID,
    role: 'owner',
  });

  // One child row per cascading table, all referencing this household.
  await db.insert(shoppingLists).values({
    name: `${RUN}_list`,
    householdId,
    createdBy: USER_ID,
    updatedBy: USER_ID,
  });

  await db.insert(recipes).values({
    name: `${RUN}_recipe`,
    instructions: '["Step one", "Step two"]',
    householdId,
    createdBy: USER_ID,
    updatedBy: USER_ID,
  });

  await db.insert(mealPlans).values({
    name: `${RUN}_mealPlan`,
    weekStartDate: '2026-07-13',
    householdId,
    createdBy: USER_ID,
    updatedBy: USER_ID,
  });
});

afterAll(async () => {
  await cleanup();
});

async function countFor(
  table: typeof shoppingLists | typeof recipes | typeof mealPlans
): Promise<number> {
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.householdId, householdId));
  return rows.length;
}

describe('household delete cascade (migration 0009)', () => {
  it('seeds one child row per cascading table before the delete', async () => {
    expect(await countFor(shoppingLists)).toBe(1);
    expect(await countFor(recipes)).toBe(1);
    expect(await countFor(mealPlans)).toBe(1);
  });

  it('deletes the household without a FK violation and cascades to children', async () => {
    // Under the old schema (no ON DELETE action) this threw a foreign-key
    // violation because dependent rows still referenced the household.
    await expect(
      db.delete(households).where(eq(households.id, householdId))
    ).resolves.not.toThrow();

    // The household row is gone...
    const remainingHouseholds = await db
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId));
    expect(remainingHouseholds).toHaveLength(0);

    // ...and so are all of its child rows.
    expect(await countFor(shoppingLists)).toBe(0);
    expect(await countFor(recipes)).toBe(0);
    expect(await countFor(mealPlans)).toBe(0);
  });
});

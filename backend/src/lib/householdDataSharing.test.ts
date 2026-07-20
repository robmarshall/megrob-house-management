import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { sql, eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  user,
  households,
  householdMembers,
  shoppingLists,
  recipes,
  mealPlans,
} from '../db/schema.js';
import { adoptPersonalData, reclaimPersonalData } from './household.js';

/**
 * DB-backed tests for household data adoption/reclaim.
 *
 * adoptPersonalData: when a user creates or joins a household, their personal
 * records (household_id IS NULL) move into the household so other members can
 * see them. reclaimPersonalData: when a user leaves or is removed, records
 * they created return to personal scope.
 *
 * Meal plans have partial unique indexes (one plan per week per household /
 * per personal user), so both directions skip conflicting weeks.
 */

const RUN = `hhshare_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const OWNER_ID = `${RUN}_owner`;
const MEMBER_ID = `${RUN}_member`;

let householdId: number;

async function cleanup() {
  await db.execute(
    sql`TRUNCATE TABLE ${mealPlans}, ${recipes}, ${shoppingLists}, ${householdMembers}, ${households}, ${user} RESTART IDENTITY CASCADE`
  );
}

beforeEach(async () => {
  await cleanup();

  await db.insert(user).values([
    {
      id: OWNER_ID,
      name: 'Share Owner',
      email: `${OWNER_ID}@example.test`,
      emailVerified: true,
    },
    {
      id: MEMBER_ID,
      name: 'Share Member',
      email: `${MEMBER_ID}@example.test`,
      emailVerified: true,
    },
  ]);

  const [hh] = await db
    .insert(households)
    .values({ name: `${RUN}_household`, createdBy: OWNER_ID })
    .returning();
  householdId = hh.id;

  await db.insert(householdMembers).values({
    householdId,
    userId: OWNER_ID,
    role: 'owner',
  });
});

afterAll(async () => {
  await cleanup();
});

function seedPersonalData(userId: string) {
  return Promise.all([
    db.insert(recipes).values({
      name: `${userId}_recipe`,
      instructions: '["Step one"]',
      createdBy: userId,
      updatedBy: userId,
    }),
    db.insert(shoppingLists).values({
      name: `${userId}_list`,
      createdBy: userId,
      updatedBy: userId,
    }),
    db.insert(mealPlans).values({
      name: `${userId}_plan`,
      weekStartDate: '2026-07-20',
      createdBy: userId,
      updatedBy: userId,
    }),
  ]);
}

async function householdCounts(byUser: string) {
  const [recipeRows, listRows, planRows] = await Promise.all([
    db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(eq(recipes.createdBy, byUser), eq(recipes.householdId, householdId))),
    db
      .select({ id: shoppingLists.id })
      .from(shoppingLists)
      .where(and(eq(shoppingLists.createdBy, byUser), eq(shoppingLists.householdId, householdId))),
    db
      .select({ id: mealPlans.id })
      .from(mealPlans)
      .where(and(eq(mealPlans.createdBy, byUser), eq(mealPlans.householdId, householdId))),
  ]);
  return { recipes: recipeRows.length, lists: listRows.length, plans: planRows.length };
}

describe('adoptPersonalData', () => {
  it('moves the joining user\'s personal records into the household', async () => {
    await seedPersonalData(MEMBER_ID);

    await db.transaction(async (tx) => {
      await adoptPersonalData(tx, MEMBER_ID, householdId);
    });

    expect(await householdCounts(MEMBER_ID)).toEqual({ recipes: 1, lists: 1, plans: 1 });
  });

  it('does not touch other users\' personal records', async () => {
    await seedPersonalData(OWNER_ID);

    await db.transaction(async (tx) => {
      await adoptPersonalData(tx, MEMBER_ID, householdId);
    });

    expect(await householdCounts(OWNER_ID)).toEqual({ recipes: 0, lists: 0, plans: 0 });
  });

  it('leaves a personal meal plan behind when the household already has a plan for that week', async () => {
    // Household plan for the same week the member has a personal plan
    await db.insert(mealPlans).values({
      name: 'existing household plan',
      weekStartDate: '2026-07-20',
      householdId,
      createdBy: OWNER_ID,
      updatedBy: OWNER_ID,
    });
    await seedPersonalData(MEMBER_ID);

    await db.transaction(async (tx) => {
      await adoptPersonalData(tx, MEMBER_ID, householdId);
    });

    // Recipes/lists adopted, but the conflicting week's plan stays personal
    expect(await householdCounts(MEMBER_ID)).toEqual({ recipes: 1, lists: 1, plans: 0 });
    const personalPlans = await db
      .select({ id: mealPlans.id })
      .from(mealPlans)
      .where(and(eq(mealPlans.createdBy, MEMBER_ID), isNull(mealPlans.householdId)));
    expect(personalPlans).toHaveLength(1);
  });
});

describe('reclaimPersonalData', () => {
  it('returns only the departing user\'s records to personal scope', async () => {
    await seedPersonalData(MEMBER_ID);
    await db.insert(recipes).values({
      name: 'owner household recipe',
      instructions: '["Step one"]',
      householdId,
      createdBy: OWNER_ID,
      updatedBy: OWNER_ID,
    });
    await db.transaction(async (tx) => {
      await adoptPersonalData(tx, MEMBER_ID, householdId);
    });

    await db.transaction(async (tx) => {
      await reclaimPersonalData(tx, MEMBER_ID, householdId);
    });

    // Member's records are personal again; owner's recipe stays with the household
    expect(await householdCounts(MEMBER_ID)).toEqual({ recipes: 0, lists: 0, plans: 0 });
    expect(await householdCounts(OWNER_ID)).toEqual({ recipes: 1, lists: 0, plans: 0 });
  });

  it('leaves a household meal plan behind when the user already has a personal plan for that week', async () => {
    // The member holds BOTH a personal plan and a household plan for the same
    // week (the personal one was skipped during adoption). Reclaiming the
    // household plan would violate idx_meal_plans_week_user, so it stays.
    await db.insert(mealPlans).values([
      {
        name: 'kept personal plan',
        weekStartDate: '2026-07-20',
        createdBy: MEMBER_ID,
        updatedBy: MEMBER_ID,
      },
      {
        name: 'household plan',
        weekStartDate: '2026-07-20',
        householdId,
        createdBy: MEMBER_ID,
        updatedBy: MEMBER_ID,
      },
    ]);

    await expect(
      db.transaction(async (tx) => {
        await reclaimPersonalData(tx, MEMBER_ID, householdId);
      })
    ).resolves.not.toThrow();

    expect(await householdCounts(MEMBER_ID)).toEqual({ recipes: 0, lists: 0, plans: 1 });
  });
});

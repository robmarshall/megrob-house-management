import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from './index.js';
import {
  user,
  households,
  householdMembers,
  recipes,
  userFavorites,
  recipeFeedback,
  recipeCategories,
  mealPlans,
} from './schema.js';

/**
 * DB-backed test that the unique constraints/indexes declared in the Drizzle
 * schema (and migration 0010) are actually present and enforced. These prevent
 * duplicate favorites, duplicate feedback/categories, and duplicate weekly meal
 * plans — and this test guards against a future db:push silently dropping them.
 */

const RUN = `uniq_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const USER = `${RUN}_user`;
const WEEK = '2026-07-13';

let recipeId: number;
let householdId: number;

async function cleanup() {
  await db.execute(
    sql`TRUNCATE TABLE ${mealPlans}, ${recipes}, ${households}, ${user} RESTART IDENTITY CASCADE`
  );
}

beforeEach(async () => {
  await cleanup();

  await db.insert(user).values({ id: USER, name: 'U', email: `${USER}@e.test`, emailVerified: true });

  const [hh] = await db.insert(households).values({ name: `${RUN}_hh`, createdBy: USER }).returning();
  householdId = hh.id;
  await db.insert(householdMembers).values({ householdId, userId: USER, role: 'owner' });

  const [r] = await db
    .insert(recipes)
    .values({ name: 'R', instructions: '[]', createdBy: USER, updatedBy: USER })
    .returning();
  recipeId = r.id;
});

afterAll(async () => {
  await cleanup();
});

describe('unique constraints', () => {
  it('rejects duplicate favorites (user_id, recipe_id)', async () => {
    await db.insert(userFavorites).values({ userId: USER, recipeId });
    await expect(db.insert(userFavorites).values({ userId: USER, recipeId })).rejects.toThrow();
  });

  it('rejects duplicate feedback per (recipe_id, user_id)', async () => {
    await db.insert(recipeFeedback).values({ recipeId, userId: USER, isLike: true });
    await expect(
      db.insert(recipeFeedback).values({ recipeId, userId: USER, isLike: false })
    ).rejects.toThrow();
  });

  it('rejects duplicate recipe categories (recipe_id, type, value)', async () => {
    await db.insert(recipeCategories).values({ recipeId, categoryType: 'dietary', categoryValue: 'vegan' });
    await expect(
      db.insert(recipeCategories).values({ recipeId, categoryType: 'dietary', categoryValue: 'vegan' })
    ).rejects.toThrow();
  });

  it('rejects a duplicate personal meal plan for the same week + user', async () => {
    await db.insert(mealPlans).values({ weekStartDate: WEEK, householdId: null, createdBy: USER, updatedBy: USER });
    await expect(
      db.insert(mealPlans).values({ weekStartDate: WEEK, householdId: null, createdBy: USER, updatedBy: USER })
    ).rejects.toThrow();
  });

  it('rejects a duplicate household meal plan for the same week + household', async () => {
    await db.insert(mealPlans).values({ weekStartDate: WEEK, householdId, createdBy: USER, updatedBy: USER });
    await expect(
      db.insert(mealPlans).values({ weekStartDate: WEEK, householdId, createdBy: USER, updatedBy: USER })
    ).rejects.toThrow();
  });

  it('allows a personal and a household plan for the same week (partial indexes are scoped)', async () => {
    await db.insert(mealPlans).values({ weekStartDate: WEEK, householdId: null, createdBy: USER, updatedBy: USER });
    // Different scope (household-scoped) — must NOT collide with the personal one.
    await expect(
      db.insert(mealPlans).values({ weekStartDate: WEEK, householdId, createdBy: USER, updatedBy: USER })
    ).resolves.toBeDefined();
  });
});

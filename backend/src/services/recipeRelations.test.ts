import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { eq, sql, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  user,
  households,
  recipes,
  recipeIngredients,
} from '../db/schema.js';
import { replaceRecipeRelations } from './recipeRelations.js';

/**
 * DB-backed integration test proving replaceRecipeRelations is atomic: a
 * failure after the delete rolls back so the recipe keeps its original child
 * rows. Under the old inline delete-then-insert (no transaction) the delete
 * would have committed and the ingredients would be silently, permanently lost.
 *
 * Wired to the dedicated test database via vitest.config.ts (test.env sets
 * DATABASE_URL before any module loads, so the singleton `db` connects there).
 */

// Unique per-run suffix so fixtures never collide with other data / runs.
const RUN = `rrtest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

const USER_A = `${RUN}_userA`;

let householdId: number;
let recipeId: number;

async function cleanup() {
  // FK-safe: TRUNCATE CASCADE clears dependents (recipe_ingredients,
  // recipe_categories, recipes, households) regardless of ON DELETE rules.
  await db.execute(
    sql`TRUNCATE TABLE ${recipeIngredients}, ${recipes}, ${households}, ${user} RESTART IDENTITY CASCADE`
  );
}

beforeEach(async () => {
  await cleanup();

  await db.insert(user).values([
    { id: USER_A, name: 'User A', email: `${USER_A}@example.test`, emailVerified: true },
  ]);

  const [hh] = await db
    .insert(households)
    .values({ name: `${RUN}_household`, createdBy: USER_A })
    .returning();
  householdId = hh.id;

  const [recipe] = await db
    .insert(recipes)
    .values({
      name: `${RUN}_recipe`,
      householdId,
      instructions: '[]',
      status: 'ready',
      createdBy: USER_A,
      updatedBy: USER_A,
    })
    .returning();
  recipeId = recipe.id;

  await db.insert(recipeIngredients).values([
    { recipeId, name: 'Flour', quantity: '2', unit: 'cups', notes: null, position: 0 },
    { recipeId, name: 'Sugar', quantity: '1', unit: 'cup', notes: null, position: 1 },
  ]);
});

afterAll(async () => {
  await cleanup();
});

async function currentIngredients() {
  return db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.position));
}

describe('replaceRecipeRelations', () => {
  it('rolls back the delete when the transaction fails, preserving original ingredients', async () => {
    await expect(
      db.transaction(async (tx) => {
        await replaceRecipeRelations(tx, recipeId, { ingredients: [] });
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    // The delete was rolled back: the original 2 ingredients survive.
    const ingredients = await currentIngredients();
    expect(ingredients).toHaveLength(2);
    expect(ingredients.map((i) => i.name)).toEqual(['Flour', 'Sugar']);
  });

  it('replaces the ingredients on the happy path with correct positions', async () => {
    await db.transaction(async (tx) =>
      replaceRecipeRelations(tx, recipeId, {
        ingredients: [
          { name: 'Butter', quantity: 3, unit: 'tbsp', notes: 'softened' },
          { name: 'Eggs', quantity: 2, unit: undefined, notes: undefined },
        ],
      })
    );

    const ingredients = await currentIngredients();
    expect(ingredients).toHaveLength(2);
    expect(ingredients.map((i) => ({ name: i.name, position: i.position }))).toEqual([
      { name: 'Butter', position: 0 },
      { name: 'Eggs', position: 1 },
    ]);
    expect(ingredients[0].unit).toBe('tbsp');
    expect(ingredients[0].notes).toBe('softened');
  });
});

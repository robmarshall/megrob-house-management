import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user, recipes, recipeIngredients } from '../db/schema.js';
import { setRecipeSharing } from '../services/recipeService.js';
import publicRecipesRoutes from './publicRecipes.js';

/**
 * DB-backed integration test for public recipe sharing: the share toggle
 * (publicId generation and stability) and the unauthenticated public route
 * (visibility rules and field sanitization).
 *
 * Uses the dedicated test database via vitest.config.ts, same as the other
 * DB-backed suites.
 */

const RUN = `sharetest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const OWNER = `${RUN}_owner`;

async function cleanup() {
  await db.execute(
    sql`TRUNCATE TABLE ${recipes}, ${user} RESTART IDENTITY CASCADE`
  );
}

let recipeId: number;

beforeAll(async () => {
  await cleanup();

  await db.insert(user).values([
    { id: OWNER, name: 'Share Owner', email: `${OWNER}@test.local` },
  ]);

  const [recipe] = await db
    .insert(recipes)
    .values({
      name: `${RUN} carbonara`,
      instructions: JSON.stringify(['Boil pasta', 'Add sauce']),
      status: 'ready',
      createdBy: OWNER,
      updatedBy: OWNER,
    })
    .returning();
  recipeId = recipe.id;

  await db.insert(recipeIngredients).values([
    { recipeId, name: 'spaghetti', quantity: '200', unit: 'g', position: 0 },
    { recipeId, name: 'eggs', quantity: '2', unit: null, position: 1 },
  ]);
});

afterAll(async () => {
  await cleanup();
});

describe('setRecipeSharing', () => {
  it('generates a publicId when sharing is first enabled', async () => {
    const result = await setRecipeSharing(OWNER, recipeId, true);
    expect(result).not.toBeNull();
    expect(result!.isPublic).toBe(true);
    expect(result!.publicId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('keeps the same publicId when sharing is disabled and re-enabled', async () => {
    const [before] = await db
      .select({ publicId: recipes.publicId })
      .from(recipes)
      .where(eq(recipes.id, recipeId));

    const off = await setRecipeSharing(OWNER, recipeId, false);
    expect(off!.isPublic).toBe(false);
    expect(off!.publicId).toBe(before.publicId);

    const on = await setRecipeSharing(OWNER, recipeId, true);
    expect(on!.isPublic).toBe(true);
    expect(on!.publicId).toBe(before.publicId);
  });

  it('returns null for a recipe the user cannot see', async () => {
    const result = await setRecipeSharing('nonexistent-user', recipeId, true);
    expect(result).toBeNull();
  });
});

describe('GET /api/public/recipes/:publicId', () => {
  it('rejects a non-UUID publicId with 404', async () => {
    const res = await publicRecipesRoutes.request('/not-a-uuid');
    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown UUID', async () => {
    const res = await publicRecipesRoutes.request(
      '/00000000-0000-4000-8000-000000000000'
    );
    expect(res.status).toBe(404);
  });

  it('returns the sanitized recipe when sharing is on', async () => {
    await setRecipeSharing(OWNER, recipeId, true);
    const [row] = await db
      .select({ publicId: recipes.publicId })
      .from(recipes)
      .where(eq(recipes.id, recipeId));

    const res = await publicRecipesRoutes.request(`/${row.publicId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      name: string;
      ingredients: Array<{ name: string }>;
    };

    expect(body.name).toBe(`${RUN} carbonara`);
    expect(body.ingredients).toHaveLength(2);
    expect(body.ingredients[0].name).toBe('spaghetti');

    // No user/household identifiers may leak through the public view
    expect(body).not.toHaveProperty('createdBy');
    expect(body).not.toHaveProperty('updatedBy');
    expect(body).not.toHaveProperty('householdId');
    expect(body).not.toHaveProperty('id');
  });

  it('returns 404 once sharing is turned off, even with the old link', async () => {
    const [row] = await db
      .select({ publicId: recipes.publicId })
      .from(recipes)
      .where(eq(recipes.id, recipeId));

    await setRecipeSharing(OWNER, recipeId, false);

    const res = await publicRecipesRoutes.request(`/${row.publicId}`);
    expect(res.status).toBe(404);
  });
});

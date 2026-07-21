import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  user,
  recipes,
  recipeIngredients,
  recipeNutrition,
  ingredientFoodCache,
} from '../db/schema.js';
import {
  enrichRecipeNutrition,
  normalizeIngredientName,
} from './nutritionEnrichmentService.js';
import { estimateFood } from './foodEstimator.js';

/**
 * DB-backed test of the enrichment pipeline with the two external tiers
 * mocked: Open Food Facts via a global fetch stub, DeepSeek via a module
 * mock. Verifies tier order, per-serving math, cache writes, and cache hits.
 */

vi.mock('./foodEstimator.js', () => ({
  isFoodEstimatorConfigured: () => true,
  estimateFood: vi.fn(),
}));

const estimateFoodMock = vi.mocked(estimateFood);

// Open Food Facts response for "red lentils" (per 100 g)
const OFF_RESPONSE = {
  products: [
    { nutriments: { irrelevant: 1 } }, // first product incomplete -> skipped
    {
      nutriments: {
        'energy-kcal_100g': 350,
        proteins_100g: 25,
        carbohydrates_100g: 60,
        fat_100g: 1.5,
        fiber_100g: 10,
        sugars_100g: 1,
        salt_100g: 0.01,
      },
    },
  ],
};

// DeepSeek estimate for "onion" (one item)
const ONION_ESTIMATE = {
  gramsPerUnit: 150,
  per100g: {
    caloriesKcal: 40,
    proteinG: 1.2,
    carbsG: 9,
    fatG: 0.1,
    fiberG: 1.7,
    sugarG: 4.2,
    saltG: 0.01,
  },
};

const fetchMock = vi.fn();

const RUN = `nutritest_${Date.now()}`;
const USER = `${RUN}_user`;
let recipeId: number;

async function cleanup() {
  await db.execute(
    sql`TRUNCATE TABLE ${recipeNutrition}, ${ingredientFoodCache}, ${recipes}, ${user} RESTART IDENTITY CASCADE`
  );
}

beforeAll(async () => {
  await cleanup();
  vi.stubGlobal('fetch', fetchMock);

  await db.insert(user).values({
    id: USER,
    name: 'Nutrition Tester',
    email: `${USER}@test.local`,
  });

  const [recipe] = await db
    .insert(recipes)
    .values({
      name: `${RUN} lentil soup`,
      instructions: 'Simmer everything',
      servings: 4,
      createdBy: USER,
      updatedBy: USER,
    })
    .returning();
  recipeId = recipe.id;

  await db.insert(recipeIngredients).values([
    { recipeId, name: 'Red  Lentils', quantity: '200', unit: 'g', position: 0 },
    { recipeId, name: 'onion', quantity: '2', unit: null, position: 1 },
  ]);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await cleanup();
});

beforeEach(() => {
  fetchMock.mockReset();
  estimateFoodMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(OFF_RESPONSE), { status: 200 })
  );
  estimateFoodMock.mockResolvedValue(ONION_ESTIMATE);
});

describe('normalizeIngredientName', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeIngredientName('  Red  Lentils ')).toBe('red lentils');
  });
});

describe('enrichRecipeNutrition', () => {
  it('combines OFF (mass) and LLM (count) tiers into per-serving totals', async () => {
    await enrichRecipeNutrition(recipeId);

    const [row] = await db
      .select()
      .from(recipeNutrition)
      .where(eq(recipeNutrition.recipeId, recipeId));

    expect(row.status).toBe('ready');
    expect(row.matchedCount).toBe(2);
    expect(row.totalCount).toBe(2);
    // One ingredient came from the LLM tier
    expect(row.estimated).toBe(true);

    // 200g lentils (factor 2) + 2x150g onion (factor 3), / 4 servings:
    // calories: (2*350 + 3*40) / 4 = 205
    expect(parseFloat(row.caloriesKcal!)).toBeCloseTo(205.0);
    // protein: (2*25 + 3*1.2) / 4 = 13.4
    expect(parseFloat(row.proteinG!)).toBeCloseTo(13.4);
    // carbs: (2*60 + 3*9) / 4 = 36.75 -> 36.8
    expect(parseFloat(row.carbsG!)).toBeCloseTo(36.8);

    // Only the mass-unit ingredient hit Open Food Facts
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Only the count ingredient needed the estimator
    expect(estimateFoodMock).toHaveBeenCalledTimes(1);
    expect(estimateFoodMock).toHaveBeenCalledWith('onion', 'item');

    // Both resolutions were cached
    const cacheRows = await db.select().from(ingredientFoodCache);
    expect(cacheRows).toHaveLength(2);
    const lentils = cacheRows.find((r) => r.normalizedName === 'red lentils');
    expect(lentils?.unit).toBe('g');
    expect(lentils?.source).toBe('off');
    const onion = cacheRows.find((r) => r.normalizedName === 'onion');
    expect(onion?.unit).toBe('item');
    expect(onion?.source).toBe('llm');
  });

  it('re-runs entirely from cache without external calls', async () => {
    await enrichRecipeNutrition(recipeId);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(estimateFoodMock).not.toHaveBeenCalled();

    const [row] = await db
      .select()
      .from(recipeNutrition)
      .where(eq(recipeNutrition.recipeId, recipeId));
    expect(row.status).toBe('ready');
    expect(parseFloat(row.caloriesKcal!)).toBeCloseTo(205.0);
  });

  it('marks the recipe failed when nothing resolves', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ products: [] }), { status: 200 })
    );
    estimateFoodMock.mockResolvedValue(null);

    const [unresolvable] = await db
      .insert(recipes)
      .values({
        name: `${RUN} mystery dish`,
        instructions: 'Unknown',
        servings: 2,
        createdBy: USER,
        updatedBy: USER,
      })
      .returning();
    await db.insert(recipeIngredients).values({
      recipeId: unresolvable.id,
      name: `${RUN} unobtainium`,
      quantity: '1',
      unit: 'g',
      position: 0,
    });

    await enrichRecipeNutrition(unresolvable.id);

    const [row] = await db
      .select()
      .from(recipeNutrition)
      .where(eq(recipeNutrition.recipeId, unresolvable.id));
    expect(row.status).toBe('failed');
    expect(row.matchedCount).toBe(0);
    expect(row.caloriesKcal).toBeNull();
  });
});

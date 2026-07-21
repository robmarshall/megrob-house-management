/**
 * Nutrition enrichment pipeline — computes per-serving nutrition for a
 * recipe from its ingredients. Runs as a worker job (nutrition-enrich queue).
 *
 * Per ingredient, resolution tiers (cheapest first):
 *   1. ingredient_food_cache — every past resolution, shared globally
 *   2. Open Food Facts search — mass-unit ingredients only (no density needed)
 *   3. DeepSeek estimator — anything else; flagged `estimated`
 *
 * Ingredients that resolve nowhere count as unmatched; the recipe row keeps
 * matchedCount/totalCount so the UI can say "based on 9 of 11 ingredients"
 * instead of pretending precision.
 */

import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  recipes,
  recipeIngredients,
  recipeNutrition,
  ingredientFoodCache,
} from '../db/schema.js';
import { logger } from '../lib/logger.js';
import {
  cacheUnit,
  isMassUnit,
  massToGrams,
  ITEM_UNIT,
} from '../lib/gramWeights.js';
import { canonicalizeUnit } from '../lib/units.js';
import { estimateFood } from './foodEstimator.js';

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const OFF_TIMEOUT_MS = 15_000;

interface Per100g {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  saltG: number | null;
}

interface ResolvedFood {
  source: 'off' | 'llm';
  gramsPerUnit: number;
  per100g: Per100g;
}

type CacheRow = typeof ingredientFoodCache.$inferSelect;

/** Lowercase, trim, collapse whitespace — the cache key for an ingredient. */
export function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function num(value: string | null): number | null {
  return value === null ? null : parseFloat(value);
}

function cacheRowToResolved(row: CacheRow): ResolvedFood {
  return {
    source: row.source as 'off' | 'llm',
    gramsPerUnit: parseFloat(row.gramsPerUnit),
    per100g: {
      caloriesKcal: num(row.caloriesPer100g),
      proteinG: num(row.proteinPer100g),
      carbsG: num(row.carbsPer100g),
      fatG: num(row.fatPer100g),
      fiberG: num(row.fiberPer100g),
      sugarG: num(row.sugarPer100g),
      saltG: num(row.saltPer100g),
    },
  };
}

/**
 * Search Open Food Facts for per-100g nutrition. Only useful for mass-unit
 * ingredients (OFF can't tell us what a "cup" or "item" of something weighs).
 * Picks the first result that has the four core macros.
 */
async function fetchFromOpenFoodFacts(name: string): Promise<Per100g | null> {
  const params = new URLSearchParams({
    search_terms: name,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '5',
    fields: 'product_name,nutriments',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);
  try {
    const res = await fetch(`${OFF_SEARCH_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        // OFF asks API users to identify themselves
        'User-Agent': 'megrob-house-management/1.0 (home meal planning app)',
      },
    });
    if (!res.ok) return null;

    const payload = (await res.json()) as {
      products?: { nutriments?: Record<string, number> }[];
    };

    for (const product of payload.products ?? []) {
      const n = product.nutriments;
      if (
        n &&
        typeof n['energy-kcal_100g'] === 'number' &&
        typeof n['proteins_100g'] === 'number' &&
        typeof n['carbohydrates_100g'] === 'number' &&
        typeof n['fat_100g'] === 'number'
      ) {
        return {
          caloriesKcal: n['energy-kcal_100g'],
          proteinG: n['proteins_100g'],
          carbsG: n['carbohydrates_100g'],
          fatG: n['fat_100g'],
          fiberG: typeof n['fiber_100g'] === 'number' ? n['fiber_100g'] : null,
          sugarG: typeof n['sugars_100g'] === 'number' ? n['sugars_100g'] : null,
          saltG: typeof n['salt_100g'] === 'number' ? n['salt_100g'] : null,
        };
      }
    }
    return null;
  } catch (err) {
    logger.warn({ err, name }, 'Open Food Facts lookup failed');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Persist a resolution so this (name, unit) is never fetched again. */
async function writeCache(
  normalizedName: string,
  unit: string,
  resolved: ResolvedFood
): Promise<void> {
  await db
    .insert(ingredientFoodCache)
    .values({
      normalizedName,
      unit,
      source: resolved.source,
      gramsPerUnit: resolved.gramsPerUnit.toString(),
      caloriesPer100g: resolved.per100g.caloriesKcal?.toString() ?? null,
      proteinPer100g: resolved.per100g.proteinG?.toString() ?? null,
      carbsPer100g: resolved.per100g.carbsG?.toString() ?? null,
      fatPer100g: resolved.per100g.fatG?.toString() ?? null,
      fiberPer100g: resolved.per100g.fiberG?.toString() ?? null,
      sugarPer100g: resolved.per100g.sugarG?.toString() ?? null,
      saltPer100g: resolved.per100g.saltG?.toString() ?? null,
    })
    .onConflictDoNothing();
}

/**
 * Resolve one ingredient (name + unit) to gram weight and per-100g facts,
 * via cache, then Open Food Facts, then the LLM estimator.
 */
async function resolveIngredient(
  rawName: string,
  rawUnit: string | null
): Promise<ResolvedFood | null> {
  const name = normalizeIngredientName(rawName);
  const unit = cacheUnit(rawUnit);

  const [cached] = await db
    .select()
    .from(ingredientFoodCache)
    .where(
      and(
        eq(ingredientFoodCache.normalizedName, name),
        eq(ingredientFoodCache.unit, unit)
      )
    );
  if (cached) return cacheRowToResolved(cached);

  let resolved: ResolvedFood | null = null;

  if (unit === 'g') {
    // Mass units: per-100g facts are all we need (gramsPerUnit is exact)
    const per100g = await fetchFromOpenFoodFacts(name);
    if (per100g) resolved = { source: 'off', gramsPerUnit: 1, per100g };
  }

  if (!resolved) {
    const estimate = await estimateFood(name, unit);
    if (estimate) {
      resolved = {
        source: 'llm',
        gramsPerUnit: unit === 'g' ? 1 : estimate.gramsPerUnit,
        per100g: estimate.per100g,
      };
    }
  }

  if (resolved) await writeCache(name, unit, resolved);
  return resolved;
}

/**
 * Compute and store per-serving nutrition for one recipe. Called by the
 * worker; safe to re-run (upserts the recipe_nutrition row).
 */
export async function enrichRecipeNutrition(recipeId: number): Promise<void> {
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, recipeId));

  if (!recipe) {
    logger.warn({ recipeId }, 'Nutrition enrich: recipe not found; skipping');
    return;
  }

  const ingredients = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.position));

  const totals = {
    caloriesKcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sugarG: 0,
    saltG: 0,
  };
  let matchedCount = 0;
  let estimated = false;

  try {
    for (const ingredient of ingredients) {
      const resolved = await resolveIngredient(ingredient.name, ingredient.unit);
      if (!resolved) continue;

      const quantity = ingredient.quantity
        ? parseFloat(ingredient.quantity)
        : 1;
      if (isNaN(quantity) || quantity <= 0) continue;

      const canonical = ingredient.unit
        ? canonicalizeUnit(ingredient.unit)
        : ITEM_UNIT;
      const grams = isMassUnit(canonical)
        ? massToGrams(quantity, canonical)!
        : quantity * resolved.gramsPerUnit;

      const factor = grams / 100;
      totals.caloriesKcal += factor * (resolved.per100g.caloriesKcal ?? 0);
      totals.proteinG += factor * (resolved.per100g.proteinG ?? 0);
      totals.carbsG += factor * (resolved.per100g.carbsG ?? 0);
      totals.fatG += factor * (resolved.per100g.fatG ?? 0);
      totals.fiberG += factor * (resolved.per100g.fiberG ?? 0);
      totals.sugarG += factor * (resolved.per100g.sugarG ?? 0);
      totals.saltG += factor * (resolved.per100g.saltG ?? 0);

      matchedCount += 1;
      if (resolved.source === 'llm') estimated = true;
    }

    const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
    const perServing = (total: number) => (total / servings).toFixed(1);
    const ready = matchedCount > 0;

    const values = {
      status: ready ? 'ready' : 'failed',
      caloriesKcal: ready ? perServing(totals.caloriesKcal) : null,
      proteinG: ready ? perServing(totals.proteinG) : null,
      carbsG: ready ? perServing(totals.carbsG) : null,
      fatG: ready ? perServing(totals.fatG) : null,
      fiberG: ready ? perServing(totals.fiberG) : null,
      sugarG: ready ? perServing(totals.sugarG) : null,
      saltG: ready ? perServing(totals.saltG) : null,
      estimated,
      matchedCount,
      totalCount: ingredients.length,
      updatedAt: new Date(),
    };

    await db
      .insert(recipeNutrition)
      .values({ recipeId, ...values })
      .onConflictDoUpdate({
        target: recipeNutrition.recipeId,
        set: values,
      });

    logger.info(
      { recipeId, matchedCount, totalCount: ingredients.length, estimated },
      'Nutrition enrichment complete'
    );
  } catch (err) {
    logger.error({ err, recipeId }, 'Nutrition enrichment failed');
    await db
      .insert(recipeNutrition)
      .values({ recipeId, status: 'failed', totalCount: ingredients.length })
      .onConflictDoUpdate({
        target: recipeNutrition.recipeId,
        set: { status: 'failed', updatedAt: new Date() },
      });
    throw err;
  }
}

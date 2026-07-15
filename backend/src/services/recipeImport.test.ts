import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user, recipes, recipeIngredients, recipeCategories } from '../db/schema.js';
import type { ScrapedRecipe } from '../lib/recipeScraper.js';

// Mock only scrapeRecipe; keep parseDuration (and everything else) real.
vi.mock('../lib/recipeScraper.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/recipeScraper.js')>();
  return { ...actual, scrapeRecipe: vi.fn() };
});

import { scrapeRecipe } from '../lib/recipeScraper.js';
import { processRecipeImport } from './recipeImport.js';

const RUN = `rimport_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const USER = `${RUN}_user`;

let recipeId: number;

function scraped(overrides: Partial<ScrapedRecipe> = {}): ScrapedRecipe {
  return {
    name: 'Scraped Pancakes',
    description: 'Fluffy pancakes',
    prepTime: 'PT30M',
    cookTime: 'PT10M',
    servings: 6,
    ingredients: ['2 cups flour', '1 egg', '1 cup milk'],
    instructions: ['Mix', 'Cook'],
    image: 'https://example.test/pancakes.jpg',
    sourceUrl: 'https://example.test/pancakes',
    ...overrides,
  };
}

async function cleanup() {
  await db.execute(
    sql`TRUNCATE TABLE ${recipes}, ${user} RESTART IDENTITY CASCADE`
  );
}

beforeEach(async () => {
  vi.mocked(scrapeRecipe).mockReset();
  await cleanup();

  await db.insert(user).values({
    id: USER,
    name: 'Importer',
    email: `${USER}@example.test`,
    emailVerified: true,
  });

  const [pending] = await db
    .insert(recipes)
    .values({
      name: 'Importing...',
      instructions: '[]',
      sourceUrl: 'https://example.test/pancakes',
      status: 'pending',
      createdBy: USER,
      updatedBy: USER,
    })
    .returning();
  recipeId = pending.id;
});

afterAll(async () => {
  await cleanup();
});

describe('processRecipeImport', () => {
  it('scrapes, parses, and marks the recipe ready with ingredients and detected categories', async () => {
    vi.mocked(scrapeRecipe).mockResolvedValue(scraped());

    await processRecipeImport({ recipeId, url: 'https://example.test/pancakes', userId: USER });

    const [row] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row.status).toBe('ready');
    expect(row.name).toBe('Scraped Pancakes');
    expect(row.prepTimeMinutes).toBe(30); // parseDuration('PT30M')
    expect(row.cookTimeMinutes).toBe(10);
    expect(row.errorMessage).toBeNull();
    expect(JSON.parse(row.instructions)).toEqual(['Mix', 'Cook']);

    const ings = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
    expect(ings).toHaveLength(3);

    const cats = await db.select().from(recipeCategories).where(eq(recipeCategories.recipeId, recipeId));
    const values = cats.map((c) => c.categoryValue);
    // flour -> gluten, egg -> eggs (allergens); no meat/fish -> vegetarian (dietary)
    expect(values).toContain('gluten');
    expect(values).toContain('eggs');
    expect(values).toContain('vegetarian');
  });

  it('marks the recipe failed (without throwing) when scraping fails', async () => {
    vi.mocked(scrapeRecipe).mockRejectedValue(new Error('No recipe data found on this page.'));

    await expect(
      processRecipeImport({ recipeId, url: 'https://example.test/bad', userId: USER })
    ).resolves.toBeUndefined();

    const [row] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row.status).toBe('failed');
    expect(row.errorMessage).toBe('No recipe data found on this page.');
  });

  it('skips a recipe that is not pending (idempotent on retry)', async () => {
    await db.update(recipes).set({ status: 'ready', name: 'Already Done' }).where(eq(recipes.id, recipeId));

    await processRecipeImport({ recipeId, url: 'https://example.test/pancakes', userId: USER });

    expect(scrapeRecipe).not.toHaveBeenCalled();
    const [row] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row.name).toBe('Already Done');
  });
});

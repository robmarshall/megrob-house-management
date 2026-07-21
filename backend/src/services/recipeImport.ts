import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { recipes, recipeIngredients, recipeCategories } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import { scrapeRecipe, parseDuration } from '../lib/recipeScraper.js';
import { parseIngredient } from '../lib/ingredientParser.js';
import { detectAllergens, detectDietary } from '../lib/allergenDetector.js';
import { enqueueNutritionEnrichSafe, type RecipeImportJob } from '../lib/queue.js';

/**
 * Process a recipe-import job: scrape the source URL, parse ingredients, detect
 * allergens/dietary info, and update the pending recipe row. Runs in the worker
 * process (see src/worker.ts).
 *
 * Behavior:
 * - If the recipe no longer exists, throws (lets the queue record the failure).
 * - If the recipe is not `pending` (already processed), returns without changes.
 * - If scraping fails, marks the recipe `failed` with the error message and
 *   returns normally (scrape errors are usually deterministic — a bad URL or a
 *   page without structured data — so retrying would not help).
 * - Otherwise updates the recipe to `ready` with the scraped data, ingredients,
 *   and auto-detected allergen/dietary categories, atomically in a transaction.
 */
/**
 * Clamp scraped text to the max length accepted by the recipe validation
 * schemas, so imported recipes can always be re-saved through the edit form.
 */
function clamp(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export async function processRecipeImport({ recipeId, url, userId }: RecipeImportJob): Promise<void> {
  logger.info({ recipeId, url }, 'Processing recipe import');

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  if (recipe.status !== 'pending') {
    logger.info({ recipeId, status: recipe.status }, 'Recipe already processed; skipping');
    return;
  }

  // Scrape the source page.
  let scraped;
  try {
    scraped = await scrapeRecipe(url);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during import';
    logger.warn({ recipeId, err: error }, 'Recipe import failed to scrape');
    await db
      .update(recipes)
      .set({ status: 'failed', errorMessage, updatedAt: new Date() })
      .where(eq(recipes.id, recipeId));
    return;
  }

  // Parse ingredients and auto-detect allergens/dietary info.
  const parsedIngredients = scraped.ingredients.map((ing, index) => ({
    ...parseIngredient(ing),
    position: index,
  }));
  const allergens = detectAllergens(scraped.ingredients);
  const dietary = detectDietary(scraped.ingredients);

  // Apply the scraped data atomically.
  await db.transaction(async (tx) => {
    await tx
      .update(recipes)
      .set({
        name: clamp(scraped.name, 200) || scraped.name,
        description: clamp(scraped.description, 1000),
        servings: scraped.servings || 4,
        prepTimeMinutes: parseDuration(scraped.prepTime),
        cookTimeMinutes: parseDuration(scraped.cookTime),
        instructions: JSON.stringify(scraped.instructions),
        imageUrl: scraped.image || null,
        status: 'ready',
        errorMessage: null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, recipeId));

    // Replace ingredients (delete first in case of a retry).
    await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
    if (parsedIngredients.length > 0) {
      await tx.insert(recipeIngredients).values(
        parsedIngredients.map((ing, index) => ({
          recipeId,
          name: clamp(ing.name, 200) || ing.name,
          quantity: ing.quantity?.toString() || null,
          unit: clamp(ing.unit, 50),
          notes: clamp(ing.notes, 500),
          position: index,
        }))
      );
    }

    // Replace auto-detected allergen/dietary categories.
    await tx.delete(recipeCategories).where(eq(recipeCategories.recipeId, recipeId));
    const categoryValues = [
      ...allergens.map((allergen) => ({ recipeId, categoryType: 'allergen', categoryValue: allergen })),
      ...dietary.map((diet) => ({ recipeId, categoryType: 'dietary', categoryValue: diet })),
    ];
    if (categoryValues.length > 0) {
      await tx.insert(recipeCategories).values(categoryValues);
    }
  });

  // Freshly imported ingredients -> compute nutrition in a follow-up job
  await enqueueNutritionEnrichSafe({ recipeId });

  logger.info({ recipeId, name: scraped.name }, 'Successfully imported recipe');
}

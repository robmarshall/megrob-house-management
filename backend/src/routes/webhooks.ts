import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { serve } from 'queuebear';
import { db } from '../db/index.js';
import { recipes, recipeIngredients, recipeCategories } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import { scrapeRecipe, parseDuration } from '../lib/recipeScraper.js';
import { parseIngredient } from '../lib/ingredientParser.js';
import { detectAllergens, detectDietary } from '../lib/allergenDetector.js';

const app = new Hono();

/**
 * Recipe import workflow input type
 */
interface RecipeImportInput {
  recipeId: number;
  url: string;
  userId: string;
}

/**
 * Recipe import workflow using QueueBear's serve() with signature verification
 *
 * This workflow:
 * 1. Validates the recipe exists and is pending
 * 2. Scrapes the recipe from the URL
 * 3. Parses ingredients and detects allergens/dietary info
 * 4. Updates the recipe in the database
 */
const recipeImportHandler = serve<RecipeImportInput>(
  async (context) => {
    const { recipeId, url, userId } = context.input;

    logger.info({ recipeId, url }, "Processing recipe import");

    // Step 1: Validate recipe exists and is pending
    const existingRecipe = await context.run('validate-recipe', async () => {
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, recipeId));

      if (!recipe) {
        throw new Error(`Recipe not found: ${recipeId}`);
      }

      if (recipe.status !== 'pending') {
        logger.info({ recipeId, status: recipe.status }, "Recipe already processed");
        return null; // Already processed
      }

      return recipe;
    });

    // If already processed, return early
    if (!existingRecipe) {
      return { success: true, message: 'Recipe already processed' };
    }

    // Step 2: Scrape the recipe
    const scraped = await context.run('scrape-recipe', async () => {
      try {
        return await scrapeRecipe(url);
      } catch (error) {
        // Mark recipe as failed
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error occurred during import';

        await db
          .update(recipes)
          .set({
            status: 'failed',
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(recipes.id, recipeId));

        throw error;
      }
    });

    // Step 3: Parse ingredients and detect allergens/dietary
    const { parsedIngredients, allergens, dietary } = await context.run(
      'parse-ingredients',
      async () => {
        const parsed = scraped.ingredients.map((ing, index) => ({
          ...parseIngredient(ing),
          position: index,
          originalText: ing,
        }));

        return {
          parsedIngredients: parsed,
          allergens: detectAllergens(scraped.ingredients),
          dietary: detectDietary(scraped.ingredients),
        };
      }
    );

    // Step 4: Update recipe in database (wrapped in transaction for atomicity)
    await context.run('update-recipe', async () => {
      await db.transaction(async (tx) => {
        // Update the recipe with scraped data
        await tx
          .update(recipes)
          .set({
            name: scraped.name,
            description: scraped.description || null,
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

        // Delete any existing ingredients (in case of retry)
        await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));

        // Insert parsed ingredients
        if (parsedIngredients.length > 0) {
          await tx.insert(recipeIngredients).values(
            parsedIngredients.map((ing, index) => ({
              recipeId,
              name: ing.name,
              quantity: ing.quantity?.toString() || null,
              unit: ing.unit || null,
              notes: ing.notes || null,
              position: index,
            }))
          );
        }

        // Delete any existing categories (in case of retry)
        await tx.delete(recipeCategories).where(eq(recipeCategories.recipeId, recipeId));

        // Insert auto-detected categories (allergens and dietary)
        const categoryValues: { recipeId: number; categoryType: string; categoryValue: string }[] = [];

        for (const allergen of allergens) {
          categoryValues.push({
            recipeId,
            categoryType: 'allergen',
            categoryValue: allergen,
          });
        }

        for (const diet of dietary) {
          categoryValues.push({
            recipeId,
            categoryType: 'dietary',
            categoryValue: diet,
          });
        }

        if (categoryValues.length > 0) {
          await tx.insert(recipeCategories).values(categoryValues);
        }
      });
    });

    logger.info({ recipeId, name: scraped.name }, "Successfully imported recipe");

    return {
      success: true,
      recipeId,
      name: scraped.name,
    };
  },
  {
    // Verify requests come from QueueBear using signing secret
    signingSecret: process.env.QUEUEBEAR_SIGNING_SECRET,
  }
);

/**
 * POST /api/webhooks/recipe-import
 * Workflow endpoint for QueueBear to process recipe imports
 * Signature verification is handled automatically by serve()
 */
app.post('/recipe-import', async (c) => {
  return await recipeImportHandler(c.req.raw);
});

export default app;

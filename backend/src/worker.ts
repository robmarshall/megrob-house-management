import dotenv from 'dotenv';
import type { Job } from 'pg-boss';
import {
  getQueue,
  stopQueue,
  RECIPE_IMPORT_QUEUE,
  NUTRITION_ENRICH_QUEUE,
  type RecipeImportJob,
  type NutritionEnrichJob,
} from './lib/queue.js';
import { processRecipeImport } from './services/recipeImport.js';
import { enrichRecipeNutrition } from './services/nutritionEnrichmentService.js';
import { isFoodEstimatorConfigured } from './services/foodEstimator.js';
import { logger } from './lib/logger.js';

dotenv.config();

/**
 * Recipe-import worker. Runs as a SEPARATE process from the API server
 * (`npm run worker` in dev, `npm run worker:start` in production). It consumes
 * recipe-import jobs from the pg-boss queue and processes them.
 */
async function main() {
  const boss = await getQueue();

  await boss.work<RecipeImportJob>(RECIPE_IMPORT_QUEUE, async (jobs: Job<RecipeImportJob>[]) => {
    for (const job of jobs) {
      await processRecipeImport(job.data);
    }
  });

  await boss.work<NutritionEnrichJob>(NUTRITION_ENRICH_QUEUE, async (jobs: Job<NutritionEnrichJob>[]) => {
    for (const job of jobs) {
      await enrichRecipeNutrition(job.data.recipeId);
    }
  });

  if (!isFoodEstimatorConfigured()) {
    logger.warn(
      'DEEPSEEK_API_KEY not set: nutrition enrichment will only resolve ' +
        'ingredients via cache and Open Food Facts (mass units); the rest ' +
        'count as unmatched'
    );
  }

  logger.info(
    { queues: [RECIPE_IMPORT_QUEUE, NUTRITION_ENRICH_QUEUE] },
    'Worker started'
  );
}

async function shutdown(signal: string) {
  logger.info({ signal }, 'Worker shutting down');
  try {
    await stopQueue();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((err) => {
  logger.error({ err }, 'Recipe import worker failed to start');
  process.exit(1);
});

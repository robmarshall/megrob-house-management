import { PgBoss } from 'pg-boss';
import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

/** Name of the queue that carries recipe-import jobs. */
export const RECIPE_IMPORT_QUEUE = 'recipe-import';

/** Name of the queue that carries nutrition-enrichment jobs. */
export const NUTRITION_ENRICH_QUEUE = 'nutrition-enrich';

/** Payload for a recipe-import job. */
export interface RecipeImportJob {
  recipeId: number;
  url: string;
  userId: string;
}

/** Payload for a nutrition-enrichment job. */
export interface NutritionEnrichJob {
  recipeId: number;
}

let boss: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

/**
 * Lazily create, start, and cache the shared pg-boss instance, ensuring the
 * recipe-import queue exists. pg-boss stores its jobs in the same PostgreSQL
 * database as the app (its own `pgboss` schema), so no extra infrastructure is
 * required. Both the API process (which sends jobs) and the worker process
 * (which consumes them) call this; pg-boss supports multiple instances against
 * one database.
 */
export async function getQueue(): Promise<PgBoss> {
  if (boss) return boss;
  if (starting) return starting;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set; cannot start the job queue');
  }

  starting = (async () => {
    const instance = new PgBoss({
      connectionString,
      schema: process.env.PGBOSS_SCHEMA || 'pgboss',
    });
    instance.on('error', (err: Error) => logger.error({ err }, 'pg-boss error'));
    await instance.start();
    await instance.createQueue(RECIPE_IMPORT_QUEUE);
    await instance.createQueue(NUTRITION_ENRICH_QUEUE);
    boss = instance;
    starting = null;
    return instance;
  })();

  return starting;
}

/**
 * Enqueue a recipe-import job for the worker to process.
 * A singleton key coalesces duplicate triggers for the same recipe, and jobs
 * retry a few times with exponential backoff on transient failures.
 */
export async function enqueueRecipeImport(job: RecipeImportJob): Promise<string | null> {
  const queue = await getQueue();
  return queue.send(RECIPE_IMPORT_QUEUE, job, {
    singletonKey: `recipe-import-${job.recipeId}`,
    retryLimit: 3,
    retryDelay: 5,
    retryBackoff: true,
  });
}

/**
 * Enqueue a nutrition-enrichment job. Fire-and-forget from write paths: a
 * singleton key coalesces duplicate triggers for the same recipe while a job
 * is queued, and failures must never break the request that triggered them —
 * callers use enqueueNutritionEnrichSafe unless they want the error.
 */
export async function enqueueNutritionEnrich(
  job: NutritionEnrichJob
): Promise<string | null> {
  const queue = await getQueue();
  return queue.send(NUTRITION_ENRICH_QUEUE, job, {
    singletonKey: `nutrition-enrich-${job.recipeId}`,
    retryLimit: 2,
    retryDelay: 30,
    retryBackoff: true,
  });
}

/** enqueueNutritionEnrich that logs instead of throwing (for read paths). */
export async function enqueueNutritionEnrichSafe(
  job: NutritionEnrichJob
): Promise<void> {
  try {
    await enqueueNutritionEnrich(job);
  } catch (err) {
    logger.error({ err, recipeId: job.recipeId }, 'Failed to enqueue nutrition enrich');
  }
}

/** Stop the shared pg-boss instance (used for graceful shutdown). */
export async function stopQueue(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}

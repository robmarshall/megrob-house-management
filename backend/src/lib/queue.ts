import { PgBoss } from 'pg-boss';
import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

/** Name of the queue that carries recipe-import jobs. */
export const RECIPE_IMPORT_QUEUE = 'recipe-import';

/** Name of the queue that carries nutrition-enrichment jobs. */
export const NUTRITION_ENRICH_QUEUE = 'nutrition-enrich';

/** Name of the queue that carries scheduled Snozone availability polls. */
export const SNOZONE_POLL_QUEUE = 'snozone-poll';

/**
 * Cron for the high-resolution window (today, +1, +2), venue-local.
 *
 * 24/7 on purpose: opening hours are when people are on the slope, not when
 * they book. Polling only during opening hours would leave every overnight
 * booking invisible as a timed event, which is precisely the signal the whole
 * collector exists to capture (PLAN.md §5.2a).
 */
export const SNOZONE_WINDOW_CRON = '*/30 * * * *';

/**
 * Cron for the daily low-resolution sweep of the rest of the bookable horizon
 * (roughly +3 to +30). Deliberately offset from the :00/:30 window runs so the
 * two never overlap.
 */
export const SNOZONE_HORIZON_CRON = '5 4 * * *';

/** Timezone for both schedules — see PLAN.md §12.3 on BST. */
export const VENUE_TZ = 'Europe/London';

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

/** Payload for a scheduled Snozone poll. */
export interface SnozonePollJob {
  /** 'window' = today..+2 at 30-min resolution; 'horizon' = +3.. once daily. */
  mode: 'window' | 'horizon';
  /** Restrict to one product row; omitted means every active product. */
  productRowId?: number;
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
    await instance.createQueue(SNOZONE_POLL_QUEUE);
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
 * Register the two Snozone poll schedules.
 *
 * Called from the worker on startup. `schedule()` upserts on (queue, key), so
 * running it every boot is idempotent, and changing a cron here takes effect on
 * the next deploy rather than needing the old schedule removed first.
 *
 * IMPORTANT: pg-boss runs its cron monitor inside the process that called
 * `start()`. These schedules only fire because the worker process exists — the
 * API registering them would not be enough.
 */
export async function registerSnozoneSchedules(): Promise<void> {
  const queue = await getQueue();

  const options = {
    tz: VENUE_TZ,
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
  } as const;

  // Distinct keys: two schedules on one queue would otherwise overwrite each
  // other. singletonKey stops a slow run from letting jobs pile up behind it.
  await queue.schedule(SNOZONE_POLL_QUEUE, SNOZONE_WINDOW_CRON, { mode: 'window' }, {
    ...options,
    key: 'window',
    singletonKey: 'snozone-window',
  });
  await queue.schedule(SNOZONE_POLL_QUEUE, SNOZONE_HORIZON_CRON, { mode: 'horizon' }, {
    ...options,
    key: 'horizon',
    singletonKey: 'snozone-horizon',
  });

  logger.info(
    { window: SNOZONE_WINDOW_CRON, horizon: SNOZONE_HORIZON_CRON, tz: VENUE_TZ },
    'Snozone poll schedules registered'
  );
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

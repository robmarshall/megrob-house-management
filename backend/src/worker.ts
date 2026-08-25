import dotenv from 'dotenv';
import type { Job } from 'pg-boss';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import {
  getQueue,
  stopQueue,
  registerSnozoneSchedules,
  RECIPE_IMPORT_QUEUE,
  NUTRITION_ENRICH_QUEUE,
  SNOZONE_POLL_QUEUE,
  type RecipeImportJob,
  type NutritionEnrichJob,
  type SnozonePollJob,
} from './lib/queue.js';
import { processRecipeImport } from './services/recipeImport.js';
import { enrichRecipeNutrition } from './services/nutritionEnrichmentService.js';
import { isFoodEstimatorConfigured } from './services/foodEstimator.js';
import { runSnozoneCollection } from './services/snozoneCollector.js';
import {
  assessWorkerHealth,
  healthHttpStatus,
  HEALTH_DEFAULTS,
} from './lib/workerHealth.js';
import { getMissingEnvVars } from './lib/env.js';
import { logger } from './lib/logger.js';

dotenv.config();

/**
 * Background worker. Runs as a SEPARATE process from the API server
 * (`npm run worker` in dev, `npm run worker:start` in production) and consumes
 * queued jobs from pg-boss.
 *
 * It also serves a minimal health endpoint on WORKER_HEALTH_PORT so the
 * platform has something meaningful to probe — see lib/workerHealth.ts for why
 * "the process is running" is not a sufficient check. Deployment steps are in
 * docs/worker-deployment.md.
 */

/** Queues this process is responsible for; the health check asserts all are live. */
const OWNED_QUEUES = [RECIPE_IMPORT_QUEUE, NUTRITION_ENRICH_QUEUE, SNOZONE_POLL_QUEUE];

/**
 * Upper bound on the random delay before a scheduled Snozone poll starts.
 *
 * Cron fires these on exact :00/:30 boundaries forever. Spreading the actual
 * requests over the following couple of minutes keeps the traffic from being
 * the most machine-legible thing on the site (PLAN.md §11); 120s is well inside
 * the 30-minute period, so runs still never overlap.
 */
const SNOZONE_JITTER_MS = 120_000;

const startedAt = Date.now();

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    logger.warn({ [name]: raw, fallback }, 'Invalid value; using default');
    return fallback;
  }
  return parsed;
}

/**
 * The worker only needs the database. It deliberately does NOT require the
 * auth/SMTP variables the API validates — a worker refusing to boot over an
 * unset FRONTEND_URL would be failing for a reason that cannot affect it.
 */
const missingEnvVars = getMissingEnvVars(['DATABASE_URL']);
if (missingEnvVars.length > 0) {
  logger.fatal({ missing: missingEnvVars }, 'Missing required environment variables');
  process.exit(1);
}

let healthServer: ReturnType<typeof serve> | undefined;

function startHealthServer(boss: Awaited<ReturnType<typeof getQueue>>) {
  if (process.env.WORKER_HEALTH_DISABLE === 'true') {
    logger.warn('Worker health endpoint disabled by WORKER_HEALTH_DISABLE');
    return;
  }

  const port = intFromEnv('WORKER_HEALTH_PORT', 3001);
  const staleAfterMs = intFromEnv('WORKER_HEALTH_STALE_MS', HEALTH_DEFAULTS.staleAfterMs);

  const app = new Hono();

  app.get('/health', async (c) => {
    const report = assessWorkerHealth({
      expectedQueues: OWNED_QUEUES,
      // Synchronous and in-process: a probe costs no database round trip. The
      // freshness of lastFetchedOn is itself the proof that Postgres is up.
      wip: boss.getWipData(),
      now: Date.now(),
      startedAt,
      ...HEALTH_DEFAULTS,
      staleAfterMs,
    });

    // Verbose adds the registered cron schedules, which DO cost a query — kept
    // off the hot path so the platform probe stays free.
    if (c.req.query('verbose') === '1') {
      try {
        const schedules = await boss.getSchedules();
        return c.json(
          {
            ...report,
            schedules: schedules.map((s) => ({ name: s.name, cron: s.cron, tz: s.timezone })),
          },
          healthHttpStatus(report.status)
        );
      } catch (err) {
        logger.error({ err }, 'Failed to read schedules for verbose health');
        return c.json({ ...report, schedules: null }, healthHttpStatus(report.status));
      }
    }

    if (report.status !== 'ok') {
      logger.warn({ status: report.status, reasons: report.reasons }, 'Worker health check not ok');
    }
    return c.json(report, healthHttpStatus(report.status));
  });

  healthServer = serve({ fetch: app.fetch, port });
  logger.info({ port }, 'Worker health endpoint listening');
}

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

  await boss.work<SnozonePollJob>(SNOZONE_POLL_QUEUE, async (jobs: Job<SnozonePollJob>[]) => {
    for (const job of jobs) {
      const jitter = Math.floor(Math.random() * SNOZONE_JITTER_MS);
      logger.debug({ mode: job.data.mode, jitterMs: jitter }, 'Snozone poll starting');
      await new Promise((r) => setTimeout(r, jitter));
      await runSnozoneCollection({
        mode: job.data.mode,
        productRowId: job.data.productRowId,
      });
    }
  });

  // Registered after work() so a schedule can never fire into a process that is
  // not yet consuming its own queue.
  await registerSnozoneSchedules();

  // Started only after work() has registered, so the health check never reports
  // "no worker registered" for a process that is merely still booting.
  startHealthServer(boss);

  if (!isFoodEstimatorConfigured()) {
    logger.warn(
      'DEEPSEEK_API_KEY not set: nutrition enrichment will only resolve ' +
        'ingredients via cache and Open Food Facts (mass units); the rest ' +
        'count as unmatched'
    );
  }

  logger.info({ queues: OWNED_QUEUES }, 'Worker started');
}

async function shutdown(signal: string) {
  logger.info({ signal }, 'Worker shutting down');
  try {
    // Stop answering probes first: an in-flight health check during teardown
    // reports 'stopping', which reads as a fault rather than a redeploy.
    healthServer?.close();
    await stopQueue();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((err) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});

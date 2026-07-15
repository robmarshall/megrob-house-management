import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getQueue,
  enqueueRecipeImport,
  stopQueue,
  RECIPE_IMPORT_QUEUE,
  type RecipeImportJob,
} from './queue.js';

/**
 * Integration test for the pg-boss job queue wiring against the test database.
 * Verifies that enqueueRecipeImport publishes to RECIPE_IMPORT_QUEUE and that a
 * worker registered on that queue receives the exact payload. Jobs are picked up
 * near-instantly via LISTEN/NOTIFY, so this settles in well under a second once
 * pg-boss has started.
 */
describe('recipe-import queue', () => {
  beforeAll(async () => {
    // Starting pg-boss runs its own migrations to create the pgboss schema; give
    // it room on a cold database.
    await getQueue();
  }, 30_000);

  afterAll(async () => {
    await stopQueue();
  });

  it('delivers an enqueued job to a worker with the payload intact', async () => {
    // Unique recipeId so the singletonKey never collides with a previous run.
    const recipeId = 900_000 + Math.floor(Math.random() * 90_000);
    const boss = await getQueue();

    const received = new Promise<RecipeImportJob>((resolve) => {
      void boss.work<RecipeImportJob>(RECIPE_IMPORT_QUEUE, async (jobs) => {
        for (const job of jobs) resolve(job.data);
      });
    });

    const jobId = await enqueueRecipeImport({ recipeId, url: 'https://example.test/x', userId: 'user-1' });
    expect(jobId).toBeTruthy();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timed out waiting for the worker to receive the job')), 15_000)
    );

    const payload = await Promise.race([received, timeout]);
    expect(payload.recipeId).toBe(recipeId);
    expect(payload.url).toBe('https://example.test/x');
    expect(payload.userId).toBe('user-1');
  }, 20_000);
});

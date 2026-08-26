import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { getSnozoneStatus } from '../services/snozoneStatusService.js';

/**
 * Snozone collector operations. ADMIN ONLY for now — this exposes run errors,
 * upstream call counts and collection internals, which is diagnostics rather
 * than anything a household member needs.
 *
 * The availability and analytics routes (PLAN.md §8) will live here too and are
 * expected to be readable by any signed-in user; when they arrive, the admin
 * gate should move from the whole router onto /health specifically.
 */
const app = new Hono();

app.use('*', authMiddleware);
app.use('*', adminOnly);

/** Collector health, run ledger, and what has actually been collected. */
app.get('/health', async (c) => {
  return c.json(await getSnozoneStatus());
});

export default app;

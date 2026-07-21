import { Hono } from 'hono';
import { authMiddleware, getUserId } from '../middleware/auth.js';
import { validateBody, getValidatedBody } from '../middleware/validation.js';
import { logger } from '../lib/logger.js';
import {
  upsertNutritionProfileSchema,
  type UpsertNutritionProfileInput,
} from '../lib/validation.js';
import {
  getOwnNutritionProfile,
  upsertNutritionProfile,
  getHouseholdNutritionTargets,
} from '../services/nutritionProfileService.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * GET /api/nutrition/profile
 * The requesting user's own nutrition profile (raw fields) plus computed
 * daily targets. Returns { profile: null, targets: null } before first save.
 * Raw fields are only ever visible to their owner.
 */
app.get('/profile', async (c) => {
  const userId = getUserId(c);

  try {
    const result = await getOwnNutritionProfile(userId);
    return c.json({ data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching nutrition profile');
    return c.json({ error: 'Failed to fetch nutrition profile' }, 500);
  }
});

/**
 * POST /api/nutrition/profile
 * Create or update the user's own nutrition profile (upsert). Only provided
 * fields change; explicit nulls clear a field. Returns the saved profile
 * with freshly computed targets.
 */
app.post('/profile', validateBody(upsertNutritionProfileSchema), async (c) => {
  const userId = getUserId(c);
  const input = getValidatedBody<UpsertNutritionProfileInput>(c);

  try {
    const result = await upsertNutritionProfile(userId, input);
    return c.json({ data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error saving nutrition profile');
    return c.json({ error: 'Failed to save nutrition profile' }, 500);
  }
});

/**
 * GET /api/nutrition/targets
 * Derived daily targets for every member of the user's household (or just
 * the user when they have no household). Never includes raw measurements.
 */
app.get('/targets', async (c) => {
  const userId = getUserId(c);

  try {
    const members = await getHouseholdNutritionTargets(userId);
    return c.json({ data: members });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching nutrition targets');
    return c.json({ error: 'Failed to fetch nutrition targets' }, 500);
  }
});

export default app;

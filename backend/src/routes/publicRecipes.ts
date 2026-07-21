import { Hono } from 'hono';
import { logger } from '../lib/logger.js';
import { getPublicRecipe } from '../services/recipeService.js';

/**
 * Public (unauthenticated) recipe routes.
 * Mounted at /api/public/recipes — deliberately NOT behind authMiddleware.
 * Only recipes explicitly marked public are returned, looked up by their
 * unguessable UUID share id, with all user/household fields stripped.
 */
const app = new Hono();

/**
 * GET /api/public/recipes/:publicId
 * Fetch a publicly shared recipe (read-only, sanitized view).
 */
app.get('/:publicId', async (c) => {
  const publicId = c.req.param('publicId');

  // publicIds are UUIDs; reject anything else without touching the database
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicId)) {
    return c.json({ error: 'Recipe not found' }, 404);
  }

  try {
    const recipe = await getPublicRecipe(publicId);

    if (!recipe) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    return c.json(recipe);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching public recipe');
    return c.json({ error: 'Failed to fetch recipe' }, 500);
  }
});

export default app;

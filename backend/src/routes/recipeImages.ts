import { Hono } from 'hono';
import { getRecipeImage } from '../services/recipeImageService.js';

/**
 * Public, unauthenticated serving of stored recipe images.
 *
 * Image ids are random UUIDs, so a URL is unguessable in the same way as a
 * recipe share link. Serving without auth is deliberate: <img> tags on the
 * public share page, in MCP clients, and on a different frontend origin can't
 * attach a session, and the image URL is the one thing a recipe exposes that
 * other systems need to load directly.
 */
const app = new Hono();

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const image = await getRecipeImage(id);

  if (!image) {
    return c.json({ error: 'Image not found' }, 404);
  }

  // Content never changes for a given id (a re-upload gets a new id), so
  // browsers may cache it for as long as they like.
  const etag = `"${image.id}"`;
  const headers: Record<string, string> = {
    'Content-Type': image.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
  };

  if (c.req.header('if-none-match') === etag) {
    return new Response(null, { status: 304, headers });
  }

  headers['Content-Length'] = String(image.sizeBytes);
  return new Response(new Uint8Array(image.data), { status: 200, headers });
});

export default app;

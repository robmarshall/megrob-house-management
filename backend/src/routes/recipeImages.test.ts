import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user, recipes, recipeImages } from '../db/schema.js';
import {
  storeRecipeImage,
  getRecipeImage,
} from '../services/recipeImageService.js';
import { updateRecipe } from '../services/recipeService.js';
import {
  ImageValidationError,
  MAX_IMAGE_BYTES,
  recipeImageUrl,
  storedImageIdFromUrl,
} from '../lib/recipeImages.js';
import recipeImagesRoutes from './recipeImages.js';

/**
 * DB-backed integration test for stored recipe images: the upload service
 * (validation, replace-on-upload, imageUrl repointing), the public serving
 * route, and the cleanup rules in updateRecipe / recipe deletion.
 *
 * Uses the dedicated test database via vitest.config.ts, same as the other
 * DB-backed suites.
 */

const RUN = `imgtest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const OWNER = `${RUN}_owner`;
const STRANGER = `${RUN}_stranger`;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);

async function cleanup() {
  await db.execute(
    sql`TRUNCATE TABLE ${recipes}, ${user} RESTART IDENTITY CASCADE`
  );
}

async function imageRowsFor(recipeId: number) {
  return db
    .select({ id: recipeImages.id })
    .from(recipeImages)
    .where(eq(recipeImages.recipeId, recipeId));
}

async function makeRecipe(name: string): Promise<number> {
  const [recipe] = await db
    .insert(recipes)
    .values({
      name: `${RUN} ${name}`,
      instructions: JSON.stringify(['Step one']),
      status: 'ready',
      createdBy: OWNER,
      updatedBy: OWNER,
    })
    .returning();
  return recipe.id;
}

beforeAll(async () => {
  await cleanup();
  await db.insert(user).values([
    { id: OWNER, name: 'Image Owner', email: `${OWNER}@test.local` },
    { id: STRANGER, name: 'Stranger', email: `${STRANGER}@test.local` },
  ]);
});

afterAll(async () => {
  await cleanup();
});

describe('storeRecipeImage', () => {
  it('stores the bytes, sniffs the type, and points imageUrl at the public route', async () => {
    const recipeId = await makeRecipe('stores');

    const stored = await storeRecipeImage(OWNER, recipeId, PNG);
    expect(stored).not.toBeNull();
    expect(stored!.contentType).toBe('image/png');
    expect(stored!.sizeBytes).toBe(PNG.length);
    expect(stored!.imageUrl).toBe(recipeImageUrl(stored!.id));
    expect(storedImageIdFromUrl(stored!.imageUrl)).toBe(stored!.id);

    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(recipe.imageUrl).toBe(stored!.imageUrl);

    const image = await getRecipeImage(stored!.id);
    expect(image).not.toBeNull();
    expect(image!.data.equals(PNG)).toBe(true);
  });

  it('replaces any previous upload so a recipe never holds two images', async () => {
    const recipeId = await makeRecipe('replaces');

    const first = await storeRecipeImage(OWNER, recipeId, PNG);
    const second = await storeRecipeImage(OWNER, recipeId, JPEG);

    const rows = await imageRowsFor(recipeId);
    expect(rows.map((r) => r.id)).toEqual([second!.id]);
    expect(await getRecipeImage(first!.id)).toBeNull();
    expect(second!.contentType).toBe('image/jpeg');
  });

  it('returns null for a recipe the user cannot see', async () => {
    const recipeId = await makeRecipe('private');
    expect(await storeRecipeImage(STRANGER, recipeId, PNG)).toBeNull();
    expect(await storeRecipeImage(OWNER, 999_999, PNG)).toBeNull();
    expect(await imageRowsFor(recipeId)).toHaveLength(0);
  });

  it('rejects empty, oversized, and non-image payloads without touching the recipe', async () => {
    const recipeId = await makeRecipe('rejects');

    await expect(storeRecipeImage(OWNER, recipeId, new Uint8Array(0))).rejects.toThrow(
      ImageValidationError
    );
    await expect(
      storeRecipeImage(OWNER, recipeId, new Uint8Array(MAX_IMAGE_BYTES + 1))
    ).rejects.toThrow(/too large/);
    await expect(
      storeRecipeImage(OWNER, recipeId, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))
    ).rejects.toThrow(/Unsupported image type/);

    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(recipe.imageUrl).toBeNull();
    expect(await imageRowsFor(recipeId)).toHaveLength(0);
  });
});

describe('GET /api/recipe-images/:id', () => {
  it('serves the stored bytes with the sniffed content type and long cache headers', async () => {
    const recipeId = await makeRecipe('serves');
    const stored = await storeRecipeImage(OWNER, recipeId, PNG);

    const res = await recipeImagesRoutes.request(`/${stored!.id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(res.headers.get('etag')).toBe(`"${stored!.id}"`);
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it('answers 304 to a matching If-None-Match', async () => {
    const recipeId = await makeRecipe('etag');
    const stored = await storeRecipeImage(OWNER, recipeId, PNG);

    const res = await recipeImagesRoutes.request(`/${stored!.id}`, {
      headers: { 'If-None-Match': `"${stored!.id}"` },
    });
    expect(res.status).toBe(304);
  });

  it('404s for unknown and malformed ids', async () => {
    expect((await recipeImagesRoutes.request('/123e4567-e89b-12d3-a456-426614174000')).status).toBe(404);
    expect((await recipeImagesRoutes.request('/not-a-uuid')).status).toBe(404);
  });
});

describe('stored image lifecycle', () => {
  it('updateRecipe clearing imageUrl drops the stored upload', async () => {
    const recipeId = await makeRecipe('clear');
    await storeRecipeImage(OWNER, recipeId, PNG);

    const updated = await updateRecipe(OWNER, recipeId, { imageUrl: null });
    expect(updated!.imageUrl).toBeNull();
    expect(await imageRowsFor(recipeId)).toHaveLength(0);
  });

  it('updateRecipe switching to a hotlink drops the stored upload', async () => {
    const recipeId = await makeRecipe('hotlink');
    await storeRecipeImage(OWNER, recipeId, PNG);

    await updateRecipe(OWNER, recipeId, { imageUrl: 'https://cdn.example.com/photo.jpg' });
    expect(await imageRowsFor(recipeId)).toHaveLength(0);
  });

  it('updateRecipe that re-sends the stored URL (or omits it) keeps the upload', async () => {
    const recipeId = await makeRecipe('keep');
    const stored = await storeRecipeImage(OWNER, recipeId, PNG);

    await updateRecipe(OWNER, recipeId, { name: `${RUN} keep renamed` });
    await updateRecipe(OWNER, recipeId, { imageUrl: stored!.imageUrl, notes: 'still here' });

    const rows = await imageRowsFor(recipeId);
    expect(rows.map((r) => r.id)).toEqual([stored!.id]);
  });

  it('deleting the recipe cascades to its stored image', async () => {
    const recipeId = await makeRecipe('cascade');
    const stored = await storeRecipeImage(OWNER, recipeId, PNG);

    await db.delete(recipes).where(eq(recipes.id, recipeId));
    expect(await getRecipeImage(stored!.id)).toBeNull();
  });
});

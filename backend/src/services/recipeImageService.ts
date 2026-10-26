import { randomUUID } from 'node:crypto';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { recipes, recipeImages } from '../db/schema.js';
import { verifyRecipeAccess } from './recipeService.js';
import { assertUrlSafe } from '../lib/recipeScraper.js';
import {
  MAX_IMAGE_BYTES,
  ImageValidationError,
  sniffImageType,
  recipeImageUrl,
  isImageId,
  type ImageContentType,
} from '../lib/recipeImages.js';

export interface StoredRecipeImage {
  id: string;
  imageUrl: string;
  contentType: ImageContentType;
  sizeBytes: number;
}

/**
 * Store an uploaded image for a recipe and point the recipe's imageUrl at it.
 * Any previously stored image for the recipe is dropped in the same
 * transaction, so a recipe never holds more than one upload.
 *
 * Returns null when the recipe doesn't exist or the user can't see it
 * (same household-scoped rule as every other recipe write).
 * Throws ImageValidationError for oversized or non-image payloads.
 */
export async function storeRecipeImage(
  userId: string,
  recipeId: number,
  bytes: Uint8Array
): Promise<StoredRecipeImage | null> {
  const recipe = await verifyRecipeAccess(recipeId, userId);
  if (!recipe) return null;

  if (bytes.byteLength === 0) {
    throw new ImageValidationError('Image file is empty');
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB)`
    );
  }
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    throw new ImageValidationError(
      'Unsupported image type. Use a JPEG, PNG, WebP or GIF file.'
    );
  }

  const id = randomUUID();
  const imageUrl = recipeImageUrl(id);

  await db.transaction(async (tx) => {
    await tx.insert(recipeImages).values({
      id,
      recipeId,
      contentType,
      sizeBytes: bytes.byteLength,
      data: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      createdBy: userId,
    });
    await tx
      .delete(recipeImages)
      .where(and(eq(recipeImages.recipeId, recipeId), ne(recipeImages.id, id)));
    await tx
      .update(recipes)
      .set({ imageUrl, updatedBy: userId, updatedAt: new Date() })
      .where(eq(recipes.id, recipeId));
  });

  return { id, imageUrl, contentType, sizeBytes: bytes.byteLength };
}

export interface RecipeImageFile {
  id: string;
  contentType: string;
  sizeBytes: number;
  data: Buffer;
}

/** Fetch a stored image by id for serving. Unknown or malformed ids give null. */
export async function getRecipeImage(id: string): Promise<RecipeImageFile | null> {
  if (!isImageId(id)) return null;
  const [row] = await db
    .select({
      id: recipeImages.id,
      contentType: recipeImages.contentType,
      sizeBytes: recipeImages.sizeBytes,
      data: recipeImages.data,
    })
    .from(recipeImages)
    .where(eq(recipeImages.id, id));
  if (!row) return null;
  return { ...row, data: Buffer.from(row.data) };
}

/** Timeout for downloading a remote image. */
const FETCH_TIMEOUT_MS = 15_000;
/** Redirect hops to follow; each hop is re-validated for SSRF. */
const MAX_REDIRECTS = 5;

/**
 * Download an image from a public http(s) URL so a copy can be stored.
 * Mirrors the recipe scraper's SSRF rules: every hop (including redirects)
 * must resolve to a public address, and the body is capped at MAX_IMAGE_BYTES
 * while streaming so a hostile server can't exhaust memory.
 *
 * Throws ImageValidationError for anything the caller should report back
 * (bad URL, blocked host, too large, non-2xx).
 */
export async function fetchImageFromUrl(url: string): Promise<Uint8Array> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new ImageValidationError('imageUrl is not a valid URL');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    let hops = 0;
    while (true) {
      try {
        await assertUrlSafe(current);
      } catch (error) {
        throw new ImageValidationError(
          error instanceof Error ? error.message : 'URL is not allowed'
        );
      }

      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'image/*' },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || ++hops > MAX_REDIRECTS) {
          throw new ImageValidationError('Too many redirects while fetching image');
        }
        current = new URL(location, current);
        continue;
      }
      break;
    }

    if (!response.ok) {
      throw new ImageValidationError(
        `Image URL returned HTTP ${response.status}`
      );
    }

    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_IMAGE_BYTES) {
      throw new ImageValidationError(
        `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB)`
      );
    }

    if (!response.body) {
      throw new ImageValidationError('Image URL returned an empty response');
    }

    const chunks: Uint8Array[] = [];
    let received = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new ImageValidationError(
          `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB)`
        );
      }
      chunks.push(value);
    }

    const out = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ImageValidationError('Timed out fetching the image URL');
    }
    throw new ImageValidationError(
      `Could not fetch image: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  } finally {
    clearTimeout(timer);
  }
}

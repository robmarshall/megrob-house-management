/**
 * Pure helpers for stored recipe images (no DB access). Kept separate from the
 * service so recipeService can import the URL helper without a circular import.
 */

/** Hard cap on a stored image. Large photos are downscaled client-side first. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type ImageContentType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Validation failure the caller should surface as a 400 / tool error. */
export class ImageValidationError extends Error {
  readonly status = 400 as const;
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

/**
 * Detect the image type from its magic bytes. The declared Content-Type of an
 * upload is never trusted: this is the only check that decides what we store
 * and what we later serve.
 */
export function sniffImageType(bytes: Uint8Array): ImageContentType | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // GIF: "GIF87a" / "GIF89a"
  if (
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

/** Path prefix (relative to the API origin) where stored images are served. */
export const RECIPE_IMAGE_PATH = '/api/recipe-images/';

/**
 * Absolute URL for a stored image. BETTER_AUTH_URL is the backend's public
 * origin, so the URL works from the frontend, the public share page, and
 * MCP clients alike.
 */
export function recipeImageUrl(imageId: string): string {
  const base = (process.env.BETTER_AUTH_URL || '').replace(/\/$/, '');
  return `${base}${RECIPE_IMAGE_PATH}${imageId}`;
}

/** The image id a stored-image URL points at, or null for any other URL. */
export function storedImageIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const idx = url.indexOf(RECIPE_IMAGE_PATH);
  if (idx === -1) return null;
  const id = url.slice(idx + RECIPE_IMAGE_PATH.length).split(/[?#]/)[0];
  return isImageId(id) ? id : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isImageId(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Decode a base64 image payload. Accepts a bare base64 string or a full
 * `data:image/...;base64,...` URL. Rejects anything that decodes to more than
 * MAX_IMAGE_BYTES before allocating it.
 */
export function decodeBase64Image(input: string): Uint8Array {
  let b64 = input.trim();
  const dataUrl = b64.match(/^data:[^;,]+;base64,(.*)$/s);
  if (dataUrl) b64 = dataUrl[1];
  b64 = b64.replace(/\s+/g, '');
  if (b64.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new ImageValidationError('imageBase64 is not valid base64');
  }
  // 4 base64 chars encode 3 bytes; check before decoding to bound memory.
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB)`
    );
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

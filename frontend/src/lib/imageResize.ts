/**
 * Browser-side image downscaling for recipe photo uploads.
 *
 * Phone cameras produce 4000px+ JPEGs of 3-8MB; the API caps uploads at 5MB
 * and the app never displays anything wider than a card, so shrinking before
 * upload keeps the server storage small without a native image library on
 * the backend. Everything here degrades to "return the original file" when
 * the environment can't decode or re-encode (jsdom, very old browsers,
 * unsupported formats) so the upload is attempted either way and the server
 * makes the final call.
 */

export interface DownscaleOptions {
  /** Longest edge after resize, in CSS pixels. */
  maxDimension?: number;
  /** JPEG/WebP quality, 0..1. */
  quality?: number;
  /** Files at or under this size that already fit maxDimension are returned untouched. */
  skipBelowBytes?: number;
  /** How long to wait for the browser to decode the image before giving up. */
  decodeTimeoutMs?: number;
}

export const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.85;
const DEFAULT_SKIP_BELOW_BYTES = 800 * 1024;
const DECODE_TIMEOUT_MS = 8000;

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

/**
 * Decode a file into something drawable. Prefers createImageBitmap because it
 * honours the EXIF orientation flag (phone photos are often stored rotated);
 * falls back to an <img> for browsers without it.
 */
async function decode(file: File, timeoutMs: number): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }

  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("No image decoder available");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      // Browsers fire error for undecodable data, but an environment that
      // never fires either event (jsdom, a stalled decoder) must not hang
      // the save: give up and fall back to the original file.
      const timer = setTimeout(
        () => reject(new Error("Timed out decoding image")),
        timeoutMs
      );
      const el = new Image();
      el.onload = () => {
        clearTimeout(timer);
        resolve(el);
      };
      el.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Could not decode image"));
      };
      el.src = objectUrl;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/**
 * Downscale an image file so its longest edge is at most `maxDimension`,
 * re-encoding as JPEG (or PNG when the source is PNG, to keep transparency).
 * GIFs are returned untouched so animation survives. Returns the original
 * file whenever resizing isn't possible or isn't needed.
 */
export async function downscaleImage(
  file: File,
  options: DownscaleOptions = {}
): Promise<File> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const skipBelowBytes = options.skipBelowBytes ?? DEFAULT_SKIP_BELOW_BYTES;
  const decodeTimeoutMs = options.decodeTimeoutMs ?? DECODE_TIMEOUT_MS;

  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  let decoded: Decoded;
  try {
    decoded = await decode(file, decodeTimeoutMs);
  } catch {
    return file;
  }

  try {
    const { width, height } = decoded;
    if (!width || !height) return file;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    if (scale === 1 && file.size <= skipBelowBytes) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, quality)
    );
    if (!blob) return file;

    // A re-encode that doesn't actually save anything isn't worth the quality loss.
    if (scale === 1 && blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    const extension = outType === "image/png" ? ".png" : ".jpg";
    return new File([blob], `${baseName}${extension}`, {
      type: outType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    decoded.release();
  }
}

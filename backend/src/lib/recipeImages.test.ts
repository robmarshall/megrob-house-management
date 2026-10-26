import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sniffImageType,
  recipeImageUrl,
  storedImageIdFromUrl,
  isImageId,
  decodeBase64Image,
  ImageValidationError,
  MAX_IMAGE_BYTES,
} from './recipeImages.js';

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function bytes(...values: number[]): Uint8Array {
  const out = new Uint8Array(Math.max(12, values.length));
  out.set(values);
  return out;
}

describe('sniffImageType', () => {
  it('detects JPEG from FF D8 FF', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  });

  it('detects PNG from its 8-byte signature', () => {
    expect(sniffImageType(Buffer.from(PNG_1X1_BASE64, 'base64'))).toBe('image/png');
  });

  it('detects GIF87a and GIF89a', () => {
    expect(sniffImageType(Buffer.from('GIF87a' + '\0'.repeat(8)))).toBe('image/gif');
    expect(sniffImageType(Buffer.from('GIF89a' + '\0'.repeat(8)))).toBe('image/gif');
  });

  it('detects WebP from the RIFF....WEBP container header', () => {
    expect(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
  });

  it('returns null for text, SVG, and too-short payloads', () => {
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageType(Buffer.from('hello world!!'))).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
  });
});

describe('recipeImageUrl / storedImageIdFromUrl', () => {
  const ID = '123e4567-e89b-12d3-a456-426614174000';
  let originalBase: string | undefined;

  beforeEach(() => {
    originalBase = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = 'https://api.example.test/';
  });

  afterEach(() => {
    process.env.BETTER_AUTH_URL = originalBase;
  });

  it('builds an absolute URL on the backend origin without a double slash', () => {
    expect(recipeImageUrl(ID)).toBe(`https://api.example.test/api/recipe-images/${ID}`);
  });

  it('round-trips the id out of a stored-image URL', () => {
    expect(storedImageIdFromUrl(recipeImageUrl(ID))).toBe(ID);
    expect(storedImageIdFromUrl(`${recipeImageUrl(ID)}?v=2`)).toBe(ID);
  });

  it('returns null for hotlinked, empty, and malformed URLs', () => {
    expect(storedImageIdFromUrl('https://cdn.example.com/photo.jpg')).toBeNull();
    expect(storedImageIdFromUrl(null)).toBeNull();
    expect(storedImageIdFromUrl('')).toBeNull();
    expect(storedImageIdFromUrl('https://api.example.test/api/recipe-images/not-a-uuid')).toBeNull();
  });

  it('isImageId accepts only UUID-shaped ids', () => {
    expect(isImageId(ID)).toBe(true);
    expect(isImageId(ID.toUpperCase())).toBe(true);
    expect(isImageId('../etc/passwd')).toBe(false);
    expect(isImageId('')).toBe(false);
  });
});

describe('decodeBase64Image', () => {
  it('decodes bare base64 into the original bytes', () => {
    const decoded = decodeBase64Image(PNG_1X1_BASE64);
    expect(Buffer.from(decoded).equals(Buffer.from(PNG_1X1_BASE64, 'base64'))).toBe(true);
  });

  it('accepts a data: URL and ignores whitespace/newlines', () => {
    const wrapped = PNG_1X1_BASE64.replace(/(.{20})/g, '$1\n');
    const decoded = decodeBase64Image(`data:image/png;base64,${wrapped}`);
    expect(sniffImageType(decoded)).toBe('image/png');
  });

  it('rejects empty or non-base64 input', () => {
    expect(() => decodeBase64Image('')).toThrow(ImageValidationError);
    expect(() => decodeBase64Image('not base64!!')).toThrow(ImageValidationError);
  });

  it('rejects payloads over the size cap before decoding', () => {
    // 4 chars -> 3 bytes, so this is just over MAX_IMAGE_BYTES once decoded.
    const tooBig = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 3) / 3) * 4);
    expect(() => decodeBase64Image(tooBig)).toThrow(/too large/);
  });
});

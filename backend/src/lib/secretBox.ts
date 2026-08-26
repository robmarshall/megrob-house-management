import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Authenticated encryption for secrets held in the database (currently the
 * Telegram bot token).
 *
 * AES-256-GCM, key from the environment only — never from the database, and
 * never checked in (brief.md §6). GCM rather than CBC so tampering is detected
 * rather than silently decrypting to rubbish: the auth tag is verified on every
 * open, and a modified ciphertext throws.
 *
 * Set SETTINGS_ENCRYPTION_KEY to 32 bytes, as base64 or hex:
 *
 *   openssl rand -base64 32
 *
 * Rotating the key makes existing ciphertexts unreadable. There is deliberately
 * no fallback to a default or derived key: a secret silently encrypted under a
 * guessable key is worse than one that fails loudly.
 */

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const VERSION = 'v1';

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretBoxError';
  }
}

/** Parse the configured key. Accepts base64 or hex; rejects anything else. */
export function loadKey(raw: string | undefined = process.env.SETTINGS_ENCRYPTION_KEY): Buffer {
  if (!raw || raw.trim() === '') {
    throw new SecretBoxError(
      'SETTINGS_ENCRYPTION_KEY is not set; cannot read or write stored secrets. ' +
        'Generate one with: openssl rand -base64 32'
    );
  }
  const value = raw.trim();

  const fromHex = /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, 'hex') : null;
  const fromB64 = fromHex ? null : Buffer.from(value, 'base64');
  const key = fromHex ?? fromB64;

  if (!key || key.length !== KEY_BYTES) {
    throw new SecretBoxError(
      `SETTINGS_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes ` +
        `(got ${key?.length ?? 0}). Use: openssl rand -base64 32`
    );
  }
  return key;
}

/** Is a usable key configured? Lets callers degrade instead of throwing. */
export function isEncryptionConfigured(
  raw: string | undefined = process.env.SETTINGS_ENCRYPTION_KEY
): boolean {
  try {
    loadKey(raw);
    return true;
  } catch {
    return false;
  }
}

/** Encrypt a UTF-8 string. Output: 'v1.<iv>.<tag>.<ciphertext>', all base64url. */
export function seal(plaintext: string, key: Buffer = loadKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ct.toString('base64url'),
  ].join('.');
}

/** Decrypt a sealed string. Throws if the key is wrong or the value tampered. */
export function open(sealed: string, key: Buffer = loadKey()): string {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new SecretBoxError('Malformed sealed value');
  }
  const [, ivB64, tagB64, ctB64] = parts;

  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Deliberately opaque: distinguishing "wrong key" from "tampered" tells an
    // attacker which of the two they achieved.
    throw new SecretBoxError('Could not decrypt value (wrong key or tampered)');
  }
}

/**
 * Last four characters, for showing the owner which token is stored without
 * handing it back. Short values are masked entirely rather than partly
 * revealed.
 */
export function maskSecret(plaintext: string): string {
  if (plaintext.length < 8) return '••••';
  return `••••${plaintext.slice(-4)}`;
}

/** Constant-time comparison, for anything that gates on a secret matching. */
export function secretsEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

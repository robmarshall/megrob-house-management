import { describe, it, expect } from 'vitest';
import {
  loadKey, isEncryptionConfigured, seal, open, maskSecret, secretsEqual, SecretBoxError,
} from './secretBox.js';

const KEY_B64 = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';       // 32 bytes
const KEY_HEX = '30313233343536373839616263646566303132333435363738396162636465666';
const OTHER_KEY = Buffer.alloc(32, 7);

// A realistic Telegram bot token shape.
const TOKEN = '7891234567:AAHf9x-Kd2vQmZq3LpR8sT1uV4wX6yZ0aBc';

describe('loadKey', () => {
  it('accepts a 32-byte base64 key', () => {
    expect(loadKey(KEY_B64)).toHaveLength(32);
  });

  it('accepts a 64-char hex key', () => {
    expect(loadKey(KEY_HEX.slice(0, 64))).toHaveLength(32);
  });

  it('rejects a missing key rather than defaulting', () => {
    // Falling back to a derived or default key would silently encrypt secrets
    // under something guessable, which is worse than failing.
    for (const bad of [undefined, '', '   ']) {
      expect(() => loadKey(bad), String(bad)).toThrow(SecretBoxError);
    }
  });

  it('rejects a key of the wrong length', () => {
    expect(() => loadKey(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });

  it('reports configuration without throwing', () => {
    expect(isEncryptionConfigured(KEY_B64)).toBe(true);
    expect(isEncryptionConfigured(undefined)).toBe(false);
    expect(isEncryptionConfigured('too-short')).toBe(false);
  });
});

describe('seal / open', () => {
  const key = loadKey(KEY_B64);

  it('round-trips a token', () => {
    expect(open(seal(TOKEN, key), key)).toBe(TOKEN);
  });

  it('round-trips unicode and empty strings', () => {
    for (const s of ['', 'héllo — wörld ✅', 'a'.repeat(5000)]) {
      expect(open(seal(s, key), key)).toBe(s);
    }
  });

  it('never emits the plaintext in the sealed value', () => {
    const sealed = seal(TOKEN, key);
    expect(sealed).not.toContain(TOKEN);
    expect(sealed).not.toContain('AAHf9x');
    expect(sealed.startsWith('v1.')).toBe(true);
  });

  it('produces a different ciphertext each time', () => {
    // A fresh nonce per seal; otherwise identical tokens would be linkable.
    expect(seal(TOKEN, key)).not.toBe(seal(TOKEN, key));
  });

  it('fails with the wrong key', () => {
    expect(() => open(seal(TOKEN, key), OTHER_KEY)).toThrow(SecretBoxError);
  });

  it('detects tampering rather than returning rubbish', () => {
    const [v, iv, tag, ct] = seal(TOKEN, key).split('.');
    const flip = (s: string) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
    for (const bad of [
      [v, flip(iv), tag, ct].join('.'),
      [v, iv, flip(tag), ct].join('.'),
      [v, iv, tag, flip(ct)].join('.'),
    ]) {
      expect(() => open(bad, key)).toThrow(SecretBoxError);
    }
  });

  it('rejects a malformed or unversioned value', () => {
    for (const bad of ['', 'nonsense', 'v2.a.b.c', 'v1.a.b']) {
      expect(() => open(bad, key), bad).toThrow(SecretBoxError);
    }
  });

  it('does not leak which failure occurred', () => {
    // Distinguishing "wrong key" from "tampered" tells an attacker which of the
    // two they achieved.
    const wrongKey = (() => { try { open(seal(TOKEN, key), OTHER_KEY); } catch (e) { return (e as Error).message; } })();
    const [v, iv, tag, ct] = seal(TOKEN, key).split('.');
    const tampered = (() => { try { open([v, iv, tag, 'A' + ct.slice(1)].join('.'), key); } catch (e) { return (e as Error).message; } })();
    expect(wrongKey).toBe(tampered);
  });
});

describe('maskSecret', () => {
  it('shows only the last four characters', () => {
    expect(maskSecret(TOKEN)).toBe('••••0aBc');
    expect(maskSecret(TOKEN)).not.toContain('7891234567');
  });

  it('masks short values entirely', () => {
    expect(maskSecret('abc')).toBe('••••');
    expect(maskSecret('1234567')).toBe('••••');
  });
});

describe('secretsEqual', () => {
  it('compares equal and unequal values', () => {
    expect(secretsEqual(TOKEN, TOKEN)).toBe(true);
    expect(secretsEqual(TOKEN, TOKEN + 'x')).toBe(false);
    expect(secretsEqual('a', 'b')).toBe(false);
    expect(secretsEqual('', '')).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { resolveClientIp, createKeyedRateLimiter } from './rateLimiter';

describe('createKeyedRateLimiter', () => {
  it('allows up to maxRequests per key, then denies with retry info', () => {
    const check = createKeyedRateLimiter(2, 60_000);
    expect(check('user-a').allowed).toBe(true);
    expect(check('user-a').allowed).toBe(true);

    const denied = check('user-a');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);

    // Separate keys have separate buckets
    expect(check('user-b').allowed).toBe(true);
  });

  it('resets the bucket after the window expires', async () => {
    const check = createKeyedRateLimiter(1, 100);
    expect(check('user-c').allowed).toBe(true);
    expect(check('user-c').allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(check('user-c').allowed).toBe(true);
  });
});

describe('resolveClientIp', () => {
  const socket = '10.0.0.1';

  describe('trustedHops <= 0 (XFF ignored, safe default)', () => {
    it('returns the socket address even when XFF is present', () => {
      expect(resolveClientIp('1.1.1.1', socket, 0)).toBe(socket);
      expect(resolveClientIp('9.9.9.9, 1.1.1.1', socket, 0)).toBe(socket);
    });

    it('treats negative hop counts as disabled', () => {
      expect(resolveClientIp('1.1.1.1', socket, -1)).toBe(socket);
    });
  });

  describe('trustedHops = 1 (client is the LAST XFF entry)', () => {
    it('returns the single XFF entry', () => {
      expect(resolveClientIp('1.1.1.1', socket, 1)).toBe('1.1.1.1');
    });

    it('returns the last entry when a client forged a value to the left', () => {
      // Client sent a fake "9.9.9.9"; the trusted proxy appended the real "1.1.1.1".
      expect(resolveClientIp('9.9.9.9, 1.1.1.1', socket, 1)).toBe('1.1.1.1');
    });
  });

  describe('trustedHops = 2 (client is len-2)', () => {
    it('returns the entry two hops from the end', () => {
      expect(resolveClientIp('client, proxy1', socket, 2)).toBe('client');
    });
  });

  describe('XFF absent', () => {
    it('falls back to the socket address', () => {
      expect(resolveClientIp(undefined, socket, 1)).toBe(socket);
      expect(resolveClientIp('', socket, 1)).toBe(socket);
    });
  });

  describe('index out of range', () => {
    it('falls back to the socket address when more hops than entries', () => {
      expect(resolveClientIp('1.1.1.1', socket, 3)).toBe(socket);
    });
  });

  describe('whitespace handling', () => {
    it('trims entries and drops empties', () => {
      expect(resolveClientIp(' 1.1.1.1 , 2.2.2.2 ', socket, 1)).toBe('2.2.2.2');
      expect(resolveClientIp(' 1.1.1.1 , 2.2.2.2 ', socket, 2)).toBe('1.1.1.1');
    });
  });

  describe('no IP determinable', () => {
    it('returns undefined when socket is absent and XFF gives nothing', () => {
      expect(resolveClientIp(undefined, undefined, 0)).toBeUndefined();
      expect(resolveClientIp(undefined, undefined, 1)).toBeUndefined();
    });
  });
});

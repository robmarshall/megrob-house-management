import { describe, it, expect } from 'vitest';
import { queryClient, shouldRetryQuery } from './queryClient';

describe('shouldRetryQuery', () => {
  it.each([401, 403, 404, 400, 422])(
    'returns false for status %i regardless of failureCount',
    (status) => {
      expect(shouldRetryQuery(0, { status })).toBe(false);
      expect(shouldRetryQuery(1, { status })).toBe(false);
      expect(shouldRetryQuery(2, { status })).toBe(false);
    }
  );

  it.each([500, 503])(
    'returns true for status %i when under the retry limit',
    (status) => {
      expect(shouldRetryQuery(0, { status })).toBe(true);
      expect(shouldRetryQuery(1, { status })).toBe(true);
      expect(shouldRetryQuery(2, { status })).toBe(true);
    }
  );

  it.each([500, 503])(
    'returns false for status %i once the retry limit is reached',
    (status) => {
      expect(shouldRetryQuery(3, { status })).toBe(false);
      expect(shouldRetryQuery(4, { status })).toBe(false);
    }
  );

  it('returns true for a network error with no status when under the limit', () => {
    const error = new TypeError('Failed to fetch');
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(true);
  });

  it('returns false for a network error with no status once the limit is reached', () => {
    const error = new TypeError('Failed to fetch');
    expect(shouldRetryQuery(3, error)).toBe(false);
  });
});

describe('queryClient configuration', () => {
  it('never auto-retries mutations', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(0);
  });

  it('uses shouldRetryQuery as the query retry predicate', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry;
    expect(retry).toBe(shouldRetryQuery);
  });
});

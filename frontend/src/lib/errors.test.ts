import { describe, it, expect } from 'vitest';
import { getAuthErrorMessage } from './errors';

describe('getAuthErrorMessage', () => {
  it('returns friendly message for invalid credentials', () => {
    const error = new Error('Invalid email or password');
    expect(getAuthErrorMessage(error)).toBe('Invalid email or password. Please try again.');
  });

  it('returns friendly message for invalid password', () => {
    const error = new Error('Invalid password');
    expect(getAuthErrorMessage(error)).toBe('Invalid email or password. Please try again.');
  });

  it('returns friendly message for user not found', () => {
    const error = new Error('User not found');
    expect(getAuthErrorMessage(error)).toBe('No account found with this email address.');
  });

  it('returns friendly message for not found', () => {
    const error = new Error('Resource not found');
    expect(getAuthErrorMessage(error)).toBe('No account found with this email address.');
  });

  it('returns friendly message for rate limiting', () => {
    const error = new Error('Rate limit exceeded');
    expect(getAuthErrorMessage(error)).toBe('Too many requests. Please try again later.');
  });

  it('returns friendly message for too many requests', () => {
    const error = new Error('Too many attempts');
    expect(getAuthErrorMessage(error)).toBe('Too many requests. Please try again later.');
  });

  it('returns friendly message for expired session', () => {
    const error = new Error('Session has expired');
    expect(getAuthErrorMessage(error)).toBe('Your session has expired. Please log in again.');
  });

  it('returns friendly message for invalid token', () => {
    const error = new Error('Token is invalid');
    expect(getAuthErrorMessage(error)).toBe(
      'Invalid or expired reset token. Please request a new password reset.'
    );
  });

  it('returns the error message for unknown Error types', () => {
    const error = new Error('Something weird happened');
    expect(getAuthErrorMessage(error)).toBe('Something weird happened');
  });

  it('returns generic message for non-Error values', () => {
    expect(getAuthErrorMessage('string error')).toBe(
      'An unexpected error occurred. Please try again.'
    );
    expect(getAuthErrorMessage(null)).toBe(
      'An unexpected error occurred. Please try again.'
    );
    expect(getAuthErrorMessage(undefined)).toBe(
      'An unexpected error occurred. Please try again.'
    );
    expect(getAuthErrorMessage(42)).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });
});

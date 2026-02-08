import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, getPasswordStrength } from './validators';

describe('validateEmail', () => {
  it('returns null for valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('returns error for empty email', () => {
    expect(validateEmail('')).toBe('Email is required');
  });

  it('returns error for invalid email (no @)', () => {
    expect(validateEmail('userexample.com')).toBe('Please enter a valid email address');
  });

  it('returns error for invalid email (no domain)', () => {
    expect(validateEmail('user@')).toBe('Please enter a valid email address');
  });

  it('returns error for invalid email (no TLD)', () => {
    expect(validateEmail('user@example')).toBe('Please enter a valid email address');
  });

  it('returns error for email with spaces', () => {
    expect(validateEmail('user @example.com')).toBe('Please enter a valid email address');
  });

  it('accepts email with subdomains', () => {
    expect(validateEmail('user@mail.example.com')).toBeNull();
  });

  it('accepts email with plus addressing', () => {
    expect(validateEmail('user+tag@example.com')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('returns null for valid password', () => {
    expect(validatePassword('password123')).toBeNull();
  });

  it('returns error for empty password', () => {
    expect(validatePassword('')).toBe('Password is required');
  });

  it('returns error for short password', () => {
    expect(validatePassword('12345')).toBe('Password must be at least 6 characters');
  });

  it('accepts exactly 6 characters', () => {
    expect(validatePassword('abcdef')).toBeNull();
  });
});

describe('getPasswordStrength', () => {
  it('returns weak for short passwords', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
    expect(getPasswordStrength('1234567')).toBe('weak');
  });

  it('returns medium for 8+ chars with 2+ categories', () => {
    expect(getPasswordStrength('password1')).toBe('medium');
    expect(getPasswordStrength('Password')).toBe('medium');
  });

  it('returns strong for 12+ chars with 3+ categories', () => {
    expect(getPasswordStrength('MyPassword123')).toBe('strong');
    expect(getPasswordStrength('Str0ng!Pass12')).toBe('strong');
  });

  it('returns weak for 8+ chars with only one category', () => {
    expect(getPasswordStrength('abcdefgh')).toBe('weak');
  });

  it('returns medium for 12+ chars with only 2 categories', () => {
    expect(getPasswordStrength('abcdefghijkl1')).toBe('medium');
  });
});

import { describe, it, expect } from 'vitest';
import { getPasswordStrength } from './validators';

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

import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges simple class strings', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('text-lg', 'text-sm')).toBe('text-sm');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'hidden')).toBe('base active');
  });

  it('handles undefined and null values', () => {
    expect(cn('base', undefined, null, 'extra')).toBe('base extra');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('deduplicates identical classes', () => {
    expect(cn('p-4 p-4')).toBe('p-4');
  });

  it('resolves padding conflicts', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});

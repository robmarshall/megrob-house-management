import { describe, it, expect } from 'vitest';
import { uniqueListName } from './listNames';

describe('uniqueListName', () => {
  it('returns the base name when nothing is taken', () => {
    expect(uniqueListName('Shopping', [])).toBe('Shopping');
    expect(uniqueListName('Shopping', ['Groceries', 'Hardware'])).toBe('Shopping');
  });

  it('appends 2 when the base name is taken', () => {
    expect(uniqueListName('Shopping', ['Shopping'])).toBe('Shopping 2');
  });

  it('fills the lowest free suffix rather than always counting up', () => {
    expect(uniqueListName('Shopping', ['Shopping', 'Shopping 2', 'Shopping 3'])).toBe('Shopping 4');
    expect(uniqueListName('Shopping', ['Shopping', 'Shopping 3'])).toBe('Shopping 2');
  });

  it('ignores case and surrounding whitespace when comparing', () => {
    expect(uniqueListName('Shopping', ['shopping '])).toBe('Shopping 2');
    expect(uniqueListName('Shopping', ['SHOPPING', ' shopping 2'])).toBe('Shopping 3');
  });
});

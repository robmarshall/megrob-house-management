import { describe, it, expect } from 'vitest';
import {
  singularize,
  normalizeItemName,
  namesMatch,
  normalizeUnit,
  unitsMatch,
  combineNotes,
  findMatchingItem,
  type MatchableItem,
} from './itemMatcher';

describe('singularize', () => {
  it('handles regular plurals (carrots -> carrot)', () => {
    expect(singularize('carrots')).toBe('carrot');
  });

  it('handles -ies plurals (cherries -> cherry)', () => {
    expect(singularize('cherries')).toBe('cherry');
  });

  it('handles -ves plurals (calves -> calf)', () => {
    expect(singularize('calves')).toBe('calf');
  });

  it('handles -es plurals (boxes -> box)', () => {
    expect(singularize('boxes')).toBe('box');
  });

  it('handles -es plurals (dishes -> dish)', () => {
    expect(singularize('dishes')).toBe('dish');
  });

  it('handles irregular: tomatoes -> tomato', () => {
    expect(singularize('tomatoes')).toBe('tomato');
  });

  it('handles irregular: potatoes -> potato', () => {
    expect(singularize('potatoes')).toBe('potato');
  });

  it('handles irregular: leaves -> leaf', () => {
    expect(singularize('leaves')).toBe('leaf');
  });

  it('handles irregular: mice -> mouse', () => {
    expect(singularize('mice')).toBe('mouse');
  });

  it('handles irregular: children -> child', () => {
    expect(singularize('children')).toBe('child');
  });

  it('handles irregular: strawberries -> strawberry', () => {
    expect(singularize('strawberries')).toBe('strawberry');
  });

  it('handles general -ies fallback (pastries -> pastry)', () => {
    expect(singularize('pastries')).toBe('pastry');
  });

  it('handles general -ves fallback (scarves -> scarf)', () => {
    expect(singularize('scarves')).toBe('scarf');
  });

  it('returns singular words unchanged', () => {
    expect(singularize('apple')).toBe('apple');
  });

  it('is case insensitive', () => {
    expect(singularize('Carrots')).toBe('carrot');
  });

  it('handles words ending in ss (no false trim)', () => {
    expect(singularize('grass')).toBe('grass');
  });
});

describe('normalizeItemName', () => {
  it('lowercases and singularizes each word', () => {
    expect(normalizeItemName('Red Apples')).toBe('red apple');
  });

  it('handles multiple words', () => {
    expect(normalizeItemName('Large Green Peppers')).toBe('large green pepper');
  });

  it('trims whitespace', () => {
    expect(normalizeItemName('  carrots  ')).toBe('carrot');
  });
});

describe('namesMatch', () => {
  it('matches singular and plural', () => {
    expect(namesMatch('apple', 'apples')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(namesMatch('Red Apples', 'red apple')).toBe(true);
  });

  it('does not match different items', () => {
    expect(namesMatch('apple', 'banana')).toBe(false);
  });

  it('matches identical items', () => {
    expect(namesMatch('butter', 'butter')).toBe(true);
  });
});

describe('normalizeUnit', () => {
  it('returns null for null', () => {
    expect(normalizeUnit(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeUnit(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeUnit('')).toBeNull();
  });

  it('returns null for whitespace-only', () => {
    expect(normalizeUnit('   ')).toBeNull();
  });

  it('lowercases and trims', () => {
    expect(normalizeUnit('  Cups  ')).toBe('cups');
  });
});

describe('unitsMatch', () => {
  it('matches null and null', () => {
    expect(unitsMatch(null, null)).toBe(true);
  });

  it('matches null and empty string', () => {
    expect(unitsMatch(null, '')).toBe(true);
  });

  it('matches undefined and null', () => {
    expect(unitsMatch(undefined, null)).toBe(true);
  });

  it('matches same unit', () => {
    expect(unitsMatch('cups', 'cups')).toBe(true);
  });

  it('matches different cases', () => {
    expect(unitsMatch('Cups', 'cups')).toBe(true);
  });

  it('does not match different units', () => {
    expect(unitsMatch('cups', 'tbsp')).toBe(false);
  });

  it('does not match unit with null', () => {
    expect(unitsMatch('cups', null)).toBe(false);
  });
});

describe('combineNotes', () => {
  it('returns null when both empty', () => {
    expect(combineNotes(null, null)).toBeNull();
  });

  it('returns null when both are empty strings', () => {
    expect(combineNotes('', '')).toBeNull();
  });

  it('returns incoming when existing is empty', () => {
    expect(combineNotes(null, 'chopped')).toBe('chopped');
  });

  it('returns existing when incoming is empty', () => {
    expect(combineNotes('diced', null)).toBe('diced');
  });

  it('returns single copy when identical', () => {
    expect(combineNotes('chopped', 'chopped')).toBe('chopped');
  });

  it('returns existing when it includes incoming', () => {
    expect(combineNotes('finely chopped', 'chopped')).toBe('finely chopped');
  });

  it('combines different notes with semicolon', () => {
    expect(combineNotes('diced', 'for garnish')).toBe('diced; for garnish');
  });
});

describe('findMatchingItem', () => {
  const items: MatchableItem[] = [
    { id: 1, name: 'Apples', unit: null, quantity: '3', notes: null, checked: false },
    { id: 2, name: 'Butter', unit: 'cups', quantity: '1', notes: null, checked: false },
    { id: 3, name: 'Sugar', unit: 'cups', quantity: '2', notes: null, checked: true },
    { id: 4, name: 'Flour', unit: 'cups', quantity: '3', notes: null, checked: false },
  ];

  it('finds matching item by name (singular/plural)', () => {
    const match = findMatchingItem('apple', null, items);
    expect(match).not.toBeNull();
    expect(match!.id).toBe(1);
  });

  it('requires unit match', () => {
    const match = findMatchingItem('Butter', 'tbsp', items);
    expect(match).toBeNull();
  });

  it('matches unit correctly', () => {
    const match = findMatchingItem('butter', 'cups', items);
    expect(match).not.toBeNull();
    expect(match!.id).toBe(2);
  });

  it('skips checked items', () => {
    const match = findMatchingItem('sugar', 'cups', items);
    expect(match).toBeNull();
  });

  it('returns null when no match', () => {
    const match = findMatchingItem('Milk', null, items);
    expect(match).toBeNull();
  });

  it('matches null unit to no-unit item', () => {
    const match = findMatchingItem('apples', null, items);
    expect(match).not.toBeNull();
    expect(match!.id).toBe(1);
  });
});

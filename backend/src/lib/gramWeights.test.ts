import { describe, it, expect } from 'vitest';
import { cacheUnit, isMassUnit, massToGrams, ITEM_UNIT } from './gramWeights.js';

describe('isMassUnit', () => {
  it('recognizes canonical and variant mass units', () => {
    expect(isMassUnit('g')).toBe(true);
    expect(isMassUnit('grams')).toBe(true);
    expect(isMassUnit('kg')).toBe(true);
    expect(isMassUnit('pounds')).toBe(true);
    expect(isMassUnit('oz')).toBe(true);
  });

  it('rejects volume, count, and missing units', () => {
    expect(isMassUnit('cups')).toBe(false);
    expect(isMassUnit('tbsp')).toBe(false);
    expect(isMassUnit('ml')).toBe(false);
    expect(isMassUnit(null)).toBe(false);
    expect(isMassUnit(undefined)).toBe(false);
  });
});

describe('massToGrams', () => {
  it('converts mass units to grams', () => {
    expect(massToGrams(200, 'g')).toBe(200);
    expect(massToGrams(1.5, 'kg')).toBe(1500);
    expect(massToGrams(2, 'lbs')).toBeCloseTo(907.2);
    expect(massToGrams(4, 'ounces')).toBeCloseTo(113.4);
  });

  it('returns null for non-mass units', () => {
    expect(massToGrams(1, 'cups')).toBeNull();
    expect(massToGrams(1, null)).toBeNull();
  });
});

describe('cacheUnit', () => {
  it('collapses all mass units to g', () => {
    expect(cacheUnit('kg')).toBe('g');
    expect(cacheUnit('pounds')).toBe('g');
    expect(cacheUnit('g')).toBe('g');
  });

  it('keeps canonical non-mass units', () => {
    expect(cacheUnit('cup')).toBe('cups');
    expect(cacheUnit('tablespoons')).toBe('tbsp');
    expect(cacheUnit('ml')).toBe('ml');
  });

  it('maps missing units to the item sentinel', () => {
    expect(cacheUnit(null)).toBe(ITEM_UNIT);
    expect(cacheUnit(undefined)).toBe(ITEM_UNIT);
  });
});

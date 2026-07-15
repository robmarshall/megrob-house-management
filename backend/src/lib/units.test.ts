import { describe, it, expect } from 'vitest';
import { canonicalizeUnit } from './units';

describe('canonicalizeUnit', () => {
  it('canonicalizes cup/cups/c to cups', () => {
    expect(canonicalizeUnit('cup')).toBe('cups');
    expect(canonicalizeUnit('cups')).toBe('cups');
    expect(canonicalizeUnit('c')).toBe('cups');
  });

  it('canonicalizes lb/lbs/pound/pounds to lb', () => {
    expect(canonicalizeUnit('lb')).toBe('lb');
    expect(canonicalizeUnit('lbs')).toBe('lb');
    expect(canonicalizeUnit('pound')).toBe('lb');
    expect(canonicalizeUnit('pounds')).toBe('lb');
  });

  it('canonicalizes tablespoon/tbs/tb to tbsp', () => {
    expect(canonicalizeUnit('tablespoon')).toBe('tbsp');
    expect(canonicalizeUnit('tablespoons')).toBe('tbsp');
    expect(canonicalizeUnit('tbs')).toBe('tbsp');
    expect(canonicalizeUnit('tb')).toBe('tbsp');
    expect(canonicalizeUnit('tbsp')).toBe('tbsp');
  });

  it('canonicalizes teaspoon/ts to tsp', () => {
    expect(canonicalizeUnit('teaspoon')).toBe('tsp');
    expect(canonicalizeUnit('teaspoons')).toBe('tsp');
    expect(canonicalizeUnit('ts')).toBe('tsp');
  });

  it('canonicalizes fluid ounce/fluid ounces/fl oz to fl oz', () => {
    expect(canonicalizeUnit('fluid ounce')).toBe('fl oz');
    expect(canonicalizeUnit('fluid ounces')).toBe('fl oz');
    expect(canonicalizeUnit('fl oz')).toBe('fl oz');
  });

  it('canonicalizes liter/l to L', () => {
    expect(canonicalizeUnit('liter')).toBe('L');
    expect(canonicalizeUnit('liters')).toBe('L');
    expect(canonicalizeUnit('l')).toBe('L');
  });

  it('canonicalizes ounce/ounces to oz and gram/grams to g', () => {
    expect(canonicalizeUnit('ounce')).toBe('oz');
    expect(canonicalizeUnit('ounces')).toBe('oz');
    expect(canonicalizeUnit('gram')).toBe('g');
    expect(canonicalizeUnit('grams')).toBe('g');
  });

  it('is case-insensitive (Cups -> cups, Pound -> lb)', () => {
    expect(canonicalizeUnit('Cups')).toBe('cups');
    expect(canonicalizeUnit('Cup')).toBe('cups');
    expect(canonicalizeUnit('Pound')).toBe('lb');
    expect(canonicalizeUnit('LBS')).toBe('lb');
  });

  it('trims surrounding whitespace', () => {
    expect(canonicalizeUnit('  cup  ')).toBe('cups');
  });

  it('passes through unknown units unchanged (lowercased/trimmed)', () => {
    expect(canonicalizeUnit('bottle')).toBe('bottle');
    expect(canonicalizeUnit('  Bottle ')).toBe('bottle');
  });

  it('returns empty string for empty input', () => {
    expect(canonicalizeUnit('')).toBe('');
    expect(canonicalizeUnit('   ')).toBe('');
  });
});

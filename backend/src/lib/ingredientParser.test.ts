import { describe, it, expect } from 'vitest';
import { parseIngredient, scaleIngredient, formatIngredient } from './ingredientParser';

describe('parseIngredient', () => {
  describe('basic quantity + unit + name', () => {
    it('parses whole number with unit', () => {
      const result = parseIngredient('2 cups all-purpose flour');
      expect(result).toEqual({
        quantity: 2,
        unit: 'cups',
        name: 'all-purpose flour',
        notes: null,
      });
    });

    it('parses tablespoon unit', () => {
      const result = parseIngredient('3 tablespoons olive oil');
      expect(result).toEqual({
        quantity: 3,
        unit: 'tbsp',
        name: 'olive oil',
        notes: null,
      });
    });

    it('parses teaspoon unit', () => {
      const result = parseIngredient('1 teaspoon salt');
      expect(result).toEqual({
        quantity: 1,
        unit: 'tsp',
        name: 'salt',
        notes: null,
      });
    });

    it('parses weight units (lb)', () => {
      const result = parseIngredient('2 pounds chicken breast');
      expect(result).toEqual({
        quantity: 2,
        unit: 'lb',
        name: 'chicken breast',
        notes: null,
      });
    });

    it('parses weight units (oz)', () => {
      const result = parseIngredient('8 ounces cream cheese');
      expect(result).toEqual({
        quantity: 8,
        unit: 'oz',
        name: 'cream cheese',
        notes: null,
      });
    });

    it('parses metric units (g)', () => {
      const result = parseIngredient('200 grams sugar');
      expect(result).toEqual({
        quantity: 200,
        unit: 'g',
        name: 'sugar',
        notes: null,
      });
    });
  });

  describe('fractions', () => {
    it('parses simple fractions', () => {
      const result = parseIngredient('1/2 cup butter');
      expect(result.quantity).toBeCloseTo(0.5);
      expect(result.unit).toBe('cups');
      expect(result.name).toBe('butter');
    });

    it('parses mixed fractions', () => {
      const result = parseIngredient('1 1/2 cups milk');
      expect(result.quantity).toBeCloseTo(1.5);
      expect(result.unit).toBe('cups');
      expect(result.name).toBe('milk');
    });

    it('parses unicode fractions (½)', () => {
      const result = parseIngredient('½ cup sugar');
      expect(result.quantity).toBeCloseTo(0.5);
      expect(result.unit).toBe('cups');
      expect(result.name).toBe('sugar');
    });

    it('parses unicode fractions (¼)', () => {
      const result = parseIngredient('¼ teaspoon pepper');
      expect(result.quantity).toBeCloseTo(0.25);
      expect(result.unit).toBe('tsp');
      expect(result.name).toBe('pepper');
    });

    it('parses whole + unicode fraction (1½)', () => {
      const result = parseIngredient('1½ cups flour');
      expect(result.quantity).toBeCloseTo(1.5);
      expect(result.unit).toBe('cups');
      expect(result.name).toBe('flour');
    });
  });

  describe('size-based units', () => {
    it('parses large as a unit', () => {
      const result = parseIngredient('3 large eggs');
      expect(result).toEqual({
        quantity: 3,
        unit: 'large',
        name: 'eggs',
        notes: null,
      });
    });

    it('parses medium as a unit', () => {
      const result = parseIngredient('2 medium onions');
      expect(result).toEqual({
        quantity: 2,
        unit: 'medium',
        name: 'onions',
        notes: null,
      });
    });
  });

  describe('notes extraction', () => {
    it('extracts comma-separated notes', () => {
      const result = parseIngredient('1/2 cup butter, melted');
      expect(result.quantity).toBeCloseTo(0.5);
      expect(result.unit).toBe('cups');
      expect(result.name).toBe('butter');
      expect(result.notes).toBe('melted');
    });

    it('extracts parenthetical notes', () => {
      const result = parseIngredient('1 cup chicken broth (low sodium)');
      expect(result.quantity).toBe(1);
      expect(result.unit).toBe('cups');
      expect(result.name).toBe('chicken broth');
      expect(result.notes).toBe('low sodium');
    });

    it('extracts "to taste" notes', () => {
      const result = parseIngredient('Salt, to taste');
      expect(result.name).toBe('Salt');
      expect(result.notes).toBe('to taste');
    });

    it('extracts "for garnish" notes', () => {
      const result = parseIngredient('Fresh parsley, for garnish');
      expect(result.name).toBe('Fresh parsley');
      expect(result.notes).toBe('for garnish');
    });
  });

  describe('edge cases', () => {
    it('handles ingredient with no quantity', () => {
      const result = parseIngredient('Salt');
      expect(result.quantity).toBeNull();
      expect(result.unit).toBeNull();
      expect(result.name).toBe('Salt');
    });

    it('handles "of" after unit', () => {
      const result = parseIngredient('2 cups of flour');
      expect(result.quantity).toBe(2);
      expect(result.unit).toBe('cups');
      expect(result.name).toBe('flour');
    });

    it('handles count units', () => {
      const result = parseIngredient('3 cloves garlic');
      expect(result).toEqual({
        quantity: 3,
        unit: 'cloves',
        name: 'garlic',
        notes: null,
      });
    });

    it('handles decimal quantities', () => {
      const result = parseIngredient('1.5 cups water');
      expect(result.quantity).toBeCloseTo(1.5);
      expect(result.unit).toBe('cups');
      expect(result.name).toBe('water');
    });
  });
});

describe('scaleIngredient', () => {
  it('scales quantity by multiplier', () => {
    const ingredient = { quantity: 2, unit: 'cups', name: 'flour', notes: null };
    const scaled = scaleIngredient(ingredient, 2);
    expect(scaled.quantity).toBe(4);
    expect(scaled.unit).toBe('cups');
    expect(scaled.name).toBe('flour');
  });

  it('handles null quantity', () => {
    const ingredient = { quantity: null, unit: null, name: 'Salt', notes: 'to taste' };
    const scaled = scaleIngredient(ingredient, 3);
    expect(scaled.quantity).toBeNull();
    expect(scaled.name).toBe('Salt');
  });

  it('scales fractional quantities', () => {
    const ingredient = { quantity: 0.5, unit: 'cups', name: 'sugar', notes: null };
    const scaled = scaleIngredient(ingredient, 3);
    expect(scaled.quantity).toBeCloseTo(1.5);
  });
});

describe('formatIngredient', () => {
  it('formats basic ingredient', () => {
    const result = formatIngredient({
      quantity: 2,
      unit: 'cups',
      name: 'flour',
      notes: null,
    });
    expect(result).toBe('2 cups flour');
  });

  it('formats fraction quantities (1/2)', () => {
    const result = formatIngredient({
      quantity: 0.5,
      unit: 'cups',
      name: 'butter',
      notes: null,
    });
    expect(result).toBe('1/2 cups butter');
  });

  it('formats fraction quantities (1/4)', () => {
    const result = formatIngredient({
      quantity: 0.25,
      unit: 'tsp',
      name: 'salt',
      notes: null,
    });
    expect(result).toBe('1/4 tsp salt');
  });

  it('formats fraction quantities (3/4)', () => {
    const result = formatIngredient({
      quantity: 0.75,
      unit: 'cups',
      name: 'milk',
      notes: null,
    });
    expect(result).toBe('3/4 cups milk');
  });

  it('includes notes in parentheses', () => {
    const result = formatIngredient({
      quantity: 1,
      unit: 'cups',
      name: 'butter',
      notes: 'melted',
    });
    expect(result).toBe('1 cups butter (melted)');
  });

  it('formats ingredient without quantity or unit', () => {
    const result = formatIngredient({
      quantity: null,
      unit: null,
      name: 'Salt',
      notes: 'to taste',
    });
    expect(result).toBe('Salt (to taste)');
  });

  it('formats ingredient without unit', () => {
    const result = formatIngredient({
      quantity: 3,
      unit: null,
      name: 'eggs',
      notes: null,
    });
    expect(result).toBe('3 eggs');
  });
});

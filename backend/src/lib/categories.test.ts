import { describe, it, expect } from 'vitest';
import { guessCategory, SHOPPING_CATEGORY_SLUGS } from './categories.js';

describe('guessCategory', () => {
  it('matches simple items', () => {
    expect(guessCategory('Milk')).toBe('dairy');
    expect(guessCategory('bananas')).toBe('fruitveg');
    expect(guessCategory('Chicken')).toBe('meat');
    expect(guessCategory('salmon')).toBe('fish');
    expect(guessCategory('bread')).toBe('bakery');
    expect(guessCategory('pasta')).toBe('pantry');
    expect(guessCategory('orange juice')).toBe('beverages');
    expect(guessCategory('bleach')).toBe('household');
    expect(guessCategory('shampoo')).toBe('toiletries');
    expect(guessCategory('paracetamol')).toBe('medicine');
  });

  it('handles plurals via normalization', () => {
    expect(guessCategory('Tomatoes')).toBe('fruitveg');
    expect(guessCategory('eggs')).toBe('dairy');
    expect(guessCategory('sausages')).toBe('meat');
    expect(guessCategory('strawberries')).toBe('fruitveg');
    expect(guessCategory('nappies')).toBe('toiletries');
  });

  it('prefers the head noun (last word) over earlier words', () => {
    expect(guessCategory('cheddar cheese')).toBe('dairy');
    expect(guessCategory('milk chocolate')).toBe('pantry');
    expect(guessCategory('chicken stock')).toBe('pantry');
    expect(guessCategory('semi-skimmed milk')).toBe('dairy');
  });

  it('falls back to earlier words when the last word is unknown', () => {
    expect(guessCategory('chicken breast')).toBe('meat');
    expect(guessCategory('beef joint')).toBe('meat');
  });

  it('matches multi-word phrases before single words', () => {
    expect(guessCategory('peanut butter')).toBe('pantry'); // not dairy via "butter"
    expect(guessCategory('ice cream')).toBe('frozen'); // not dairy via "cream"
    expect(guessCategory('toilet roll')).toBe('household'); // not bakery via "roll"
    expect(guessCategory('kitchen roll')).toBe('household');
    expect(guessCategory('coconut milk')).toBe('pantry'); // tinned, not dairy
    expect(guessCategory('shaving cream')).toBe('toiletries');
    expect(guessCategory('black pepper')).toBe('pantry'); // spice, not fruitveg
    expect(guessCategory('sweet potatoes')).toBe('fruitveg');
    expect(guessCategory('baked beans')).toBe('pantry');
  });

  it('applies aisle overrides for frozen/tinned/canned', () => {
    expect(guessCategory('frozen peas')).toBe('frozen');
    expect(guessCategory('frozen berries')).toBe('frozen');
    expect(guessCategory('tinned tomatoes')).toBe('pantry');
    expect(guessCategory('canned sweetcorn')).toBe('pantry');
  });

  it('returns null for unknown items', () => {
    expect(guessCategory('mystery thing')).toBeNull();
    expect(guessCategory('')).toBeNull();
    expect(guessCategory('   ')).toBeNull();
  });

  it('only ever returns known slugs', () => {
    const samples = [
      'milk', 'frozen pizza', 'gin', 'washing up liquid', 'cotton wool',
      'dishwasher tablets', 'cough syrup', 'spring onions', 'sea bass',
    ];
    for (const name of samples) {
      const slug = guessCategory(name);
      expect(slug).not.toBeNull();
      expect(SHOPPING_CATEGORY_SLUGS).toContain(slug!);
    }
  });
});

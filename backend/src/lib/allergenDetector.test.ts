import { describe, it, expect } from 'vitest';
import { detectAllergens, detectDietary, detectAllCategories } from './allergenDetector';
import type { AllergenType, DietaryType } from './allergenDetector';

describe('detectAllergens', () => {
  describe('nut allergens', () => {
    it('detects almonds', () => {
      expect(detectAllergens(['almonds'])).toContain('nuts');
    });

    it('detects peanut butter', () => {
      expect(detectAllergens(['peanut butter'])).toContain('nuts');
    });

    it('does not false-positive on coconut', () => {
      const result = detectAllergens(['coconut milk']);
      expect(result).not.toContain('nuts');
    });

    it('does not false-positive on nutmeg', () => {
      const result = detectAllergens(['nutmeg']);
      expect(result).not.toContain('nuts');
    });

    it('detects walnuts', () => {
      expect(detectAllergens(['chopped walnuts'])).toContain('nuts');
    });
  });

  describe('egg allergens', () => {
    it('detects eggs', () => {
      expect(detectAllergens(['2 large eggs'])).toContain('eggs');
    });

    it('detects mayonnaise', () => {
      expect(detectAllergens(['mayonnaise'])).toContain('eggs');
    });

    it('detects egg whites', () => {
      expect(detectAllergens(['3 egg whites'])).toContain('eggs');
    });
  });

  describe('dairy allergens', () => {
    it('detects milk', () => {
      expect(detectAllergens(['1 cup milk'])).toContain('dairy');
    });

    it('detects cheese variants', () => {
      expect(detectAllergens(['shredded cheddar cheese'])).toContain('dairy');
    });

    it('detects butter', () => {
      expect(detectAllergens(['2 tbsp butter'])).toContain('dairy');
    });

    it('detects yogurt', () => {
      expect(detectAllergens(['greek yogurt'])).toContain('dairy');
    });

    it('detects cream', () => {
      expect(detectAllergens(['heavy cream'])).toContain('dairy');
    });
  });

  describe('gluten allergens', () => {
    it('detects flour', () => {
      expect(detectAllergens(['2 cups flour'])).toContain('gluten');
    });

    it('detects pasta', () => {
      expect(detectAllergens(['spaghetti'])).toContain('gluten');
    });

    it('detects soy sauce as gluten', () => {
      expect(detectAllergens(['soy sauce'])).toContain('gluten');
    });

    it('detects bread', () => {
      expect(detectAllergens(['bread'])).toContain('gluten');
    });
  });

  describe('shellfish allergens', () => {
    it('detects shrimp', () => {
      expect(detectAllergens(['1 lb shrimp'])).toContain('shellfish');
    });

    it('detects lobster', () => {
      expect(detectAllergens(['lobster tail'])).toContain('shellfish');
    });

    it('detects scallops', () => {
      expect(detectAllergens(['sea scallops'])).toContain('shellfish');
    });
  });

  describe('soy allergens', () => {
    it('detects tofu', () => {
      expect(detectAllergens(['firm tofu'])).toContain('soy');
    });

    it('detects soy sauce', () => {
      expect(detectAllergens(['soy sauce'])).toContain('soy');
    });

    it('detects edamame', () => {
      expect(detectAllergens(['edamame'])).toContain('soy');
    });

    it('detects tempeh', () => {
      expect(detectAllergens(['tempeh'])).toContain('soy');
    });
  });

  describe('fish allergens', () => {
    it('detects salmon', () => {
      expect(detectAllergens(['salmon fillet'])).toContain('fish');
    });

    it('detects worcestershire sauce', () => {
      expect(detectAllergens(['worcestershire sauce'])).toContain('fish');
    });

    it('detects anchovies', () => {
      expect(detectAllergens(['anchovies'])).toContain('fish');
    });
  });

  describe('multiple allergens', () => {
    it('detects multiple allergens in one ingredient list', () => {
      const allergens = detectAllergens([
        '2 cups flour',
        '3 eggs',
        '1 cup milk',
        'chopped almonds',
      ]);
      expect(allergens).toContain('gluten');
      expect(allergens).toContain('eggs');
      expect(allergens).toContain('dairy');
      expect(allergens).toContain('nuts');
    });

    it('returns empty for allergen-free ingredients', () => {
      const allergens = detectAllergens([
        'rice',
        'olive oil',
        'bell pepper',
        'onion',
        'garlic',
      ]);
      expect(allergens).toHaveLength(0);
    });
  });

  describe('case insensitivity', () => {
    it('detects allergens regardless of case', () => {
      expect(detectAllergens(['MILK'])).toContain('dairy');
      expect(detectAllergens(['Eggs'])).toContain('eggs');
      expect(detectAllergens(['FLOUR'])).toContain('gluten');
    });
  });
});

describe('detectDietary', () => {
  describe('vegan detection', () => {
    it('classifies plant-only ingredients as vegan and vegetarian', () => {
      const dietary = detectDietary([
        'rice',
        'olive oil',
        'bell pepper',
        'onion',
        'garlic',
      ]);
      expect(dietary).toContain('vegan');
      expect(dietary).toContain('vegetarian');
    });

    it('does not classify dairy ingredients as vegan', () => {
      const dietary = detectDietary(['pasta', 'butter', 'garlic']);
      expect(dietary).not.toContain('vegan');
    });

    it('does not classify egg ingredients as vegan', () => {
      const dietary = detectDietary(['flour', 'eggs', 'sugar']);
      expect(dietary).not.toContain('vegan');
    });
  });

  describe('vegetarian detection', () => {
    it('classifies dairy+eggs as vegetarian but not vegan', () => {
      const dietary = detectDietary(['eggs', 'butter', 'flour', 'sugar']);
      expect(dietary).toContain('vegetarian');
      expect(dietary).not.toContain('vegan');
    });

    it('does not classify meat as vegetarian', () => {
      const dietary = detectDietary(['chicken', 'rice', 'vegetables']);
      expect(dietary).not.toContain('vegetarian');
    });
  });

  describe('pescatarian detection', () => {
    it('classifies fish+veggies as pescatarian', () => {
      const dietary = detectDietary(['salmon', 'rice', 'lemon']);
      expect(dietary).toContain('pescatarian');
    });

    it('does not classify meat+fish as pescatarian', () => {
      const dietary = detectDietary(['chicken', 'shrimp', 'rice']);
      expect(dietary).not.toContain('pescatarian');
    });
  });

  describe('meat-containing recipes', () => {
    it('returns empty dietary for meat dishes', () => {
      const dietary = detectDietary(['beef', 'onion', 'potato']);
      expect(dietary).toHaveLength(0);
    });

    it('detects bacon as meat', () => {
      const dietary = detectDietary(['bacon', 'lettuce', 'tomato']);
      expect(dietary).toHaveLength(0);
    });
  });
});

describe('detectAllCategories', () => {
  it('returns both allergens and dietary info', () => {
    const result = detectAllCategories(['rice', 'tofu', 'soy sauce', 'vegetables']);
    expect(result.allergens).toContain('soy');
    expect(result.allergens).toContain('gluten'); // soy sauce contains wheat
    expect(result.dietary).toContain('vegetarian');
  });

  it('handles empty ingredients', () => {
    const result = detectAllCategories([]);
    expect(result.allergens).toHaveLength(0);
    expect(result.dietary).toContain('vegan');
    expect(result.dietary).toContain('vegetarian');
  });
});

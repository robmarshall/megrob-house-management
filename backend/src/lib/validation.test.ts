import { describe, it, expect } from 'vitest';
import { createMealPlanEntrySchema, updateMealPlanEntrySchema } from './validation.js';

describe('updateMealPlanEntrySchema', () => {
  it('rejects explicitly blanking both recipeId and customText (null/null)', () => {
    const result = updateMealPlanEntrySchema.safeParse({ recipeId: null, customText: null });
    expect(result.success).toBe(false);
  });

  it('rejects explicitly blanking both recipeId and customText (null/empty string)', () => {
    const result = updateMealPlanEntrySchema.safeParse({ recipeId: null, customText: '' });
    expect(result.success).toBe(false);
  });

  it('allows switching from a recipe to custom text', () => {
    const result = updateMealPlanEntrySchema.safeParse({ recipeId: null, customText: 'Leftovers' });
    expect(result.success).toBe(true);
  });

  it('allows setting recipeId with customText omitted (keeps existing text)', () => {
    const result = updateMealPlanEntrySchema.safeParse({ recipeId: 5 });
    expect(result.success).toBe(true);
  });

  it('allows clearing customText with recipeId omitted (keeps existing recipe)', () => {
    const result = updateMealPlanEntrySchema.safeParse({ customText: null });
    expect(result.success).toBe(true);
  });

  it('allows updates that touch neither recipeId nor customText', () => {
    const result = updateMealPlanEntrySchema.safeParse({ position: 2 });
    expect(result.success).toBe(true);
  });
});

describe('createMealPlanEntrySchema', () => {
  it('fails when neither recipeId nor customText is provided', () => {
    const result = createMealPlanEntrySchema.safeParse({ dayOfWeek: 0, mealType: 'lunch' });
    expect(result.success).toBe(false);
  });

  it('succeeds when customText is provided', () => {
    const result = createMealPlanEntrySchema.safeParse({
      dayOfWeek: 0,
      mealType: 'lunch',
      customText: 'x',
    });
    expect(result.success).toBe(true);
  });
});

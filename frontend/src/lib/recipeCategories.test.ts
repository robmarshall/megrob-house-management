import { describe, it, expect } from 'vitest'
import { normalizeCategories } from './recipeCategories'

describe('normalizeCategories', () => {
  it('passes canonical types through unchanged', () => {
    const result = normalizeCategories([
      { categoryType: 'meal_type', categoryValue: 'dinner' },
      { categoryType: 'dietary', categoryValue: 'vegan' },
      { categoryType: 'allergen', categoryValue: 'nuts' },
    ])
    expect(result.categories).toEqual([
      { type: 'meal_type', value: 'dinner' },
      { type: 'dietary', value: 'vegan' },
      { type: 'allergen', value: 'nuts' },
    ])
    expect(result.dropped).toEqual([])
  })

  it('coerces the alias spellings MCP-created recipes used', () => {
    const result = normalizeCategories([
      { categoryType: 'meal', categoryValue: 'breakfast' },
      { categoryType: 'mealType', categoryValue: 'dinner' },
      { categoryType: 'Meal-Type', categoryValue: 'lunch' },
      { categoryType: 'diet', categoryValue: 'vegetarian' },
      { categoryType: 'allergens', categoryValue: 'dairy' },
    ])
    expect(result.categories.map((c) => c.type)).toEqual([
      'meal_type',
      'meal_type',
      'meal_type',
      'dietary',
      'allergen',
    ])
    expect(result.dropped).toEqual([])
  })

  it('reports unknown types as dropped instead of throwing', () => {
    const result = normalizeCategories([
      { categoryType: 'dish', categoryValue: 'muffins' },
      { categoryType: 'meal', categoryValue: 'snack' },
    ])
    expect(result.categories).toEqual([{ type: 'meal_type', value: 'snack' }])
    expect(result.dropped).toEqual([{ type: 'dish', value: 'muffins' }])
  })

  it('handles missing input', () => {
    expect(normalizeCategories(undefined)).toEqual({ categories: [], dropped: [] })
  })
})

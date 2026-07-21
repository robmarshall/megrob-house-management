import { describe, it, expect } from 'vitest'
import {
  recipeIngredientSchema,
  recipeCategorySchema,
  createRecipeSchema,
  type CreateRecipeFormData,
} from './schemas'

function makeValidRecipe(overrides: Partial<CreateRecipeFormData> = {}): CreateRecipeFormData {
  return {
    name: 'Test Recipe',
    servings: 4,
    prepTimeMinutes: 30,
    cookTimeMinutes: 60,
    ingredients: [{ name: 'Flour', quantity: 1, unit: 'kg', notes: '' }],
    instructions: [{ step: 'Mix ingredients' }],
    ...overrides,
  }
}

describe('recipeIngredientSchema', () => {
  it('rejects a name longer than 200 characters', () => {
    const result = recipeIngredientSchema.safeParse({ name: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects a unit longer than 50 characters', () => {
    const result = recipeIngredientSchema.safeParse({ name: 'Flour', unit: 'a'.repeat(51) })
    expect(result.success).toBe(false)
  })

  it('rejects notes longer than 500 characters', () => {
    const result = recipeIngredientSchema.safeParse({ name: 'Flour', notes: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('accepts a valid ingredient', () => {
    const result = recipeIngredientSchema.safeParse({ name: 'Flour' })
    expect(result.success).toBe(true)
  })
})

describe('recipeCategorySchema', () => {
  it('rejects a value longer than 100 characters', () => {
    const result = recipeCategorySchema.safeParse({ type: 'meal_type', value: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts a valid category', () => {
    const result = recipeCategorySchema.safeParse({ type: 'meal_type', value: 'Dinner' })
    expect(result.success).toBe(true)
  })
})

describe('createRecipeSchema', () => {
  it('rejects servings over 100', () => {
    const result = createRecipeSchema.safeParse(makeValidRecipe({ servings: 101 }))
    expect(result.success).toBe(false)
  })

  it('rejects prepTimeMinutes over 1440', () => {
    const result = createRecipeSchema.safeParse(makeValidRecipe({ prepTimeMinutes: 1441 }))
    expect(result.success).toBe(false)
  })

  it('rejects cookTimeMinutes over 1440', () => {
    const result = createRecipeSchema.safeParse(makeValidRecipe({ cookTimeMinutes: 1441 }))
    expect(result.success).toBe(false)
  })

  it('accepts in-range servings, prepTimeMinutes, and cookTimeMinutes', () => {
    const result = createRecipeSchema.safeParse(
      makeValidRecipe({ servings: 4, prepTimeMinutes: 30, cookTimeMinutes: 60 })
    )
    expect(result.success).toBe(true)
  })
})

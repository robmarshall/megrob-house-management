import { describe, it, expect } from 'vitest'
import {
  sumEntryNutrition,
  averageDailyNutrition,
  percentOfTarget,
} from './mealPlanNutrition'
import type { MealPlanEntry, MealPlanEntryNutrition } from '@/types/mealPlan'

let nextId = 1
function entry(
  dayOfWeek: number,
  nutrition: MealPlanEntryNutrition | null
): MealPlanEntry {
  return {
    id: nextId++,
    mealPlanId: 1,
    dayOfWeek,
    mealType: 'dinner',
    recipeId: nutrition ? 10 : null,
    customText: nutrition ? null : 'Leftovers',
    position: 0,
    createdAt: '2026-07-20T00:00:00.000Z',
    nutrition,
  }
}

const CURRY: MealPlanEntryNutrition = {
  caloriesKcal: 600,
  proteinG: 30,
  carbsG: 70,
  fatG: 20,
  estimated: false,
}

const SALAD: MealPlanEntryNutrition = {
  caloriesKcal: 300,
  proteinG: 10,
  carbsG: 20,
  fatG: 15,
  estimated: true,
}

describe('sumEntryNutrition', () => {
  it('sums per-serving values and tracks coverage + estimation', () => {
    const totals = sumEntryNutrition([
      entry(0, CURRY),
      entry(0, SALAD),
      entry(0, null), // leftovers
    ])
    expect(totals.caloriesKcal).toBe(900)
    expect(totals.proteinG).toBe(40)
    expect(totals.countedEntries).toBe(2)
    expect(totals.uncountedEntries).toBe(1)
    expect(totals.estimated).toBe(true)
  })

  it('returns zeros for empty or all-uncounted days', () => {
    expect(sumEntryNutrition([]).countedEntries).toBe(0)
    const totals = sumEntryNutrition([entry(1, null)])
    expect(totals.countedEntries).toBe(0)
    expect(totals.uncountedEntries).toBe(1)
  })
})

describe('averageDailyNutrition', () => {
  it('averages only over days with nutrition data', () => {
    const avg = averageDailyNutrition([
      entry(0, CURRY), // Mon: 600
      entry(2, CURRY), // Wed: 900
      entry(2, SALAD),
      entry(4, null), // Fri: no data
    ])
    expect(avg.daysCounted).toBe(2)
    expect(avg.caloriesKcal).toBe(750) // (600 + 900) / 2
    expect(avg.proteinG).toBe(35) // (30 + 40) / 2
    expect(avg.estimated).toBe(true)
  })

  it('reports zero days for an empty plan', () => {
    expect(averageDailyNutrition([]).daysCounted).toBe(0)
  })
})

describe('percentOfTarget', () => {
  it('computes rounded percentages', () => {
    expect(percentOfTarget(1850, 2000)).toBe(93)
    expect(percentOfTarget(96, 128)).toBe(75)
  })

  it('returns null for missing or zero targets', () => {
    expect(percentOfTarget(1850, null)).toBeNull()
    expect(percentOfTarget(1850, 0)).toBeNull()
    expect(percentOfTarget(1850, undefined)).toBeNull()
  })
})

/**
 * Pure aggregation helpers for meal-plan nutrition summaries.
 *
 * Convention (v1): every household member eats one serving of each planned
 * meal, so a day's intake is simply the sum of its entries' per-serving
 * nutrition. Entries without nutrition (custom text, not-yet-enriched
 * recipes) are counted separately so the UI can stay honest about coverage.
 */

import type { MealPlanEntry } from '@/types/mealPlan'

export interface NutritionTotals {
  caloriesKcal: number
  proteinG: number
  carbsG: number
  fatG: number
  /** Entries that contributed to the totals */
  countedEntries: number
  /** Entries with no nutrition data (custom text or pending enrichment) */
  uncountedEntries: number
  /** True when any counted entry used LLM-estimated values */
  estimated: boolean
}

const EMPTY: NutritionTotals = {
  caloriesKcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  countedEntries: 0,
  uncountedEntries: 0,
  estimated: false,
}

/** Sum per-serving nutrition across entries (typically one day's). */
export function sumEntryNutrition(entries: MealPlanEntry[]): NutritionTotals {
  return entries.reduce<NutritionTotals>(
    (acc, entry) => {
      const n = entry.nutrition
      if (!n || n.caloriesKcal === null) {
        return { ...acc, uncountedEntries: acc.uncountedEntries + 1 }
      }
      return {
        caloriesKcal: acc.caloriesKcal + (n.caloriesKcal ?? 0),
        proteinG: acc.proteinG + (n.proteinG ?? 0),
        carbsG: acc.carbsG + (n.carbsG ?? 0),
        fatG: acc.fatG + (n.fatG ?? 0),
        countedEntries: acc.countedEntries + 1,
        uncountedEntries: acc.uncountedEntries,
        estimated: acc.estimated || n.estimated,
      }
    },
    { ...EMPTY }
  )
}

export interface WeekNutritionAverages extends NutritionTotals {
  /** Days (of 7) that had at least one nutrition-bearing entry */
  daysCounted: number
}

/**
 * Average daily intake across the week, over days that have any counted
 * entries (an unplanned Saturday shouldn't drag the average down).
 */
export function averageDailyNutrition(
  entries: MealPlanEntry[]
): WeekNutritionAverages {
  const days = [0, 1, 2, 3, 4, 5, 6].map((day) =>
    sumEntryNutrition(entries.filter((e) => e.dayOfWeek === day))
  )
  const counted = days.filter((d) => d.countedEntries > 0)

  const totals = counted.reduce(
    (acc, day) => ({
      caloriesKcal: acc.caloriesKcal + day.caloriesKcal,
      proteinG: acc.proteinG + day.proteinG,
      carbsG: acc.carbsG + day.carbsG,
      fatG: acc.fatG + day.fatG,
      countedEntries: acc.countedEntries + day.countedEntries,
      uncountedEntries: acc.uncountedEntries + day.uncountedEntries,
      estimated: acc.estimated || day.estimated,
    }),
    { ...EMPTY }
  )

  const n = counted.length
  return {
    caloriesKcal: n ? totals.caloriesKcal / n : 0,
    proteinG: n ? totals.proteinG / n : 0,
    carbsG: n ? totals.carbsG / n : 0,
    fatG: n ? totals.fatG / n : 0,
    countedEntries: totals.countedEntries,
    uncountedEntries: totals.uncountedEntries,
    estimated: totals.estimated,
    daysCounted: n,
  }
}

/** Percent of a daily target, rounded; null when the target is unusable. */
export function percentOfTarget(
  value: number,
  target: number | null | undefined
): number | null {
  if (!target || target <= 0) return null
  return Math.round((value / target) * 100)
}

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  DayNutritionSummary,
  WeekNutritionSummary,
} from './MealPlanNutritionSummary'
import type { MealPlanEntry } from '@/types/mealPlan'
import type { MemberTargets, NutritionTargets } from '@/types/nutrition'

const targets: NutritionTargets = {
  caloriesKcal: 2000,
  proteinG: 128,
  carbsG: 250,
  fatG: 67,
  fiberG: 30,
  saltG: 6,
  overridden: { calories: false, protein: false, carbs: false, fat: false },
  complete: true,
}

const members: MemberTargets[] = [
  { userId: 'u1', name: 'Rob Marshall', isSelf: true, targets },
  { userId: 'u2', name: 'Meg Marshall', isSelf: false, targets: null },
]

let nextId = 1
function entry(dayOfWeek: number, caloriesKcal: number | null): MealPlanEntry {
  return {
    id: nextId++,
    mealPlanId: 1,
    dayOfWeek,
    mealType: 'dinner',
    recipeId: caloriesKcal !== null ? 10 : null,
    customText: caloriesKcal !== null ? null : 'Leftovers',
    position: 0,
    createdAt: '2026-07-20T00:00:00.000Z',
    nutrition:
      caloriesKcal !== null
        ? { caloriesKcal, proteinG: 40, carbsG: 60, fatG: 20, estimated: false }
        : null,
  }
}

describe('DayNutritionSummary', () => {
  it('renders nothing when no entry has nutrition', () => {
    const { container } = render(
      <DayNutritionSummary entries={[entry(0, null)]} members={members} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows day totals, uncounted meals, and member percentage chips', () => {
    render(
      <DayNutritionSummary
        entries={[entry(0, 900), entry(0, 600), entry(0, null)]}
        members={members}
      />
    )
    expect(screen.getByText(/≈ 1,500 kcal · 80 g protein/)).toBeInTheDocument()
    expect(screen.getByText(/1 meal not counted/)).toBeInTheDocument()
    // 1500 / 2000 = 75% for Rob; Meg has no targets -> no chip
    expect(screen.getByText('Rob 75%')).toBeInTheDocument()
    expect(screen.queryByText(/Meg/)).not.toBeInTheDocument()
  })
})

describe('WeekNutritionSummary', () => {
  it('renders nothing for a plan without nutrition data', () => {
    const { container } = render(
      <WeekNutritionSummary entries={[entry(0, null)]} members={members} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('averages over planned days and compares to member targets', () => {
    render(
      <WeekNutritionSummary
        entries={[entry(0, 1800), entry(2, 2200)]}
        members={members}
      />
    )
    // (1800 + 2200) / 2 = 2000 avg
    expect(
      screen.getByText(/Averaging ≈ 2,000 kcal · 40 g protein per planned day/)
    ).toBeInTheDocument()
    expect(screen.getByText(/2 of 7 days have data/)).toBeInTheDocument()
    expect(screen.getByText('Rob')).toBeInTheDocument()
    // 2000/2000 kcal, 40/128 protein
    expect(screen.getByText(/100% of calories, 31% of protein/)).toBeInTheDocument()
    expect(screen.getByText(/one serving of each planned meal/)).toBeInTheDocument()
  })
})

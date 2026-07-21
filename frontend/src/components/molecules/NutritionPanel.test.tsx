import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NutritionPanel } from './NutritionPanel'
import type { RecipeNutrition } from '@/types/recipe'

const READY: RecipeNutrition = {
  status: 'ready',
  caloriesKcal: 205,
  proteinG: 13.4,
  carbsG: 36.8,
  fatG: 0.8,
  fiberG: 6.3,
  sugarG: 3.7,
  saltG: 0,
  estimated: false,
  matchedCount: 2,
  totalCount: 2,
}

describe('NutritionPanel', () => {
  it('renders nothing when no nutrition row exists yet', () => {
    const { container } = render(<NutritionPanel nutrition={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows per-serving values when ready', () => {
    render(<NutritionPanel nutrition={READY} />)
    expect(screen.getByRole('heading', { name: 'Nutrition' })).toBeInTheDocument()
    expect(screen.getByText('205 kcal')).toBeInTheDocument()
    expect(screen.getByText('13.4 g')).toBeInTheDocument()
    expect(screen.queryByText(/estimated/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/based on/i)).not.toBeInTheDocument()
  })

  it('flags estimated values and partial ingredient coverage', () => {
    render(
      <NutritionPanel
        nutrition={{ ...READY, estimated: true, matchedCount: 9, totalCount: 11 }}
      />
    )
    expect(screen.getByText(/~ estimated/i)).toBeInTheDocument()
    expect(screen.getByText(/based on 9 of 11 ingredients/i)).toBeInTheDocument()
  })

  it('shows progress and failure states', () => {
    const { rerender } = render(
      <NutritionPanel nutrition={{ ...READY, status: 'pending' }} />
    )
    expect(screen.getByText(/calculating nutrition/i)).toBeInTheDocument()

    rerender(<NutritionPanel nutrition={{ ...READY, status: 'failed' }} />)
    expect(screen.getByText(/couldn't be calculated/i)).toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MealSlot } from './MealPlanPage'
import { MEAL_TYPES } from '@/types/mealPlan'
import type { MealPlanEntry } from '@/types/mealPlan'

const entry: MealPlanEntry = {
  id: 1,
  mealPlanId: 1,
  dayOfWeek: 0,
  mealType: MEAL_TYPES[0],
  recipeId: null,
  recipeName: 'Pasta',
  recipeImageUrl: null,
  customText: null,
  position: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('MealSlot', () => {
  it('renders the remove control visibly, not hidden behind hover', () => {
    render(
      <MealSlot
        mealType={MEAL_TYPES[0]}
        entries={[entry]}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const removeButton = screen.getByLabelText('Remove meal entry')
    expect(removeButton).toBeInTheDocument()
    expect(removeButton.className).not.toContain('opacity-0')
    expect(removeButton.className).not.toContain('group-hover')
  })

  it('opens the confirm sheet without calling onDelete immediately', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <MealSlot
        mealType={MEAL_TYPES[0]}
        entries={[entry]}
        onAdd={vi.fn()}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByLabelText('Remove meal entry'))

    expect(
      await screen.findByText(`Delete "${entry.recipeName}"?`)
    ).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('calls onDelete with the entry id when confirming in the sheet', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <MealSlot
        mealType={MEAL_TYPES[0]}
        entries={[entry]}
        onAdd={vi.fn()}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByLabelText('Remove meal entry'))
    await screen.findByText(`Delete "${entry.recipeName}"?`)
    await user.click(screen.getByRole('button', { name: 'Yes, Delete' }))
    await user.click(screen.getByRole('button', { name: 'Permanently Delete' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(entry.id)
  })
})

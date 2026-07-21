import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NutritionProfileSection } from './NutritionProfileSection'
import type { NutritionProfileResult } from '@/types/nutrition'

const save = vi.fn()
let mockData: NutritionProfileResult | null = null
let mockLoading = false

vi.mock('@/hooks/nutrition/useNutritionProfile', () => ({
  useNutritionProfile: () => ({
    data: mockData,
    isLoading: mockLoading,
    error: null,
  }),
  useSaveNutritionProfile: () => ({ save, isSaving: false }),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const PROFILE_RESULT: NutritionProfileResult = {
  profile: {
    heightCm: 180,
    weightKg: 80,
    dateOfBirth: '1990-07-01',
    sex: 'male',
    activityLevel: 'moderate',
    goal: 'maintain',
    overrideCaloriesKcal: null,
    overrideProteinG: null,
    overrideCarbsG: null,
    overrideFatG: null,
    updatedAt: '2026-07-21T00:00:00.000Z',
  },
  targets: {
    caloriesKcal: 2713,
    proteinG: 128,
    carbsG: 359,
    fatG: 90,
    fiberG: 30,
    saltG: 6,
    overridden: { calories: false, protein: false, carbs: false, fat: false },
    complete: true,
  },
}

beforeEach(() => {
  save.mockReset()
  save.mockResolvedValue(PROFILE_RESULT)
  mockData = null
  mockLoading = false
})

describe('NutritionProfileSection', () => {
  it('shows a loading state while the profile fetches', () => {
    mockLoading = true
    render(<NutritionProfileSection />)
    expect(screen.getByText(/loading nutrition profile/i)).toBeInTheDocument()
  })

  it('renders the form without targets before the first save', () => {
    render(<NutritionProfileSection />)
    expect(screen.getByLabelText(/height/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /your daily targets/i })
    ).not.toBeInTheDocument()
  })

  it('shows computed targets and populated fields for a saved profile', () => {
    mockData = PROFILE_RESULT
    render(<NutritionProfileSection />)

    expect(
      screen.getByRole('heading', { name: /your daily targets/i })
    ).toBeInTheDocument()
    expect(screen.getByText('2,713 kcal')).toBeInTheDocument()
    expect(screen.getByText('128 g')).toBeInTheDocument()
    expect(screen.getByLabelText(/height/i)).toHaveValue(180)
    // Not-medical-advice note is always present with targets
    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument()
  })

  it('submits numeric values (not strings) with nulls for empty fields', async () => {
    const user = userEvent.setup()
    render(<NutritionProfileSection />)

    await user.type(screen.getByLabelText(/height/i), '175')
    await user.type(screen.getByLabelText(/weight/i), '70')
    await user.selectOptions(screen.getByLabelText(/sex/i), 'female')
    await user.click(
      screen.getByRole('button', { name: /save nutrition profile/i })
    )

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        heightCm: 175,
        weightKg: 70,
        sex: 'female',
        dateOfBirth: null,
        activityLevel: null,
        goal: 'maintain',
        overrideCaloriesKcal: null,
      })
    )
  })

  it('rejects an out-of-range height with a field error and does not save', async () => {
    const user = userEvent.setup()
    render(<NutritionProfileSection />)

    await user.type(screen.getByLabelText(/height/i), '20')
    await user.click(
      screen.getByRole('button', { name: /save nutrition profile/i })
    )

    expect(
      await screen.findByText(/height must be at least 80 cm/i)
    ).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('states the household privacy rule', () => {
    render(<NutritionProfileSection />)
    expect(
      screen.getByText(/household members only ever see your daily targets/i)
    ).toBeInTheDocument()
  })
})

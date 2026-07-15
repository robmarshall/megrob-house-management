import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AddMealEntryBottomSheet from './AddMealEntryBottomSheet';
import { DAY_SHORT_LABELS, MEAL_TYPE_LABELS, MEAL_TYPES } from '@/types/mealPlan';

vi.mock('@/hooks/recipe/useRecipes', () => ({
  useRecipes: () => ({ data: [], isLoading: false }),
}));

describe('AddMealEntryBottomSheet', () => {
  it('pre-selects the day and meal type passed in as defaults when opened', async () => {
    const mealType = MEAL_TYPES[1]; // 'lunch'
    const { rerender } = render(
      <AddMealEntryBottomSheet
        isOpen={false}
        onClose={() => {}}
        onSubmit={async () => {}}
      />
    );

    rerender(
      <AddMealEntryBottomSheet
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        defaultDayOfWeek={2}
        defaultMealType={mealType}
      />
    );

    const dayButton = await screen.findByRole('button', { name: DAY_SHORT_LABELS[2] });
    const mealTypeButton = await screen.findByRole('button', { name: MEAL_TYPE_LABELS[mealType] });

    expect(dayButton.className).toContain('bg-primary-600');
    expect(mealTypeButton.className).toContain('bg-primary-600');
  });

  it('leaves day and meal type unselected and the submit button disabled when opened without defaults', async () => {
    render(
      <AddMealEntryBottomSheet
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
      />
    );

    const dayButtons = DAY_SHORT_LABELS.map((label) => screen.getByRole('button', { name: label }));
    const mealTypeButtons = MEAL_TYPES.map((type) =>
      screen.getByRole('button', { name: MEAL_TYPE_LABELS[type] })
    );

    for (const button of [...dayButtons, ...mealTypeButtons]) {
      expect(button.className).not.toContain('bg-primary-600');
    }

    const submitButton = await screen.findByRole('button', { name: 'Add Meal' });
    expect(submitButton).toBeDisabled();
  });
});

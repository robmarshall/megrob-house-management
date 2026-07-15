import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppHeader } from './AppHeader';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

describe('AppHeader', () => {
  it('includes a Meal Planning link in the drawer nav alongside the existing links', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    );

    await user.click(screen.getByLabelText('Open menu'));

    const mealPlanningLink = await screen.findByRole('link', { name: 'Meal Planning' });
    expect(mealPlanningLink).toBeInTheDocument();
    expect(mealPlanningLink.getAttribute('href')).toMatch(/\/meal-plans$/);

    expect(screen.getByRole('link', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Household' })).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CookingModePage } from './CookingModePage';

// Heroicons render as <svg><path d="..."/></svg>. These are the exact path
// definitions for the collapse/expand chevrons, used to assert direction.
const CHEVRON_DOWN_PATH = 'm19.5 8.25-7.5 7.5-7.5-7.5';
const CHEVRON_UP_PATH = 'm4.5 15.75 7.5-7.5 7.5 7.5';

// Mutable search params — each test sets this before rendering.
let searchParamsValue = new URLSearchParams('');

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => vi.fn(),
    useSearchParams: () => [searchParamsValue, vi.fn()],
  };
});

const recipe = {
  id: 1,
  name: 'Test Recipe',
  servings: 4,
  instructions: JSON.stringify(['Mix flour and water']),
  ingredients: [
    {
      id: 1,
      recipeId: 1,
      name: 'flour',
      quantity: '2',
      unit: 'cups',
      notes: null,
      position: 0,
      createdAt: '',
    },
  ],
};

vi.mock('@/hooks/recipe/useRecipes', () => ({
  useRecipe: () => ({ data: recipe, isLoading: false, error: null }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<CookingModePage />, { wrapper });
}

describe('CookingModePage serving scale', () => {
  it('scales ingredient quantities using the servings query param', () => {
    // servings=8 with base servings=4 -> multiplier 2 -> flour 2 becomes 4.
    searchParamsValue = new URLSearchParams('servings=8');

    renderPage();

    // The lg sidebar is in the DOM in jsdom regardless of the `hidden lg:block`
    // CSS class, so the scaled quantity is queryable directly.
    expect(screen.getByText('4')).toBeInTheDocument();
    // The un-scaled base amount should NOT appear.
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('shows the base quantity when no servings param is present', () => {
    // No servings param -> multiplier falls back to 1 -> flour stays 2.
    searchParamsValue = new URLSearchParams('');

    renderPage();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('4')).not.toBeInTheDocument();
  });
});

describe('CookingModePage mobile ingredients toggle', () => {
  it('shows a down chevron when collapsed and an up chevron when expanded', async () => {
    searchParamsValue = new URLSearchParams('');
    const user = userEvent.setup();

    renderPage();

    const toggle = screen.getByRole('button', { name: /ingredients/i });

    // Collapsed: affordance points DOWN (tap to expand downward).
    expect(toggle.querySelector('path')?.getAttribute('d')).toBe(
      CHEVRON_DOWN_PATH
    );

    await user.click(toggle);

    // Expanded: affordance points UP (tap to collapse).
    expect(toggle.querySelector('path')?.getAttribute('d')).toBe(
      CHEVRON_UP_PATH
    );
  });
});

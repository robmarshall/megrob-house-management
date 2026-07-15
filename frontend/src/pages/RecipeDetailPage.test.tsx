import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RecipeDetailPage } from './RecipeDetailPage';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<RecipeDetailPage />, { wrapper });
}

const recipe = {
  id: 1,
  name: 'Test Recipe',
  description: 'A tasty test recipe',
  instructions: '[]',
  servings: 4,
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  rating: 0,
  isFavorite: false,
  ingredients: [],
  categories: [],
  notes: undefined,
  sourceUrl: undefined,
  imageUrl: undefined,
};

const addFeedback = vi.fn(() => Promise.resolve());
const deleteFeedback = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/hooks/recipe/useRecipes', () => ({
  useRecipe: () => ({ data: recipe, isLoading: false }),
  useRecipeData: () => ({
    delete: vi.fn(),
    toggleFavorite: vi.fn(),
    edit: vi.fn(),
  }),
}));

vi.mock('@/hooks/recipe/useRecipeFeedback', () => ({
  useRecipeFeedback: () => ({
    data: { likes: 2, dislikes: 1, entries: [] },
    isLoading: false,
  }),
  useRecipeFeedbackMutations: () => ({
    addFeedback,
    deleteFeedback,
    isAdding: false,
    isDeleting: false,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, signOut: vi.fn() }),
}));

describe('RecipeDetailPage feedback thumbs', () => {
  beforeEach(() => {
    addFeedback.mockClear();
  });

  it('records a like when the like thumb is clicked', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: /like \(2\)/i }));

    expect(addFeedback).toHaveBeenCalledTimes(1);
    expect(addFeedback).toHaveBeenCalledWith({ isLike: true });
  });

  it('records a dislike when the dislike thumb is clicked', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: /dislike \(1\)/i }));

    expect(addFeedback).toHaveBeenCalledTimes(1);
    expect(addFeedback).toHaveBeenCalledWith({ isLike: false });
  });
});

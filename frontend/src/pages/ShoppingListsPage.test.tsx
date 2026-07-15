import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ShoppingListsPage } from './ShoppingListsPage';
import type { ShoppingList } from '@/types/shoppingList';

const lists: ShoppingList[] = [
  {
    id: 1,
    name: 'Groceries',
    description: 'Weekly shopping',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  },
  {
    id: 2,
    name: 'Hardware',
    description: 'Home repairs',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  },
];

const goToPage = vi.fn();
const nextPage = vi.fn();
const prevPage = vi.fn();

let mockTotalPages = 3;

vi.mock('@/hooks/shoppingList/useShoppingLists', () => ({
  useShoppingLists: () => ({
    data: lists,
    isLoading: false,
    error: null,
    page: 1,
    get totalPages() {
      return mockTotalPages;
    },
    goToPage,
    nextPage,
    prevPage,
  }),
  useShoppingListData: () => ({
    create: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

describe('ShoppingListsPage', () => {
  it('renders pagination controls and calls goToPage when navigating to the next page', async () => {
    mockTotalPages = 3;
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ShoppingListsPage />
      </MemoryRouter>
    );

    const pagination = screen.getByLabelText('Pagination');
    expect(pagination).toBeInTheDocument();

    await user.click(screen.getByLabelText('Next page'));

    expect(goToPage).toHaveBeenCalledWith(2);
  });

  it('does not render pagination controls when there is only one page', () => {
    mockTotalPages = 1;

    render(
      <MemoryRouter>
        <ShoppingListsPage />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText('Pagination')).not.toBeInTheDocument();
  });
});

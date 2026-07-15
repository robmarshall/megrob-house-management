import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ShoppingListDetailPage } from './ShoppingListDetailPage';
import type { ShoppingList, ShoppingListItem } from '@/types/shoppingList';

const list: ShoppingList = {
  id: 1,
  name: 'Groceries',
  description: 'Weekly shopping',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const items: ShoppingListItem[] = [
  {
    id: 1,
    listId: 1,
    name: 'Milk',
    category: 'dairy',
    quantity: 1,
    unit: 'gallon',
    checked: false,
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  },
  {
    id: 2,
    listId: 1,
    name: 'Bread',
    category: 'bakery',
    quantity: 1,
    unit: undefined,
    checked: false,
    position: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  },
];

const goToPage = vi.fn();
const createItem = vi.fn();
const editItem = vi.fn();
const deleteItem = vi.fn();
const editList = vi.fn();
const deleteList = vi.fn();

let mockTotalPages = 2;

const useShoppingListItems = vi.fn(() => ({
  data: items,
  isLoading: false,
  error: null,
  page: 1,
  get totalPages() {
    return mockTotalPages;
  },
  goToPage,
  nextPage: vi.fn(),
  prevPage: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/hooks/shoppingList/useShoppingListItems', () => ({
  useShoppingListItems: (listId: number, options?: unknown) =>
    useShoppingListItems(listId, options),
  useShoppingListItemData: () => ({
    create: createItem,
    edit: editItem,
    delete: deleteItem,
  }),
}));

vi.mock('@/hooks/shoppingList/useShoppingLists', () => ({
  useShoppingList: () => ({
    data: list,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useShoppingListData: () => ({
    edit: editList,
    delete: deleteList,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

describe('ShoppingListDetailPage', () => {
  beforeEach(() => {
    useShoppingListItems.mockClear();
    goToPage.mockClear();
  });

  it('fetches items with a pageSize large enough to avoid silently truncating a list', () => {
    mockTotalPages = 2;

    render(
      <MemoryRouter>
        <ShoppingListDetailPage />
      </MemoryRouter>
    );

    expect(useShoppingListItems).toHaveBeenCalledTimes(1);
    const [calledListId, calledOptions] = useShoppingListItems.mock.calls[0];
    expect(calledListId).toBe(1);
    expect(calledOptions).toBeDefined();
    expect((calledOptions as { pageSize: number }).pageSize).toBeGreaterThanOrEqual(100);
  });

  it('renders pagination controls when there is more than one page', () => {
    mockTotalPages = 2;

    render(
      <MemoryRouter>
        <ShoppingListDetailPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Pagination')).toBeInTheDocument();
  });

  it('does not render pagination controls when there is only one page', () => {
    mockTotalPages = 1;

    render(
      <MemoryRouter>
        <ShoppingListDetailPage />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText('Pagination')).not.toBeInTheDocument();
  });
});

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
let mockItemsError: Error | null = null;
const refetchItems = vi.fn();

const useShoppingListItems = vi.fn((listId?: number, options?: unknown) => {
  void listId;
  void options;
  return {
    data: mockItemsError ? [] : items,
    isLoading: false,
    get error() {
      return mockItemsError;
    },
    page: 1,
    get totalPages() {
      return mockTotalPages;
    },
    goToPage,
    nextPage: vi.fn(),
    prevPage: vi.fn(),
    refetch: refetchItems,
  };
});

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
    refetchItems.mockClear();
    mockItemsError = null;
  });

  it('fetches items with a large pageSize that stays within the backend cap of 100', () => {
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
    const pageSize = (calledOptions as { pageSize: number }).pageSize;
    // Large enough to avoid silently truncating a typical list, but no larger
    // than the backend's max — a pageSize over 100 gets a 400 response and the
    // whole list rendered as empty.
    expect(pageSize).toBeGreaterThanOrEqual(50);
    expect(pageSize).toBeLessThanOrEqual(100);
  });

  it('shows an error state instead of an empty list when the items fetch fails', () => {
    mockItemsError = new Error('Invalid pageSize parameter');

    render(
      <MemoryRouter>
        <ShoppingListDetailPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Couldn't load items")).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();

    screen.getByText('Try again').click();
    expect(refetchItems).toHaveBeenCalledTimes(1);
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

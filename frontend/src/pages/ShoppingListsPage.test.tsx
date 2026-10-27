import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
const createList = vi.fn();
const navigate = vi.fn();

let mockTotalPages = 3;
let mockLists: ShoppingList[] = lists;

vi.mock('@/hooks/shoppingList/useShoppingLists', () => ({
  useShoppingLists: () => ({
    get data() {
      return mockLists;
    },
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
    create: createList,
    delete: vi.fn(),
  }),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

describe('ShoppingListsPage', () => {
  beforeEach(() => {
    mockLists = lists;
    createList.mockReset();
    navigate.mockReset();
  });

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

  it('creates a list with a default name straight away and opens it ready to add items', async () => {
    mockTotalPages = 1;
    const user = userEvent.setup();
    createList.mockResolvedValue({ ...lists[0], id: 42, name: 'Shopping' });

    render(
      <MemoryRouter>
        <ShoppingListsPage />
      </MemoryRouter>
    );

    await user.click(screen.getByLabelText('New list'));

    // No name form in between: the list is created silently with a default name.
    expect(createList).toHaveBeenCalledTimes(1);
    expect(createList).toHaveBeenCalledWith({ name: 'Shopping' }, { silent: true });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/shopping-lists/42', {
        state: { addItem: true },
      })
    );
  });

  it('offers a New list action in the empty state that creates a list', async () => {
    mockTotalPages = 1;
    mockLists = [];
    const user = userEvent.setup();
    createList.mockResolvedValue({ ...lists[0], id: 7, name: 'Shopping' });

    render(
      <MemoryRouter>
        <ShoppingListsPage />
      </MemoryRouter>
    );

    expect(screen.queryByText('Create Your First List')).not.toBeInTheDocument();
    // Two buttons share the label (empty-state CTA and the floating button); use the text one.
    await user.click(screen.getByText('New list'));

    expect(createList).toHaveBeenCalledWith({ name: 'Shopping' }, { silent: true });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/shopping-lists/7', {
        state: { addItem: true },
      })
    );
  });
});

describe('ShoppingListsPage default list naming', () => {
  beforeEach(() => {
    createList.mockReset();
    navigate.mockReset();
    mockTotalPages = 1;
  });

  it('picks the next free numbered name when "Shopping" already exists', async () => {
    mockLists = [
      { ...lists[0], id: 5, name: 'Shopping' },
      { ...lists[1], id: 6, name: 'Shopping 2' },
    ];
    const user = userEvent.setup();
    createList.mockResolvedValue({ ...lists[0], id: 9, name: 'Shopping 3' });

    render(
      <MemoryRouter>
        <ShoppingListsPage />
      </MemoryRouter>
    );

    await user.click(screen.getByLabelText('New list'));

    expect(createList).toHaveBeenCalledWith({ name: 'Shopping 3' }, { silent: true });
  });
});

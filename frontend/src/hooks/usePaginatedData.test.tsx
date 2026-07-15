import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePaginatedData } from './usePaginatedData';
import { apiGet } from '@/lib/api/client';
import type { PaginatedResponse } from '@/types/api';

// Mock the API client so no real network requests are made.
vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
}));

const mockedApiGet = vi.mocked(apiGet);

interface Item {
  id: number;
}

function makeResponse(page = 1): PaginatedResponse<Item> {
  return {
    data: [{ id: 1 }],
    total: 100,
    page,
    pageSize: 20,
    totalPages: 5,
  };
}

/** Create a fresh QueryClient + wrapper per test (no retries, no caching bleed). */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/** Grab the params object from the most recent apiGet call. */
function lastParams() {
  const call = mockedApiGet.mock.calls.at(-1);
  return call?.[1] as Record<string, unknown> | undefined;
}

describe('usePaginatedData', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
    mockedApiGet.mockResolvedValue(makeResponse());
  });

  it('forwards filter params to apiGet and omits undefined filters', async () => {
    // Mirrors how consumers (e.g. useRecipes) build the options object with
    // extra filter keys spread in beyond page/pageSize.
    const options = {
      page: 1,
      pageSize: 12,
      search: 'pasta',
      dietary: 'vegetarian',
      favorite: 'true',
      cuisine: undefined,
    };
    renderHook(() => usePaginatedData<Item>('recipes', options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockedApiGet).toHaveBeenCalled());

    expect(mockedApiGet).toHaveBeenCalledWith('/api/recipes', expect.any(Object));

    const params = lastParams();
    expect(params).toMatchObject({
      page: 1,
      pageSize: 12,
      search: 'pasta',
      dietary: 'vegetarian',
      favorite: 'true',
    });
    // Undefined filters must NOT be sent.
    expect(params).not.toHaveProperty('cuisine');
  });

  it('includes filter params in the query key so different filters do not collide', async () => {
    // Two hooks with different search terms must issue distinct requests.
    const pastaOptions = { page: 1, search: 'pasta' };
    const pizzaOptions = { page: 1, search: 'pizza' };

    const { unmount } = renderHook(
      () => usePaginatedData<Item>('recipes', pastaOptions),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(mockedApiGet).toHaveBeenCalled());
    unmount();

    renderHook(() => usePaginatedData<Item>('recipes', pizzaOptions), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(
        mockedApiGet.mock.calls.some(
          (c) => (c[1] as Record<string, unknown>)?.search === 'pizza'
        )
      ).toBe(true)
    );

    const searches = mockedApiGet.mock.calls.map(
      (c) => (c[1] as Record<string, unknown>)?.search
    );
    expect(searches).toContain('pasta');
    expect(searches).toContain('pizza');
  });

  it('reacts to controlled options.page changes (controlled mode)', async () => {
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        usePaginatedData<Item>('recipes', { page, pageSize: 12 }),
      { wrapper: createWrapper(), initialProps: { page: 1 } }
    );

    await waitFor(() => expect(lastParams()?.page).toBe(1));
    expect(result.current.page).toBe(1);

    // Consumer navigates to page 2 via options (e.g. URL change).
    rerender({ page: 2 });

    await waitFor(() => expect(lastParams()?.page).toBe(2));
    expect(result.current.page).toBe(2);
  });

  it('updates the requested page via nextPage/prevPage/goToPage (uncontrolled mode)', async () => {
    const { result } = renderHook(
      () => usePaginatedData<Item>('shopping-lists', { pageSize: 20 }),
      { wrapper: createWrapper() }
    );

    // Wait for the request to settle so totalPages (the navigation bound) is known.
    const settled = async () =>
      waitFor(() => expect(result.current.totalPages).toBe(5));

    await waitFor(() => expect(lastParams()?.page).toBe(1));
    expect(result.current.page).toBe(1);
    await settled();

    act(() => result.current.nextPage());
    await waitFor(() => expect(lastParams()?.page).toBe(2));
    expect(result.current.page).toBe(2);
    await settled();

    act(() => result.current.goToPage(4));
    await waitFor(() => expect(lastParams()?.page).toBe(4));
    expect(result.current.page).toBe(4);
    await settled();

    act(() => result.current.prevPage());
    await waitFor(() => expect(lastParams()?.page).toBe(3));
    expect(result.current.page).toBe(3);
  });

  it('does not navigate past the page bounds (uncontrolled mode)', async () => {
    const { result } = renderHook(
      () => usePaginatedData<Item>('shopping-lists'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.totalPages).toBe(5));

    // Already on page 1 -> prevPage is a no-op.
    act(() => result.current.prevPage());
    expect(result.current.page).toBe(1);

    // Cannot jump beyond totalPages.
    act(() => result.current.goToPage(99));
    expect(result.current.page).toBe(1);
  });
});

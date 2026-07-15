import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { collectionLabel, useData } from './useData';
import { apiPatch } from '@/lib/api/client';
import { toast } from '@/lib/toast';

// Mock the API client so no real network requests are made.
vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

// Mock toast so we can spy on success/error calls without touching react-toastify.
vi.mock('@/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockedApiPatch = vi.mocked(apiPatch);
const mockedToastSuccess = vi.mocked(toast.success);

interface Item {
  id: number;
  checked: boolean;
}

/** Create a fresh QueryClient + wrapper per test (no retries, no caching bleed). */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('collectionLabel', () => {
  it('converts a single-segment collection to a space-separated label', () => {
    expect(collectionLabel('shopping-lists')).toBe('shopping lists');
  });

  it('leaves a single-word collection unchanged', () => {
    expect(collectionLabel('recipes')).toBe('recipes');
  });

  it('uses the last segment for a nested collection with a numeric id', () => {
    expect(collectionLabel('shopping-lists/5/items')).toBe('items');
  });

  it('uses the last segment for a different nested collection', () => {
    expect(collectionLabel('recipes/12/feedback')).toBe('feedback');
  });

  it('handles a trailing slash gracefully', () => {
    expect(collectionLabel('shopping-lists/5/items/')).toBe('items');
  });

  it('falls back to the cleaned full collection when there is no usable segment', () => {
    expect(collectionLabel('')).toBe('');
    expect(collectionLabel('5')).toBe('5');
    expect(collectionLabel('5/')).toBe('5/');
  });
});

describe('useData edit silent option', () => {
  beforeEach(() => {
    mockedApiPatch.mockReset();
    mockedApiPatch.mockResolvedValue({ id: 1, checked: true });
    mockedToastSuccess.mockReset();
  });

  it('does not toast on success when called with { silent: true }', async () => {
    const { result } = renderHook(() => useData<Item>('shopping-lists/1/items'), {
      wrapper: createWrapper(),
    });

    await result.current.edit(1, { checked: true }, { silent: true });

    await waitFor(() => expect(mockedApiPatch).toHaveBeenCalled());
    expect(mockedToastSuccess).not.toHaveBeenCalled();
  });

  it('toasts on success when called without options', async () => {
    const { result } = renderHook(() => useData<Item>('shopping-lists/1/items'), {
      wrapper: createWrapper(),
    });

    await result.current.edit(1, { checked: true });

    await waitFor(() => expect(mockedApiPatch).toHaveBeenCalled());
    await waitFor(() => expect(mockedToastSuccess).toHaveBeenCalledTimes(1));
  });
});

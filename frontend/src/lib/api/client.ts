/**
 * API Client - Functional helpers for making HTTP requests
 */

import { supabase } from '../supabaseClient';
import type { ApiError, QueryParams } from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  throw new Error('Missing VITE_API_URL environment variable');
}

/**
 * Get authentication headers with Supabase JWT token
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return headers;
}

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: QueryParams): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Handle API errors and throw formatted error
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = 'An error occurred';
    let errorDetails: unknown;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorDetails = errorData.details;
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }

    const error: ApiError = {
      message: errorMessage,
      status: response.status,
      details: errorDetails,
    };

    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/**
 * Perform a GET request
 */
export async function apiGet<T>(
  endpoint: string,
  params?: QueryParams
): Promise<T> {
  const headers = await getAuthHeaders();
  const url = buildUrl(endpoint, params);

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  return handleResponse<T>(response);
}

/**
 * Perform a POST request
 */
export async function apiPost<T>(
  endpoint: string,
  data: unknown
): Promise<T> {
  const headers = await getAuthHeaders();
  const url = buildUrl(endpoint);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  return handleResponse<T>(response);
}

/**
 * Perform a PATCH request
 */
export async function apiPatch<T>(
  endpoint: string,
  data: unknown
): Promise<T> {
  const headers = await getAuthHeaders();
  const url = buildUrl(endpoint);

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  });

  return handleResponse<T>(response);
}

/**
 * Perform a DELETE request
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  const headers = await getAuthHeaders();
  const url = buildUrl(endpoint);

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  return handleResponse<T>(response);
}

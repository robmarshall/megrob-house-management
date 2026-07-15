import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

// Test double for the /login route: surfaces the `from` path it received via
// location state so the redirect target can be asserted.
function LoginStub() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from
    ?.pathname;
  return <div>redirected-to-login from: {from ?? 'none'}</div>;
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login carrying the attempted path in state.from', () => {
    render(
      <MemoryRouter initialEntries={['/recipes/123']}>
        <Routes>
          <Route
            path="/recipes/123"
            element={
              <ProtectedRoute>
                <div>protected content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginStub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(
      screen.getByText('redirected-to-login from: /recipes/123')
    ).toBeInTheDocument();
  });
});

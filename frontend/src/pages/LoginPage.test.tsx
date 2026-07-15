import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LoginPage } from './LoginPage';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: vi.fn(),
  }),
}));

describe('LoginPage', () => {
  it('shows the success message passed via location state', () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { message: 'Password updated successfully!' } },
        ]}
      >
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Password updated successfully!')).toBeInTheDocument();
  });

  it('renders without a message and without crashing when there is no location state', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(
      screen.queryByText('Password updated successfully!')
    ).not.toBeInTheDocument();
    // The form still renders.
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });
});

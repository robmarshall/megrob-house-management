import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { LoginForm } from './LoginForm';

const signIn = vi.fn();
const navigate = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signIn }),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

async function submitCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Email/), 'user@example.com');
  await user.type(screen.getByLabelText(/Password/), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign In' }));
}

describe('LoginForm return-to redirect', () => {
  beforeEach(() => {
    signIn.mockReset().mockResolvedValue(undefined);
    navigate.mockReset();
  });

  it('redirects to the saved destination after a successful sign-in', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { from: { pathname: '/recipes/123' } } },
        ]}
      >
        <LoginForm />
      </MemoryRouter>
    );

    await submitCredentials();

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/recipes/123', { replace: true });
    });
  });

  it('falls back to / when there is no saved destination', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginForm />
      </MemoryRouter>
    );

    await submitCredentials();

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('falls back to / instead of looping back to /login', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { from: { pathname: '/login' } } },
        ]}
      >
        <LoginForm />
      </MemoryRouter>
    );

    await submitCredentials();

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});

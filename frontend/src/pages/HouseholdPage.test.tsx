import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HouseholdPage } from './HouseholdPage';
import type { HouseholdWithDetails } from '@/types/household';

const mockHousehold: HouseholdWithDetails = {
  id: 1,
  name: 'The Smith Family',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  members: [
    {
      id: 1,
      userId: 'user-1',
      role: 'owner',
      joinedAt: '2026-01-01T00:00:00.000Z',
      userName: 'Alice',
      userEmail: 'alice@example.com',
    },
  ],
  pendingInvitations: [],
};

const updateHousehold = vi.fn().mockResolvedValue({});
let mockIsLoading = false;

vi.mock('@/hooks/household/useHousehold', () => ({
  useHousehold: () => ({ household: mockHousehold, isLoading: false }),
  useHouseholdInvitations: () => ({ invitations: [] }),
  useHouseholdActions: () => ({
    createHousehold: vi.fn(),
    updateHousehold,
    inviteMember: vi.fn(),
    joinHousehold: vi.fn(),
    declineInvitation: vi.fn(),
    removeMember: vi.fn(),
    leaveHousehold: vi.fn(),
    cancelInvitation: vi.fn(),
    get isLoading() {
      return mockIsLoading;
    },
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, signOut: vi.fn() }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <HouseholdPage />
    </MemoryRouter>
  );
}

describe('HouseholdPage - inline name edit', () => {
  beforeEach(() => {
    updateHousehold.mockClear();
    mockIsLoading = false;
  });

  it('rejects a blank name with visible feedback and does not call update', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText('Edit household name'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.click(screen.getByLabelText('Save name'));

    expect(updateHousehold).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  });

  it('rejects a name over 100 characters with visible feedback and does not call update', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText('Edit household name'));
    const input = screen.getByRole('textbox');
    // Bypass the maxLength attribute (which only guards real user typing)
    // to exercise the submit-time length validation.
    fireEvent.change(input, { target: { value: 'a'.repeat(101) } });
    await user.click(screen.getByLabelText('Save name'));

    expect(updateHousehold).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('100 characters or less');
  });

  it('saves a valid trimmed name via the update mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText('Edit household name'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '  New Household Name  ');
    await user.click(screen.getByLabelText('Save name'));

    await waitFor(() =>
      expect(updateHousehold).toHaveBeenCalledWith({ name: 'New Household Name' })
    );
  });

  it('disables the input and save button while the update mutation is in flight', async () => {
    const user = userEvent.setup();
    mockIsLoading = true;
    renderPage();

    await user.click(screen.getByLabelText('Edit household name'));
    const input = screen.getByRole('textbox');
    const saveButton = screen.getByLabelText('Save name');

    expect(input).toBeDisabled();
    expect(saveButton).toBeDisabled();

    await user.click(saveButton);
    expect(updateHousehold).not.toHaveBeenCalled();
  });
});

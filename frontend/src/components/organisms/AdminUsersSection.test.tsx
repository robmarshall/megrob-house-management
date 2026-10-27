import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminUsersSection } from './AdminUsersSection'
import { ApiError } from '@/lib/api/ApiError'

const me = { id: 'user-1', email: 'hello@robertmarshall.dev', name: 'Robert' }

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: me }),
}))

const mockUsers = vi.hoisted(() => ({
  current: null as unknown,
  isLoading: false,
  isError: false,
}))
const mutateAsync = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/admin/useAdminUsers', () => ({
  useAdminUsers: () => ({
    data: mockUsers.current,
    isLoading: mockUsers.isLoading,
    isError: mockUsers.isError,
  }),
  useSetUserPassword: () => ({ mutateAsync, isPending: false }),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}))

const users = [
  { id: 'user-1', name: 'Robert', email: 'hello@robertmarshall.dev', createdAt: '2026-01-01T00:00:00.000Z', isAdmin: true },
  { id: 'user-2', name: 'Meg', email: 'meg@example.com', createdAt: '2026-01-02T00:00:00.000Z', isAdmin: false },
]

async function openResetFor(name: string) {
  await userEvent.click(screen.getByRole('button', { name: `Reset password for ${name}` }))
  return screen.getByRole('dialog')
}

describe('AdminUsersSection', () => {
  beforeEach(() => {
    mockUsers.current = users
    mockUsers.isLoading = false
    mockUsers.isError = false
    mutateAsync.mockReset()
    toastSuccess.mockReset()
  })

  it('renders nothing for a non-admin (hook resolves null)', () => {
    mockUsers.current = null
    const { container } = render(<AdminUsersSection />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists users, marks the current user, and offers reset only for others', () => {
    render(<AdminUsersSection />)
    expect(screen.getByText('(you)')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset password for Meg' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset password for Robert' })).toBeNull()
  })

  it('submits a matching temporary password for the chosen user', async () => {
    mutateAsync.mockResolvedValue({ ok: true })
    render(<AdminUsersSection />)

    const dialog = await openResetFor('Meg')
    expect(dialog).toHaveTextContent('meg@example.com')

    await userEvent.type(screen.getByLabelText(/^Temporary password/), 'letmein1')
    await userEvent.type(screen.getByLabelText(/^Confirm temporary password/), 'letmein1')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ userId: 'user-2', newPassword: 'letmein1' })
    )
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('blocks submit when the confirmation does not match', async () => {
    render(<AdminUsersSection />)
    await openResetFor('Meg')

    await userEvent.type(screen.getByLabelText(/^Temporary password/), 'letmein1')
    await userEvent.type(screen.getByLabelText(/^Confirm temporary password/), 'different')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('shows the server error when the reset is refused', async () => {
    mutateAsync.mockRejectedValue(new ApiError('User not found', 404))
    render(<AdminUsersSection />)
    await openResetFor('Meg')

    await userEvent.type(screen.getByLabelText(/^Temporary password/), 'letmein1')
    await userEvent.type(screen.getByLabelText(/^Confirm temporary password/), 'letmein1')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('User not found')).toBeInTheDocument()
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})

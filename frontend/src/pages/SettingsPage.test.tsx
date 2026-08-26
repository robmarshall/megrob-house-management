import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { SettingsPage } from './SettingsPage'

const user = {
  id: 'user-1',
  email: 'hello@robertmarshall.dev',
  name: 'Robert',
  createdAt: '2026-01-01T00:00:00.000Z',
}

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user,
    signOut: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  }),
}))

// NutritionProfileSection uses TanStack Query hooks; mock them so the page
// renders without a QueryClientProvider.
vi.mock('@/hooks/nutrition/useNutritionProfile', () => ({
  useNutritionProfile: () => ({ data: null, isLoading: false, error: null }),
  useSaveNutritionProfile: () => ({ save: vi.fn(), isSaving: false }),
}))

// SettingsPage reads the notification settings to decide whether to show the
// admin tabs. Mocked for the same reason, and defaulting to null (= not an
// admin) so the Account sections render directly, as they did before tabs.
const mockNotificationSettings = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('@/hooks/notifications/useNotificationSettings', () => ({
  useNotificationSettings: () => ({
    data: mockNotificationSettings.current,
    isLoading: false,
  }),
  useSaveNotificationSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendTestNotification: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/snozone/useSnozoneStatus', () => ({
  useSnozoneStatus: () => ({ data: null, isLoading: false, isError: false }),
}))

function spyOnStorageSetItem() {
  return vi.spyOn(Storage.prototype, 'setItem')
}

describe('SettingsPage - theme preference (App Settings section)', () => {
  let setItemSpy: ReturnType<typeof spyOnStorageSetItem>

  beforeEach(() => {
    setItemSpy = spyOnStorageSetItem()
  })

  afterEach(() => {
    setItemSpy.mockRestore()
  })

  it('shows the theme control as disabled with a "Coming soon" indicator', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Coming soon')).toBeInTheDocument()

    const lightOption = screen.getByRole('button', { name: /Light/ })
    const darkOption = screen.getByRole('button', { name: /Dark/ })
    const systemOption = screen.getByRole('button', { name: /System/ })

    expect(lightOption).toBeDisabled()
    expect(darkOption).toBeDisabled()
    expect(systemOption).toBeDisabled()
  })

  it('does not persist a theme preference to localStorage when clicked', async () => {
    const userEventInstance = userEvent.setup()

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const darkOption = screen.getByRole('button', { name: /Dark/ })
    await userEventInstance.click(darkOption)

    const themeWrites = setItemSpy.mock.calls.filter(
      (call) => call[0] === 'theme-preference'
    )
    expect(themeWrites).toHaveLength(0)
  })
})

describe('SettingsPage - admin tabs', () => {
  afterEach(() => {
    mockNotificationSettings.current = null
  })

  it('shows no tab strip for a non-admin', () => {
    // The API is the real gate; this just avoids offering tabs that would only
    // ever render an error.
    mockNotificationSettings.current = null
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )
    expect(screen.queryByRole('navigation', { name: /settings sections/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Snozone' })).toBeNull()
  })

  it('shows Notifications and Snozone tabs for an admin', () => {
    mockNotificationSettings.current = { telegramEnabled: false, encryptionConfigured: true }
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )
    expect(screen.getByRole('navigation', { name: /settings sections/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Snozone' })).toBeInTheDocument()
  })

  it('switches to the Snozone tab when clicked', async () => {
    mockNotificationSettings.current = { telegramEnabled: false, encryptionConfigured: true }
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Snozone' }))
    expect(
      screen.getByRole('heading', { name: /snozone availability collector/i })
    ).toBeInTheDocument()
    // Account content is replaced, not merely hidden.
    expect(screen.queryByRole('heading', { name: 'App Settings' })).toBeNull()
  })
})

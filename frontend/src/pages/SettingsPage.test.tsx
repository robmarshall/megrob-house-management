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

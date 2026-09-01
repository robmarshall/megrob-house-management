import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { SnozonePage } from './SnozonePage'

// SnozoneBookTab has its own hook-driven tests; here we only care that the
// page wires up the tab strip correctly.
vi.mock('@/components/organisms/SnozoneBookTab', () => ({
  SnozoneBookTab: () => <div data-testid="book-tab">Book tab content</div>,
}))

// Likewise SnozonePatternsTab: it fetches four analytics of its own and is
// tested against them separately. This file is only about the tab strip.
vi.mock('@/components/organisms/SnozonePatternsTab', () => ({
  SnozonePatternsTab: () => <div data-testid="patterns-tab">Patterns tab content</div>,
}))

// MainLayout renders AppHeader, which needs an authenticated user.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}))

describe('SnozonePage', () => {
  it('shows the Book tab by default', () => {
    render(
      <MemoryRouter>
        <SnozonePage />
      </MemoryRouter>
    )
    expect(screen.getByTestId('book-tab')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book' })).toHaveAttribute('aria-current', 'page')
  })

  it('switches to the Patterns tab when clicked, replacing the Book content', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SnozonePage />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: 'Patterns' }))

    expect(screen.queryByTestId('book-tab')).not.toBeInTheDocument()
    expect(screen.getByTestId('patterns-tab')).toBeInTheDocument()
  })
})

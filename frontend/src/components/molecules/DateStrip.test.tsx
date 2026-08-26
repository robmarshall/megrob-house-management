import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateStrip } from './DateStrip'
import type { SnozoneDayResponse } from '@/types/snozone'

function day(peakOnSlope: number, capacity: number): SnozoneDayResponse {
  return {
    date: '2026-08-27',
    observedAt: '2026-08-25T09:00:00.000Z',
    isStale: false,
    slots: [],
    summary: { total: 0, available: 0, capacity, peakOnSlope },
  }
}

describe('DateStrip', () => {
  it('renders one button per date and calls onSelect', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <DateStrip
        items={[
          { date: '2026-08-27', day: day(10, 80), isLoading: false },
          { date: '2026-08-28', day: day(70, 80), isLoading: false },
        ]}
        selected="2026-08-27"
        onSelect={onSelect}
      />
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false')

    await user.click(buttons[1])
    expect(onSelect).toHaveBeenCalledWith('2026-08-28')
  })

  it('shows a "no data yet" busyness state when the day has no capacity data', () => {
    render(
      <DateStrip
        items={[{ date: '2026-08-27', day: null, isLoading: false }]}
        selected={null}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByRole('button').getAttribute('aria-label')).not.toMatch(/% of capacity/)
  })

  it('includes the busyness percentage in the accessible label when data is present', () => {
    render(
      <DateStrip
        items={[{ date: '2026-08-27', day: day(40, 80), isLoading: false }]}
        selected={null}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/50% of capacity so far/)
  })
})

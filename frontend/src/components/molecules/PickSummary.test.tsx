import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PickSummary } from './PickSummary'
import type { SnozonePick } from '@/types/snozone'

const pick: SnozonePick = {
  time: '18:55',
  label: '18:55',
  presenceFrom: '18:40',
  presenceTo: '20:05',
  avgOnSlope: 42,
  peakOnSlope: 48,
  capacity: 80,
  coverage: 1,
}

describe('PickSummary', () => {
  it('shows the confident pick as one prominent line with average/peak', () => {
    render(
      <PickSummary
        pick={pick}
        confidence="good"
        note={null}
        showHonestyBand={false}
        isLoading={false}
      />
    )
    expect(screen.getByText(/Book 18:55/)).toBeInTheDocument()
    expect(screen.getByText(/18:40–20:05/)).toBeInTheDocument()
    expect(screen.getByText(/Average 42/)).toBeInTheDocument()
    expect(screen.getByText(/peak 48/)).toBeInTheDocument()
  })

  it('shows the honesty band and API note instead of a confident pick when confidence is thin', () => {
    render(
      <PickSummary
        pick={pick}
        confidence="thin"
        note="Only 3 bookings so far for this date — treat this as a rough guide."
        showHonestyBand
        isLoading={false}
      />
    )
    expect(
      screen.getByText('Only 3 bookings so far for this date — treat this as a rough guide.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Book 18:55/)).not.toBeInTheDocument()
  })

  it('falls back to a generic honesty message when the API gives no note', () => {
    render(
      <PickSummary pick={null} confidence="none" note={null} showHonestyBand isLoading={false} />
    )
    expect(
      screen.getByText('Not enough bookings yet to recommend a time for this date.')
    ).toBeInTheDocument()
  })

  it('renders a loading skeleton while the recommendation is in flight', () => {
    const { container } = render(
      <PickSummary pick={null} confidence={null} note={null} showHonestyBand={false} isLoading />
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

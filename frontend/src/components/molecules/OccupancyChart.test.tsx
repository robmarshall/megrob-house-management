import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OccupancyChart } from './OccupancyChart'
import type { SnozoneSlot } from '@/types/snozone'

function slot(overrides: Partial<SnozoneSlot> & { time: string }): SnozoneSlot {
  return {
    label: overrides.time,
    starting: 0,
    fromPrior: 0,
    onSlope: 0,
    qtyAvailable: 0,
    totalQty: 20,
    available: false,
    soldOut: false,
    blocked: false,
    lowAvailability: false,
    callToBook: false,
    reason: null,
    price: null,
    slotType: null,
    experience: null,
    observedAt: '2026-08-25T09:00:00.000Z',
    expired: false,
    full: false,
    ...overrides,
  }
}

// idx0 is expired with a corrupted (inflated) reading — should be excluded
// from the "busiest bookable" headline and from the axis max.
const points: SnozoneSlot[] = [
  slot({ time: '09:00', onSlope: 50, expired: true }),
  slot({ time: '09:05', onSlope: 10, available: true, qtyAvailable: 3 }),
  slot({ time: '09:10', onSlope: 8, soldOut: true }),
  slot({ time: '09:15', onSlope: 20, full: true }),
]

describe('OccupancyChart', () => {
  it('renders nothing with fewer than 2 points', () => {
    const { container } = render(<OccupancyChart points={[points[0]]} capacity={20} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the accessible title and description', () => {
    render(<OccupancyChart points={points} capacity={20} />)
    expect(screen.getByText('People on the slope through the day')).toBeInTheDocument()
  })

  it('excludes an expired (corrupted) reading from the "busiest bookable" headline', () => {
    render(<OccupancyChart points={points} capacity={20} />)
    // The expired 09:00 reading of 50 must not win, even though it's the
    // largest raw number in the data.
    expect(screen.getByText(/busiest bookable 09:15 · 20 of 20/)).toBeInTheDocument()
  })

  it('never labels a soldOut slot as "full", and reports the real full slot as full', () => {
    render(<OccupancyChart points={points} capacity={20} />)
    const slider = screen.getByRole('slider')

    // default focus lands on the first (expired) point
    fireEvent.focus(slider)
    expect(screen.getByText(/reading unreliable/)).toBeInTheDocument()

    // move to the soldOut slot (index 2)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(screen.getByText('not bookable')).toBeInTheDocument()
    expect(screen.queryByText('full')).not.toBeInTheDocument()

    // move to the actually-full slot (index 3)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(screen.getByText('full')).toBeInTheDocument()
  })

  it('supports Home/End keyboard navigation', () => {
    render(<OccupancyChart points={points} capacity={20} />)
    const slider = screen.getByRole('slider')
    fireEvent.focus(slider)
    fireEvent.keyDown(slider, { key: 'End' })
    expect(screen.getByRole('status').textContent).toContain('09:15')
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(screen.getByText(/reading unreliable/)).toBeInTheDocument()
  })

  it('draws the pick ring and label when a highlight matches a point', () => {
    render(
      <OccupancyChart
        points={points}
        capacity={20}
        highlight={{ time: '09:15', label: 'Book 09:15 · on the slope 09:00–10:15' }}
        bands={{ presence: { from: '09:00', to: '10:15' }, session: { from: '09:15', to: '10:15' } }}
      />
    )
    expect(screen.getByText('Book 09:15 · on the slope 09:00–10:15')).toBeInTheDocument()
  })
})

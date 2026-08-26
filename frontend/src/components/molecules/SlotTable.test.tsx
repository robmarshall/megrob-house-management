import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SlotTable } from './SlotTable'
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

describe('SlotTable', () => {
  it('shows an empty state with no slots', () => {
    render(<SlotTable slots={[]} />)
    expect(screen.getByText('No slots for this date.')).toBeInTheDocument()
  })

  it('never renders a soldOut slot as "full"', () => {
    render(<SlotTable slots={[slot({ time: '09:00', onSlope: 40, soldOut: true, totalQty: 80 })]} />)
    const row = screen.getByText('09:00').closest('tr')!
    expect(within(row).queryByText(/full/i)).not.toBeInTheDocument()
  })

  it('labels a genuinely full slot (onSlope >= totalQty) as full, distinct from soldOut', () => {
    render(<SlotTable slots={[slot({ time: '09:00', onSlope: 80, totalQty: 80, full: true })]} />)
    const row = screen.getByText('09:00').closest('tr')!
    expect(within(row).getByText('full')).toBeInTheDocument()
  })

  it('shows places left for an available slot', () => {
    render(
      <SlotTable
        slots={[slot({ time: '09:00', onSlope: 5, available: true, qtyAvailable: 12 })]}
      />
    )
    expect(screen.getByText('12 left')).toBeInTheDocument()
  })

  it('marks the pick row', () => {
    render(
      <SlotTable
        slots={[slot({ time: '09:00' }), slot({ time: '09:05' })]}
        highlightTime="09:05"
      />
    )
    const [, firstDataRow, secondDataRow] = screen.getAllByRole('row')
    expect(within(firstDataRow).queryByText('Pick')).not.toBeInTheDocument()
    expect(within(secondDataRow).getByText('Pick')).toBeInTheDocument()
  })

  it('de-emphasises expired rows', () => {
    render(<SlotTable slots={[slot({ time: '09:00', expired: true })]} />)
    const row = screen.getByText('09:00').closest('tr')!
    expect(row.className).toContain('opacity-50')
    expect(screen.getByText('already passed')).toBeInTheDocument()
  })
})

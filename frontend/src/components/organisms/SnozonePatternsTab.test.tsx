import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SnozonePatternsTab } from './SnozonePatternsTab'
import type {
  SnozoneBusynessResponse,
  SnozoneBookingTimesResponse,
  SnozoneLeadTimesResponse,
  SnozoneTrendResponse,
} from '@/types/snozone'

/**
 * The Patterns tab's job is restraint: it must render a chart only when the
 * server says the data supports one, and must never let "closed" and "not
 * collected yet" collapse into the same blank cell (frontend plan §5, §5.1).
 * Both are tested here because both fail silently — a wrong chart looks exactly
 * like a right one.
 */

const busyness = vi.fn()
const bookingTimes = vi.fn()
const leadTimes = vi.fn()
const trend = vi.fn()
const collectedDates = vi.fn()
const fillCurve = vi.fn()
const snozoneDay = vi.fn()

vi.mock('@/hooks/snozone/useSnozoneAnalytics', () => ({
  useSnozoneBusyness: () => busyness(),
  useSnozoneBookingTimes: () => bookingTimes(),
  useSnozoneLeadTimes: () => leadTimes(),
  useSnozoneTrend: () => trend(),
  useSnozoneCollectedDates: () => collectedDates(),
  useSnozoneFillCurve: () => fillCurve(),
}))

vi.mock('@/hooks/snozone/useSnozoneDay', () => ({
  useSnozoneDay: () => snozoneDay(),
}))

const RANGE = { from: '2026-08-01', to: '2026-09-01' }

function loaded<T>(data: T) {
  return { data, isLoading: false, isError: false }
}

/**
 * Wednesday closes at 20:00 and Friday at 21:00 — the real timetable
 * variation. Monday has no dates at all.
 */
function busynessFixture(ready: boolean): SnozoneBusynessResponse {
  return {
    range: RANGE,
    cells: [
      { dow: 3, slotTime: '19:00', samples: 6, medianOnSlope: 40, medianFill: 0.5 },
      { dow: 3, slotTime: '19:30', samples: 6, medianOnSlope: 60, medianFill: 0.75 },
      { dow: 5, slotTime: '19:00', samples: 6, medianOnSlope: 30, medianFill: 0.38 },
      { dow: 5, slotTime: '20:00', samples: 6, medianOnSlope: 20, medianFill: 0.25 },
    ],
    datesPerDow: [
      { dow: 3, dates: 6 },
      { dow: 5, dates: 6 },
    ],
    maturity: { needs: 6, have: ready ? 6 : 1, unit: 'samples for the least-covered weekday', ready },
  }
}

beforeEach(() => {
  busyness.mockReturnValue(loaded(busynessFixture(true)))
  bookingTimes.mockReturnValue(
    loaded<SnozoneBookingTimesResponse>({
      range: RANGE,
      cells: [{ dow: 3, hour: 19, bookings: 12, events: 5 }],
      totalBookings: 12,
      excludedWideBracket: 4,
      days: 20,
      maturity: { needs: 14, have: 20, unit: 'days of booking events', ready: true },
    })
  )
  leadTimes.mockReturnValue(
    loaded<SnozoneLeadTimesResponse>({
      range: RANGE,
      buckets: [
        { fromMinutes: 0, toMinutes: 60, label: 'Under 1h', bookings: 3, events: 3 },
        { fromMinutes: 60, toMinutes: 180, label: '1-3h', bookings: 9, events: 6 },
      ],
      totalBookings: 12,
      observableLeadDays: 9,
      maturity: { needs: 200, have: 400, unit: 'booking events', ready: true },
    })
  )
  trend.mockReturnValue(
    loaded<SnozoneTrendResponse>({
      range: RANGE,
      weeks: [
        {
          weekStart: '2026-08-24', dates: 7, openSlots: 850, totalStarting: 340,
          startingPerOpenSlot: 0.4, peakOnSlope: 78, meanFill: 0.42,
        },
      ],
      slotTypes: [{ slotType: 'Off Peak', slots: 500, meanOnSlope: 30 }],
      maturity: { needs: 4, have: 6, unit: 'weeks', ready: true },
    })
  )
  collectedDates.mockReturnValue(
    loaded({ dates: [{ sessionDate: '2026-08-31', dow: 1 }, { sessionDate: '2026-08-24', dow: 1 }] })
  )
  snozoneDay.mockReturnValue(
    loaded({
      slots: [
        { time: '18:00', onSlope: 20 },
        { time: '19:00', onSlope: 65 },
        { time: '20:00', onSlope: 10 },
      ],
    })
  )
  fillCurve.mockReturnValue(
    loaded({
      date: '2026-08-31',
      slotTime: '19:00',
      series: [
        {
          sessionDate: '2026-08-31', isTarget: true, totalQty: 80,
          firstSeenHoursBefore: 48, firstSeenOnSlope: 24,
          points: [
            { hoursBefore: 48, observedAt: '2026-08-29T18:00:00Z', onSlope: 24, starting: 4 },
            { hoursBefore: 2, observedAt: '2026-08-31T16:00:00Z', onSlope: 69, starting: 9 },
          ],
        },
        {
          sessionDate: '2026-08-24', isTarget: false, totalQty: 80,
          firstSeenHoursBefore: 48, firstSeenOnSlope: 0,
          points: [
            { hoursBefore: 48, observedAt: '2026-08-22T18:00:00Z', onSlope: 0, starting: 0 },
            { hoursBefore: 2, observedAt: '2026-08-24T16:00:00Z', onSlope: 40, starting: 5 },
          ],
        },
      ],
      maturity: { needs: 1, have: 2, unit: 'slots watched from first listing to start', ready: true },
    })
  )
})

describe('SnozonePatternsTab', () => {
  it('renders the busyness heatmap once the server says it is ready', () => {
    render(<SnozonePatternsTab />)
    expect(
      screen.getByRole('table', { name: /headcount on the slope by weekday and hour/i })
    ).toBeInTheDocument()
  })

  it('tells a closed hour apart from a weekday it has never collected', () => {
    render(<SnozonePatternsTab />)
    const table = screen.getByRole('table', {
      name: /headcount on the slope by weekday and hour/i,
    })

    // Wednesday shuts before 20:00 while Friday is still open, so Wednesday's
    // 20:00 is CLOSED — a fact, not an absence. Reading it as "quiet" would be
    // exactly backwards.
    const wed = within(table).getByRole('row', { name: /^Wed/ })
    expect(within(wed).getByText(/20:00 — closed/)).toBeInTheDocument()

    // Monday has no dates at all, which is a different claim entirely.
    const mon = within(table).getByRole('row', { name: /^Mon/ })
    expect(within(mon).getByText(/19:00 — not collected yet/)).toBeInTheDocument()
  })

  it('shows an honest empty state instead of a thin heatmap', () => {
    busyness.mockReturnValue(loaded(busynessFixture(false)))
    render(<SnozonePatternsTab />)

    expect(
      screen.queryByRole('table', { name: /headcount on the slope by weekday and hour/i })
    ).not.toBeInTheDocument()
    expect(screen.getByText(/1 of 6 samples for the least-covered weekday/i)).toBeInTheDocument()
  })

  it('says how many bookings were too coarsely timed to place in an hour', () => {
    render(<SnozonePatternsTab />)
    expect(screen.getByText(/4 further bookings are known only to within a day/i))
      .toBeInTheDocument()
  })

  it('states the lead-time truncation rather than implying a real tail', () => {
    render(<SnozonePatternsTab />)
    expect(screen.getByText(/truncated at about 9 days/i)).toBeInTheDocument()
  })

  it('reports the trend per open slot, not as a raw weekly total', () => {
    render(<SnozonePatternsTab />)
    // 340 bookings over 850 open slots. Showing 340 would make a long week
    // look like a busy one.
    expect(screen.getByText('0.40')).toBeInTheDocument()
    expect(screen.queryByText('340')).not.toBeInTheDocument()
  })

  it('defaults the fill curve to the busiest slot of the latest date', () => {
    render(<SnozonePatternsTab />)
    // 19:00 is the busiest of the three; opening on the first slot instead
    // would show a slot nobody books.
    const slotSelect = screen.getByLabelText('Slot') as HTMLSelectElement
    expect(slotSelect.value).toBe('19:00')
  })

  it('renders the target curve and ghosts the prior same-weekday date', () => {
    render(<SnozonePatternsTab />)
    const table = screen.getByRole('table', {
      name: /occupancy of the 19:00 slot by hours before it started/i,
    })
    expect(within(table).getAllByRole('row', { name: /2026-08-31/ })).toHaveLength(2)
    expect(within(table).getAllByRole('row', { name: /2026-08-24/ })).toHaveLength(2)
  })

  it('says what was already booked before the curve begins', () => {
    render(<SnozonePatternsTab />)
    // Without this, a curve opening at 24 reads as "24 people arrived at once"
    // rather than "that is when the collector first looked".
    expect(
      screen.getByText(/24 were already on the slope when this slot was first seen/i)
    ).toBeInTheDocument()
  })

  it('gates the fill curve on a full lifecycle like every other chart', () => {
    fillCurve.mockReturnValue(
      loaded({
        date: '2026-08-31', slotTime: '19:00', series: [],
        maturity: {
          needs: 1, have: 0,
          unit: 'slots watched from first listing to start', ready: false,
        },
      })
    )
    render(<SnozonePatternsTab />)
    expect(
      screen.queryByRole('table', { name: /occupancy of the 19:00 slot/i })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/0 of 1 slots watched from first listing to start/i)
    ).toBeInTheDocument()
  })

  it('surfaces a failure rather than rendering empty charts', () => {
    busyness.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<SnozonePatternsTab />)
    expect(screen.getByText(/could not load snozone patterns/i)).toBeInTheDocument()
  })
})

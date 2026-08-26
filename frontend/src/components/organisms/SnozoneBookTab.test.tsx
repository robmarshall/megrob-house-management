import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SnozoneBookTab } from './SnozoneBookTab'
import type {
  SnozoneDatesResponse,
  SnozoneDayResponse,
  SnozoneRecommendResponse,
  SnozoneConfidence,
  SnozonePick,
  SnozoneSlot,
} from '@/types/snozone'

const mockDates = vi.hoisted(() => ({
  current: { data: undefined as SnozoneDatesResponse | undefined, isLoading: true, isError: false },
}))
const mockDay = vi.hoisted(() => ({
  current: {
    data: undefined as SnozoneDayResponse | undefined,
    isLoading: true,
    isError: false,
  },
}))
const mockDays = vi.hoisted(() => ({
  current: [] as { data: SnozoneDayResponse | undefined; isLoading: boolean }[],
}))
const mockRecommend = vi.hoisted(() => ({
  current: {
    data: undefined as SnozoneRecommendResponse | undefined,
    isLoading: true,
  },
}))

vi.mock('@/hooks/snozone/useSnozoneDates', () => ({
  useSnozoneDates: () => mockDates.current,
}))
vi.mock('@/hooks/snozone/useSnozoneDay', () => ({
  useSnozoneDay: () => mockDay.current,
  useSnozoneDays: () => mockDays.current,
}))
vi.mock('@/hooks/snozone/useSnozoneRecommend', () => ({
  useSnozoneRecommend: () => mockRecommend.current,
}))

function slot(time: string, onSlope: number): SnozoneSlot {
  return {
    time,
    label: time,
    starting: 2,
    fromPrior: onSlope - 2,
    onSlope,
    qtyAvailable: 4,
    totalQty: 80,
    available: true,
    soldOut: false,
    blocked: false,
    lowAvailability: false,
    callToBook: false,
    reason: null,
    price: '£20',
    slotType: null,
    experience: null,
    observedAt: '2026-08-25T09:00:00.000Z',
    expired: false,
    full: false,
  }
}

function makeDay(date: string): SnozoneDayResponse {
  return {
    date,
    observedAt: '2026-08-25T09:00:00.000Z',
    isStale: false,
    slots: [slot('18:40', 30), slot('18:45', 35), slot('18:50', 40), slot('18:55', 48)],
    summary: { total: 4, available: 4, capacity: 80, peakOnSlope: 48 },
  }
}

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

function makeRecommend(
  confidence: SnozoneConfidence,
  note: string | null,
  pickValue: SnozonePick | null
): SnozoneRecommendResponse {
  return {
    date: '2026-08-25',
    params: { after: '16:00', session: 60, early: 15, stay: 10 },
    pick: pickValue,
    ranked: pickValue ? [pickValue] : [],
    confidence,
    note,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 25)) // 25 Aug 2026, local midnight-ish
})

afterEach(() => {
  vi.useRealTimers()
  mockDates.current = { data: undefined, isLoading: true, isError: false }
  mockDay.current = { data: undefined, isLoading: true, isError: false }
  mockDays.current = []
  mockRecommend.current = { data: undefined, isLoading: true }
})

describe('SnozoneBookTab', () => {
  it('shows a loading skeleton while dates are loading', () => {
    const { container } = render(<SnozoneBookTab />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /bookable dates/i })).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no bookable dates', () => {
    mockDates.current = { data: { dates: [], lastRunAt: null }, isLoading: false, isError: false }
    render(<SnozoneBookTab />)
    expect(screen.getByText(/No bookable dates yet/)).toBeInTheDocument()
  })

  it('shows the confident pick, chart and table for a near, well-supported date', () => {
    const day = makeDay('2026-08-25')
    mockDates.current = {
      data: { dates: ['2026-08-25'], lastRunAt: '2026-08-25T09:00:00.000Z' },
      isLoading: false,
      isError: false,
    }
    mockDays.current = [{ data: day, isLoading: false }]
    mockDay.current = { data: day, isLoading: false, isError: false }
    mockRecommend.current = { data: makeRecommend('good', null, pick), isLoading: false }

    render(<SnozoneBookTab />)

    // "Book 18:55" appears twice by design: once as the headline pick, once
    // as the chart's ring annotation.
    expect(screen.getAllByText(/Book 18:55/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('slider')).toBeInTheDocument() // the chart's crosshair
    expect(screen.getByText('Pick')).toBeInTheDocument() // the slot table marks the same row
  })

  it('shows the honesty band instead of a confident pick when confidence is thin', () => {
    const day = makeDay('2026-08-25')
    mockDates.current = {
      data: { dates: ['2026-08-25'], lastRunAt: '2026-08-25T09:00:00.000Z' },
      isLoading: false,
      isError: false,
    }
    mockDays.current = [{ data: day, isLoading: false }]
    mockDay.current = { data: day, isLoading: false, isError: false }
    mockRecommend.current = {
      data: makeRecommend('thin', 'Only a few bookings so far for this date.', pick),
      isLoading: false,
    }

    render(<SnozoneBookTab />)

    expect(screen.getByText('Only a few bookings so far for this date.')).toBeInTheDocument()
    expect(screen.queryByText(/^Book 18:55/)).not.toBeInTheDocument()
  })

  it('trusts the API on a far-out date the API considers good', () => {
    // The API owns this judgement, and it already refuses to say "good" for a
    // distant date unless real bookings exist (it returns 'none' when lead time
    // is high AND occupancy is negligible). Re-deriving "more than two days
    // out" here from the browser clock would suppress a recommendation in
    // exactly the case where a far-out date IS informative — and would be wrong
    // for anyone not in UK time.
    const day = makeDay('2026-08-30')
    mockDates.current = {
      data: { dates: ['2026-08-30'], lastRunAt: '2026-08-25T09:00:00.000Z' },
      isLoading: false,
      isError: false,
    }
    mockDays.current = [{ data: day, isLoading: false }]
    mockDay.current = { data: day, isLoading: false, isError: false }
    mockRecommend.current = { data: makeRecommend('good', null, pick), isLoading: false }

    render(<SnozoneBookTab />)

    // The pick appears in more than one place (headline and slot badge).
    expect(screen.getAllByText(/^Book 18:55/).length).toBeGreaterThan(0)
    expect(
      screen.queryByText('Not enough bookings yet to recommend a time for this date.')
    ).not.toBeInTheDocument()
  })

  it('surfaces the API note rather than a generic message when confidence is none', () => {
    // The note explains itself ("This date is 5 days out. Snozone only shows
    // bookings made so far..."), which is more use than a fixed string.
    const day = makeDay('2026-08-30')
    const note =
      'This date is 5 days out. Snozone only shows bookings made so far, not expected attendance.'
    mockDates.current = {
      data: { dates: ['2026-08-30'], lastRunAt: '2026-08-25T09:00:00.000Z' },
      isLoading: false,
      isError: false,
    }
    mockDays.current = [{ data: day, isLoading: false }]
    mockDay.current = { data: day, isLoading: false, isError: false }
    mockRecommend.current = { data: makeRecommend('none', note, pick), isLoading: false }

    render(<SnozoneBookTab />)

    expect(screen.getByText(note)).toBeInTheDocument()
    expect(screen.queryByText(/^Book 18:55/)).not.toBeInTheDocument()
  })
})

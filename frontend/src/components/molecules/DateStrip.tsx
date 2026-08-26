import { cn } from '@/lib/utils'
import type { SnozoneDayResponse } from '@/types/snozone'

/**
 * The next ~7 bookable dates, each with a one-glance busyness indicator (peak
 * on slope vs capacity) and a tiny sparkline of the day's shape — both read
 * from the same per-date `SnozoneDayResponse` the Book page already fetches
 * for the chart, so the strip costs no extra requests.
 *
 * Horizontally scrollable in its own container (never the page) per the
 * mobile-first chart guidance.
 */
export interface DateStripItem {
  date: string
  day: SnozoneDayResponse | null
  isLoading: boolean
}

export interface DateStripProps {
  items: DateStripItem[]
  selected: string | null
  onSelect: (date: string) => void
  className?: string
}

/** Parse a 'YYYY-MM-DD' string as a local calendar date, never through a
 * timezone-sensitive `new Date(string)` parse (which reads it as UTC
 * midnight and can shift a day west of UTC). */
function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function busynessTone(fraction: number | null): { tone: 'low' | 'mid' | 'high' | 'none'; text: string } {
  if (fraction === null) return { tone: 'none', text: 'no data yet' }
  if (fraction < 0.4) return { tone: 'low', text: 'quiet so far' }
  if (fraction < 0.75) return { tone: 'mid', text: 'busy so far' }
  return { tone: 'high', text: 'very busy so far' }
}

function Sparkline({ day }: { day: SnozoneDayResponse }) {
  const pts = day.slots.filter((s) => !s.expired)
  if (pts.length < 2) return null
  const max = Math.max(...pts.map((p) => p.onSlope), 1)
  const w = 100
  const h = 24
  const path = pts
    .map((p, i) => {
      const px = (i / (pts.length - 1)) * w
      const py = h - (p.onSlope / max) * h
      return `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-5 w-full" aria-hidden="true">
      <path d={path} fill="none" strokeWidth={1.5} className="stroke-current" />
    </svg>
  )
}

export function DateStrip({ items, selected, onSelect, className }: DateStripProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <div role="group" aria-label="Bookable dates" className="flex gap-2 pb-1">
        {items.map(({ date, day, isLoading }) => {
          const isSelected = date === selected
          const fraction =
            day && day.summary.capacity > 0 && day.summary.peakOnSlope !== null
              ? day.summary.peakOnSlope / day.summary.capacity
              : null
          const busy = busynessTone(fraction)
          const d = parseLocalDate(date)
          const weekday = d.toLocaleDateString(undefined, { weekday: 'short' })
          const dayNum = d.toLocaleDateString(undefined, { day: 'numeric' })
          const month = d.toLocaleDateString(undefined, { month: 'short' })

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${weekday} ${dayNum} ${month}${
                fraction !== null ? `, ${Math.round(fraction * 100)}% of capacity so far` : ''
              }`}
              className={cn(
                'flex w-[4.5rem] flex-none flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors',
                isSelected
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {weekday}
              </span>
              <span className="text-base font-semibold tabular-nums text-gray-900">{dayNum}</span>
              <span className="text-[10px] text-gray-400">{month}</span>

              <span
                className={cn(
                  'mt-1 h-1.5 w-full rounded-full',
                  busy.tone === 'low' && 'bg-green-500',
                  busy.tone === 'mid' && 'bg-amber-500',
                  busy.tone === 'high' && 'bg-red-500',
                  busy.tone === 'none' && 'bg-gray-200'
                )}
                title={busy.text}
              />

              <span
                className={cn(
                  'w-full',
                  busy.tone === 'low' && 'text-green-600',
                  busy.tone === 'mid' && 'text-amber-600',
                  busy.tone === 'high' && 'text-red-600',
                  busy.tone === 'none' && 'text-gray-300'
                )}
              >
                {isLoading ? (
                  <span className="block h-5 animate-pulse rounded bg-gray-100" />
                ) : day ? (
                  <Sparkline day={day} />
                ) : (
                  <span className="block h-5" />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

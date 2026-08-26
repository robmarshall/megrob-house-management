import { cn } from '@/lib/utils'
import type { SnozoneSlot } from '@/types/snozone'

/**
 * The scannable, accessible fallback for `OccupancyChart` — often the better
 * answer on a phone. One row per five-minute slot; nothing averaged, so it
 * carries exactly the same information as the chart (the chart's crosshair
 * status line reads from the same `describeStatus` logic).
 *
 * Domain rules (see types/snozone.ts): `soldOut`/`blocked` are rendered as
 * "not bookable", never "full" — `full` (onSlope >= totalQty) is a distinct,
 * separate state. `expired` slots have corrupted counts, so they're shown
 * de-emphasised with their own status rather than a headcount that can't be
 * trusted.
 */
export interface SlotTableProps {
  slots: SnozoneSlot[]
  /** venue-local 'HH:MM' of the current pick, if any — highlights that row */
  highlightTime?: string | null
  className?: string
}

function describeStatus(slot: SnozoneSlot): { text: string; tone: 'ok' | 'low' | 'muted' } {
  if (slot.expired) return { text: 'already passed', tone: 'muted' }
  if (slot.available) {
    return slot.lowAvailability
      ? { text: `${slot.qtyAvailable} left`, tone: 'low' }
      : { text: `${slot.qtyAvailable} left`, tone: 'ok' }
  }
  if (slot.full) return { text: 'full', tone: 'muted' }
  if (slot.callToBook) return { text: 'call to book', tone: 'muted' }
  // soldOut / blocked / any other non-bookable reason land here — never "full".
  return { text: slot.reason ?? 'not bookable', tone: 'muted' }
}

export function SlotTable({ slots, highlightTime = null, className }: SlotTableProps) {
  if (slots.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No slots for this date.</p>
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[26rem] text-left text-sm">
        <caption className="sr-only">
          Availability by five-minute slot: time, people on the slope, and booking status.
        </caption>
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <th scope="col" className="py-2 pr-3 font-medium">
              Time
            </th>
            <th scope="col" className="py-2 pr-3 font-medium text-right">
              On slope
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Status
            </th>
            <th scope="col" className="py-2 font-medium text-right">
              Price
            </th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const status = describeStatus(slot)
            const isPick = highlightTime !== null && slot.time === highlightTime
            return (
              <tr
                key={slot.time}
                className={cn(
                  'border-b border-gray-100 align-top',
                  slot.expired && 'opacity-50',
                  isPick && 'bg-primary-50'
                )}
              >
                <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-gray-700">
                  {slot.label || slot.time}
                  {isPick && (
                    <span className="ml-2 rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Pick
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-gray-700">
                  {slot.onSlope} / {slot.totalQty}
                </td>
                <td
                  className={cn(
                    'py-2 pr-3',
                    status.tone === 'ok' && 'text-green-700',
                    status.tone === 'low' && 'text-amber-700',
                    status.tone === 'muted' && 'text-gray-500'
                  )}
                >
                  {status.text}
                </td>
                <td className="py-2 text-right tabular-nums text-gray-500">
                  {slot.price ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

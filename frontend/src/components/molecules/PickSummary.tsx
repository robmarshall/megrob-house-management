import { cn } from '@/lib/utils'
import type { SnozoneConfidence, SnozonePick } from '@/types/snozone'

/**
 * The Book tab's headline: one confident line when the data supports it, or
 * an honesty band when it doesn't (§3.1 of the frontend plan). Confidence is
 * computed server-side; this component just decides how to present it.
 *
 * The honesty band exists because occupancy on a future date is *bookings so
 * far*, not expected attendance — a distant date legitimately reads near-
 * empty, and presenting a confident pick built on a handful of bookings
 * would be actively misleading.
 */
export interface PickSummaryProps {
  pick: SnozonePick | null
  confidence: SnozoneConfidence | null
  note: string | null
  /** true when confidence is 'none'/'thin', or the date is too far out to trust */
  showHonestyBand: boolean
  isLoading: boolean
  className?: string
}

export function PickSummary({
  pick,
  confidence,
  note,
  showHonestyBand,
  isLoading,
  className,
}: PickSummaryProps) {
  if (isLoading) {
    return (
      <div className={cn('h-16 animate-pulse rounded-lg bg-gray-100', className)} aria-hidden="true" />
    )
  }

  if (showHonestyBand) {
    return (
      <div
        className={cn(
          'rounded-lg border border-amber-200 bg-amber-50 px-4 py-3',
          className
        )}
      >
        <p className="text-sm font-medium text-amber-900">
          {note ?? "Not enough bookings yet to recommend a time for this date."}
        </p>
        {pick && (
          <p className="mt-1 text-xs text-amber-700">
            Quietest slot booked so far: {pick.time} — treat this as a hint, not a forecast.
          </p>
        )}
        {confidence && (
          <p className="mt-1 text-[11px] uppercase tracking-wide text-amber-600">
            Confidence: {confidence}
          </p>
        )}
      </div>
    )
  }

  if (!pick) {
    return (
      <div className={cn('rounded-lg border border-gray-200 bg-gray-50 px-4 py-3', className)}>
        <p className="text-sm text-gray-600">No pick available for this date.</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 border-l-4 border-l-primary-600 bg-white px-4 py-3',
        className
      )}
    >
      <p className="text-lg font-bold tabular-nums text-gray-900">
        Book {pick.time} <span className="font-normal text-gray-400">·</span> on the slope{' '}
        {pick.presenceFrom}–{pick.presenceTo}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Average {Math.round(pick.avgOnSlope)} · peak {pick.peakOnSlope} on the slope in that window
        {pick.capacity ? ` (of ${pick.capacity} capacity)` : ''}
      </p>
    </div>
  )
}

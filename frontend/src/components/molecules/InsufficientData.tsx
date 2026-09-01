import { cn } from '@/lib/utils'
import type { SnozoneMaturity } from '@/types/snozone'

/**
 * The honest empty state for an analytic that does not have enough data yet.
 *
 * This is a real component rather than a nicety (frontend plan §5). Most of the
 * Patterns charts are not worth rendering for weeks after collection starts,
 * and a heatmap drawn from one sample per weekday is worse than no heatmap: it
 * looks exactly like a finding. So each analytic declares a minimum and shows
 * this below it, with a progress bar, instead of a misleading chart.
 *
 * The dataset is not backfillable — Snozone exposes no history — so the only
 * cure is time, and saying how much is the useful thing to show.
 */
export interface InsufficientDataProps {
  title: string
  maturity: SnozoneMaturity
  /** What the chart will show once it has enough. One short sentence. */
  description?: string
  className?: string
}

export function InsufficientData({
  title,
  maturity,
  description,
  className,
}: InsufficientDataProps) {
  const { needs, have, unit } = maturity
  const remaining = Math.max(0, needs - have)
  const pct = needs > 0 ? Math.min(100, Math.round((have / needs) * 100)) : 0

  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4',
        className
      )}
    >
      <h4 className="text-sm font-medium text-gray-900">{title}</h4>
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}

      <p className="mt-3 text-sm text-gray-600">
        Not enough data yet — {have} of {needs} {unit}.
      </p>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={have}
        aria-valuemin={0}
        aria-valuemax={needs}
        aria-label={`${title}: ${have} of ${needs} ${unit}`}
      >
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
      </div>

      <p className="mt-2 text-xs text-gray-400">
        {remaining === 0
          ? 'Almost there.'
          : `Needs ${remaining} more. The collector adds to this every day, and the history cannot be backfilled.`}
      </p>
    </div>
  )
}

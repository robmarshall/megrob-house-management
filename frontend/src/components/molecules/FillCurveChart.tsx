import { cn } from '@/lib/utils'
import type { SnozoneFillCurveSeries } from '@/types/snozone'

/**
 * One slot's occupancy against hours-before-start, with prior same-weekday
 * dates ghosted behind it. "Is my slot contested?", at a glance.
 *
 * Hand-rolled SVG, like `OccupancyChart` — no chart library (frontend plan §6).
 *
 * Two things this chart must not do, both of which would look perfectly normal:
 *
 * - **Never extend a curve back to zero.** A series starts at the first real
 *   observation. Drawing from (72h, 0) up to (48h, 60) would assert that sixty
 *   people booked in that window, when in truth that is simply when the slot
 *   entered our horizon. The dashed lead-in marks where knowledge starts.
 * - **Never plot time left-to-right as increasing.** The x-axis is lead time,
 *   which counts DOWN to zero at the slot's start, so the slot begins at the
 *   right-hand edge.
 */
export interface FillCurveChartProps {
  series: SnozoneFillCurveSeries[]
  slotTime: string
  className?: string
}

const W = 320
const H = 150
const PAD = { top: 8, right: 8, bottom: 22, left: 28 }

const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

export function FillCurveChart({ series, slotTime, className }: FillCurveChartProps) {
  if (series.length === 0) {
    return (
      <p className={cn('text-sm text-gray-500', className)}>
        No readings for this slot yet.
      </p>
    )
  }

  // The axis spans the earliest first sight across every series, so the ghosts
  // and the target share one scale and can actually be compared. Capacity is
  // the y ceiling where it is known, since "how full" is the real question.
  const maxHours = Math.max(...series.map((s) => s.firstSeenHoursBefore), 1)
  const maxY = Math.max(
    ...series.map((s) => Math.max(s.totalQty, ...s.points.map((p) => p.onSlope))),
    1
  )

  const x = (hoursBefore: number) => PAD.left + (1 - hoursBefore / maxHours) * PLOT_W
  const y = (onSlope: number) => PAD.top + (1 - onSlope / maxY) * PLOT_H

  const target = series.find((s) => s.isTarget)
  const capacity = target?.totalQty ?? 0

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full"
        role="img"
        aria-label={`Fill curve for the ${slotTime} slot, hours before start against people on the slope`}
      >
        {capacity > 0 && capacity <= maxY && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(capacity)}
            y2={y(capacity)}
            className="stroke-red-300"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* Ghosts first so the target draws over them. */}
        {series
          .filter((s) => !s.isTarget)
          .map((s) => (
            <Curve key={s.sessionDate} series={s} x={x} y={y} ghost />
          ))}
        {target && <Curve key={target.sessionDate} series={target} x={x} y={y} />}

        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + PLOT_H}
          y2={PAD.top + PLOT_H}
          className="stroke-gray-300"
          strokeWidth={1}
        />

        <text x={PAD.left} y={H - 6} className="fill-gray-400 text-[8px]">
          {Math.round(maxHours)}h before
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-gray-400 text-[8px]">
          start
        </text>
        <text x={2} y={PAD.top + 6} className="fill-gray-400 text-[8px]">
          {maxY}
        </text>
      </svg>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {series.map((s) => (
          <li key={s.sessionDate} className="flex items-center gap-1">
            <span
              className={cn(
                'inline-block h-0.5 w-3 rounded-full',
                s.isTarget ? 'bg-primary-600' : 'bg-gray-300'
              )}
            />
            <span className={s.isTarget ? 'font-medium text-gray-700' : 'text-gray-400'}>
              {formatDate(s.sessionDate)}
            </span>
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>{`Occupancy of the ${slotTime} slot by hours before it started`}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Hours before start</th>
            <th scope="col">On the slope</th>
          </tr>
        </thead>
        <tbody>
          {series.flatMap((s) =>
            s.points.map((p) => (
              <tr key={`${s.sessionDate}-${p.observedAt}`}>
                <th scope="row">{s.sessionDate}</th>
                <td>{p.hoursBefore.toFixed(1)}</td>
                <td>{p.onSlope}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function Curve({
  series,
  x,
  y,
  ghost = false,
}: {
  series: SnozoneFillCurveSeries
  x: (hoursBefore: number) => number
  y: (onSlope: number) => number
  ghost?: boolean
}) {
  if (series.points.length === 0) return null

  const path = series.points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.hoursBefore).toFixed(1)} ${y(p.onSlope).toFixed(1)}`)
    .join(' ')

  const first = series.points[0]

  return (
    <g>
      {/* Where knowledge begins. A short dash to the left of the first reading
          says "the curve starts here" without implying anything about what
          came before it. */}
      <line
        x1={x(first.hoursBefore) - 4}
        x2={x(first.hoursBefore)}
        y1={y(first.onSlope)}
        y2={y(first.onSlope)}
        className={ghost ? 'stroke-gray-200' : 'stroke-primary-300'}
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <path
        d={path}
        fill="none"
        strokeWidth={ghost ? 1 : 1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        className={ghost ? 'stroke-gray-300' : 'stroke-primary-600'}
      />
      <circle
        cx={x(first.hoursBefore)}
        cy={y(first.onSlope)}
        r={ghost ? 1.5 : 2}
        className={ghost ? 'fill-gray-300' : 'fill-primary-600'}
      />
    </g>
  )
}

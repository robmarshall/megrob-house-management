import { cn } from '@/lib/utils'

/**
 * A day-of-week × time-of-day heatmap: a CSS grid of coloured cells.
 *
 * Hand-rolled, no chart library — nothing a library offers beats
 * `grid-template-columns` here, and megrob pins dependencies exactly because
 * Coolify rebuilds `backend/` in isolation, so a new one is avoidable friction.
 *
 * Three things this gets right that a naive heatmap does not:
 *
 * - **A cell has three states, not two** (frontend plan §5.1). Opening hours
 *   vary day to day — Friday runs an hour later than Wednesday, right now, as
 *   the norm rather than the exception — so a blank cell means either "shut" or
 *   "nobody booked", and those invite opposite conclusions. `closed` is drawn
 *   distinctly from `empty`, and both differ from "not collected yet".
 * - **Colour is never the sole carrier of meaning.** Every cell also carries
 *   its value as text, and the whole grid is mirrored by a visually-hidden
 *   `<table>` for screen readers.
 * - **It scrolls inside its own container**, never the page.
 */

export type HeatmapCellState = 'value' | 'closed' | 'unobserved'

export interface HeatmapCell {
  row: number
  col: number
  value: number | null
  state: HeatmapCellState
  /** Full sentence for the cell's title/aria description. */
  description: string
}

export interface HeatmapProps {
  rowLabels: string[]
  colLabels: string[]
  cells: HeatmapCell[]
  /** Highest value in the scale; cells are shaded relative to this. */
  max: number
  /** How to render a value inside its cell. Keep it to 1-3 characters. */
  formatValue?: (value: number) => string
  /** Accessible name for the mirrored table. */
  caption: string
  className?: string
}

/**
 * Five fixed intensity steps rather than a computed colour.
 *
 * Tailwind compiles the classes it can see, so an interpolated
 * `bg-primary-${n}` would silently produce unstyled cells in a production
 * build. A ladder of literal classes is what actually survives the compiler.
 */
const INTENSITY = [
  'bg-primary-50 text-primary-900',
  'bg-primary-100 text-primary-900',
  'bg-primary-300 text-primary-950',
  'bg-primary-500 text-white',
  'bg-primary-700 text-white',
]

function intensityClass(value: number, max: number): string {
  if (max <= 0 || value <= 0) return INTENSITY[0]
  const step = Math.min(INTENSITY.length - 1, Math.floor((value / max) * INTENSITY.length))
  return INTENSITY[step]
}

export function Heatmap({
  rowLabels,
  colLabels,
  cells,
  max,
  formatValue = (v) => String(Math.round(v)),
  caption,
  className,
}: HeatmapProps) {
  const byKey = new Map(cells.map((c) => [`${c.row}:${c.col}`, c]))

  return (
    <div className={cn('w-full', className)}>
      {/* The grid is decorative for assistive tech; the table below carries it. */}
      <div className="-mx-1 overflow-x-auto px-1" aria-hidden="true">
        <div className="min-w-max">
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `auto repeat(${colLabels.length}, minmax(1.6rem, 1fr))` }}
          >
            <div />
            {colLabels.map((label) => (
              <div key={label} className="pb-1 text-center text-[10px] text-gray-500">
                {label}
              </div>
            ))}

            {rowLabels.map((rowLabel, row) => (
              <RowCells
                key={rowLabel}
                rowLabel={rowLabel}
                row={row}
                colLabels={colLabels}
                byKey={byKey}
                max={max}
                formatValue={formatValue}
              />
            ))}
          </div>
        </div>
      </div>

      <Legend />

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {colLabels.map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((rowLabel, row) => (
            <tr key={rowLabel}>
              <th scope="row">{rowLabel}</th>
              {colLabels.map((colLabel, col) => (
                <td key={colLabel}>{byKey.get(`${row}:${col}`)?.description ?? 'No data'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowCells({
  rowLabel,
  row,
  colLabels,
  byKey,
  max,
  formatValue,
}: {
  rowLabel: string
  row: number
  colLabels: string[]
  byKey: Map<string, HeatmapCell>
  max: number
  formatValue: (value: number) => string
}) {
  return (
    <>
      <div className="flex items-center pr-2 text-[11px] font-medium text-gray-600">
        {rowLabel}
      </div>
      {colLabels.map((colLabel, col) => {
        const cell = byKey.get(`${row}:${col}`)
        const state = cell?.state ?? 'unobserved'

        return (
          <div
            key={colLabel}
            title={cell?.description ?? 'Not collected yet'}
            className={cn(
              'flex h-6 items-center justify-center rounded-[2px] text-[9px] tabular-nums',
              state === 'value' && intensityClass(cell?.value ?? 0, max),
              // Closed is a solid, deliberate grey with a slash — visibly a
              // statement ("shut"), not an absence.
              state === 'closed' && 'bg-gray-200 text-gray-400',
              // Unobserved is a hollow outline: nothing is being claimed.
              state === 'unobserved' && 'border border-dashed border-gray-200 text-gray-300'
            )}
          >
            {state === 'value' && cell?.value !== null ? formatValue(cell!.value!) : null}
            {state === 'closed' ? '·' : null}
          </div>
        )
      })}
    </>
  )
}

function Legend() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500">
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-[2px] bg-primary-100" />
        quieter
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-[2px] bg-primary-700" />
        busier
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-[2px] bg-gray-200" />
        closed
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-[2px] border border-dashed border-gray-300" />
        not collected yet
      </span>
    </div>
  )
}

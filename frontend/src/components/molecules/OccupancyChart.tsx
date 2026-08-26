import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { SnozoneSlot } from '@/types/snozone'

/**
 * Port of phase 0's SVG occupancy chart
 * (`snozone-booking/public/app.js:257-482`), redone as a declarative React
 * component. Presentational only — no data fetching, no knowledge of "now".
 *
 * Form: change-over-time -> line. One series (people on the slope), so no
 * legend is needed; the title names it.
 *
 * `onSlope` is the busyness number, not `starting` (see types/snozone.ts).
 * `expired` slots have corrupted counts and are visually de-emphasised —
 * shaded and excluded from the "busiest bookable" headline — rather than
 * hidden, since the shape of the day still matters.
 */

const SVG_NS_VB = { w: 900, h: 240, l: 46, r: 18, t: 18, b: 30 }

export interface OccupancyBand {
  /** venue-local 'HH:MM' */
  from: string
  /** venue-local 'HH:MM' */
  to: string
}

export interface OccupancyHighlight {
  /** venue-local 'HH:MM' — must match a point's `time` to be drawn */
  time: string
  /** e.g. "Book 18:55 · on the slope 18:40–20:05" */
  label: string
}

export interface OccupancyChartProps {
  points: SnozoneSlot[]
  capacity: number
  highlight?: OccupancyHighlight | null
  bands?: { presence: OccupancyBand; session: OccupancyBand } | null
  className?: string
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

interface PlottedPoint extends SnozoneSlot {
  mins: number
}

function contiguousExpiredRanges(pts: PlottedPoint[]): [number, number][] {
  const ranges: [number, number][] = []
  let start: number | null = null
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].expired) {
      if (start === null) start = i
    } else if (start !== null) {
      ranges.push([start, i - 1])
      start = null
    }
  }
  if (start !== null) ranges.push([start, pts.length - 1])
  return ranges
}

function availabilityLabel(p: SnozoneSlot): string {
  // Never render soldOut/blocked as "full" — those mean "can no longer be
  // booked", not "at capacity". `full` (onSlope >= totalQty) is separate.
  if (p.expired) return 'reading unreliable — already passed'
  if (p.available) return `${p.qtyAvailable} places left`
  if (p.full) return 'full'
  if (p.soldOut || p.blocked) return 'not bookable'
  return 'not bookable'
}

export function OccupancyChart({
  points,
  capacity,
  highlight = null,
  bands = null,
  className,
}: OccupancyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursorIdx, setCursorIdx] = useState<number | null>(null)

  if (points.length < 2) return null

  const VB = SVG_NS_VB
  const pts: PlottedPoint[] = points.map((p) => ({ ...p, mins: toMinutes(p.time) }))
  const t0 = pts[0].mins
  const t1 = pts[pts.length - 1].mins
  const plotW = VB.w - VB.l - VB.r
  const plotH = VB.h - VB.t - VB.b

  const live = pts.filter((p) => !p.expired)
  const headSource = live.length ? live : pts
  const head = headSource.reduce((a, b) => (b.onSlope > a.onSlope ? b : a))

  // Axis tops out at the busiest reliable reading, so quiet days still show
  // their shape; capacity is drawn as its own reference line rather than
  // forcing the axis to include it.
  const maxOcc = Math.max(...headSource.map((p) => p.onSlope), 4)
  const yMax = Math.ceil(maxOcc / 4) * 4

  const x = (mins: number) => VB.l + ((mins - t0) / Math.max(1, t1 - t0)) * plotW
  const y = (v: number) => VB.t + plotH - (v / yMax) * plotH

  const seriesPath = pts
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.mins).toFixed(1)} ${y(p.onSlope).toFixed(1)}`)
    .join(' ')
  const areaPath = `${seriesPath} L${x(t1).toFixed(1)} ${y(0).toFixed(1)} L${x(t0).toFixed(1)} ${y(0).toFixed(1)} Z`

  const expiredRanges = contiguousExpiredRanges(pts)

  const clamp = (mins: number) => Math.min(Math.max(mins, t0), t1)

  const highlightPoint = highlight ? pts.find((p) => p.time === highlight.time) : undefined

  let headLabelX = x(head.mins)
  let headAnchor: 'start' | 'middle' | 'end' = 'middle'
  if (headLabelX < VB.l + 95) {
    headAnchor = 'start'
    headLabelX = VB.l + 6
  } else if (headLabelX > VB.l + plotW - 95) {
    headAnchor = 'end'
    headLabelX = VB.l + plotW - 6
  }
  const headY = y(head.onSlope)
  const headLabelY = headY < VB.t + 28 ? headY + 17 : headY - 12

  function nearestIndex(clientX: number): number | null {
    const svg = svgRef.current
    if (!svg) return null
    const box = svg.getBoundingClientRect()
    if (box.width === 0) return null
    const vx = ((clientX - box.left) / box.width) * VB.w
    let bestIdx = 0
    let bestDist = Infinity
    pts.forEach((p, i) => {
      const d = Math.abs(x(p.mins) - vx)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    })
    return bestIdx
  }

  function handlePointerMove(e: PointerEvent<SVGRectElement>) {
    const idx = nearestIndex(e.clientX)
    if (idx !== null) setCursorIdx(idx)
  }

  function handleKeyDown(e: KeyboardEvent<SVGRectElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    setCursorIdx((prev) => {
      const cur = prev ?? 0
      if (e.key === 'ArrowLeft') return Math.max(0, cur - 1)
      if (e.key === 'ArrowRight') return Math.min(pts.length - 1, cur + 1)
      if (e.key === 'Home') return 0
      return pts.length - 1
    })
  }

  const cursor = cursorIdx !== null ? pts[cursorIdx] : null

  return (
    <div className={className}>
      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          role="img"
          aria-labelledby="occ-chart-title occ-chart-desc"
          className="block w-full min-w-[420px]"
          style={{ overflow: 'visible' }}
        >
          <title id="occ-chart-title">People on the slope through the day</title>
          <desc id="occ-chart-desc">
            Number of people on the slope at each five-minute slot of the selected date, against
            slope capacity.
          </desc>

          {/* de-emphasise expired (corrupted-count) readings */}
          {expiredRanges.map(([startIdx, endIdx]) => {
            const rx = x(pts[startIdx].mins)
            const rEnd = x(pts[endIdx].mins)
            return (
              <rect
                key={`expired-${startIdx}`}
                x={rx}
                y={VB.t}
                width={Math.max(1, rEnd - rx)}
                height={plotH}
                className="fill-gray-400/10"
              />
            )
          })}

          {/* gridlines + y labels */}
          {[0, 1, 2, 3, 4].map((i) => {
            const v = (yMax / 4) * i
            return (
              <g key={i}>
                <line
                  x1={VB.l}
                  x2={VB.l + plotW}
                  y1={y(v)}
                  y2={y(v)}
                  className="stroke-gray-200"
                  strokeWidth={1}
                />
                <text
                  x={VB.l - 9}
                  y={y(v) + 4}
                  textAnchor="end"
                  className="fill-gray-400 text-[11px]"
                >
                  {Math.round(v)}
                </text>
              </g>
            )
          })}

          {/* capacity reference */}
          {capacity > 0 && capacity <= yMax && (
            <g>
              <line
                x1={VB.l}
                x2={VB.l + plotW}
                y1={y(capacity)}
                y2={y(capacity)}
                className="stroke-gray-400"
                strokeWidth={1}
                strokeDasharray="5 4"
                opacity={0.6}
              />
              <text
                x={VB.l + plotW - 4}
                y={y(capacity) - 5}
                textAnchor="end"
                className="fill-gray-400 text-[10.5px] tracking-wide"
              >
                capacity {capacity}
              </text>
            </g>
          )}

          {/* hourly x labels */}
          {Array.from({ length: Math.max(0, Math.floor(t1 / 60) - Math.ceil(t0 / 60) + 1) }).map(
            (_, i) => {
              const h = Math.ceil(t0 / 60) + i
              if (h * 60 > t1) return null
              return (
                <text
                  key={h}
                  x={x(h * 60)}
                  y={VB.h - 9}
                  textAnchor="middle"
                  className="fill-gray-400 text-[11px]"
                >
                  {String(h).padStart(2, '0')}:00
                </text>
              )
            }
          )}

          {/* series */}
          <path d={areaPath} className="fill-green-600" opacity={0.09} />
          <path
            d={seriesPath}
            fill="none"
            className="stroke-green-700"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* busiest bookable (reliable) reading */}
          <circle cx={x(head.mins)} cy={headY} r={5} className="fill-green-700" />
          <text
            x={headLabelX}
            y={headLabelY}
            textAnchor={headAnchor}
            className="fill-gray-900 text-[11.5px] font-semibold"
          >
            busiest bookable {head.time} · {head.onSlope} of {capacity || head.totalQty}
          </text>

          {/* the pick, ringed with its presence/session bands */}
          {bands && (
            <>
              <rect
                x={x(clamp(toMinutes(bands.presence.from)))}
                y={VB.t}
                width={Math.max(
                  2,
                  x(clamp(toMinutes(bands.presence.to))) - x(clamp(toMinutes(bands.presence.from)))
                )}
                height={plotH}
                className="fill-green-600"
                opacity={0.07}
              />
              <rect
                x={x(clamp(toMinutes(bands.session.from)))}
                y={VB.t}
                width={Math.max(
                  2,
                  x(clamp(toMinutes(bands.session.to))) - x(clamp(toMinutes(bands.session.from)))
                )}
                height={plotH}
                className="fill-green-600"
                opacity={0.15}
              />
            </>
          )}
          {highlightPoint && highlight && (
            <PickAnnotation
              vb={VB}
              plotW={plotW}
              plotH={plotH}
              cx={x(highlightPoint.mins)}
              cy={y(highlightPoint.onSlope)}
              label={highlight.label}
              avoid={{ x: headLabelX, y: headLabelY }}
            />
          )}

          {/* hover / keyboard crosshair */}
          {cursor && (
            <>
              <line
                x1={x(cursor.mins)}
                x2={x(cursor.mins)}
                y1={VB.t}
                y2={VB.t + plotH}
                className="stroke-gray-400"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.55}
              />
              <circle
                cx={x(cursor.mins)}
                cy={y(cursor.onSlope)}
                r={5.5}
                className="fill-green-700 stroke-white"
                strokeWidth={2.5}
              />
            </>
          )}

          <rect
            x={VB.l}
            y={VB.t}
            width={plotW}
            height={plotH}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            tabIndex={0}
            role="slider"
            aria-label="Scrub the chart by time"
            aria-valuemin={0}
            aria-valuemax={pts.length - 1}
            aria-valuenow={cursorIdx ?? undefined}
            aria-valuetext={cursor ? `${cursor.label}, ${cursor.onSlope} on slope` : undefined}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setCursorIdx(null)}
            onFocus={() => setCursorIdx((prev) => prev ?? 0)}
            onBlur={() => setCursorIdx(null)}
            onKeyDown={handleKeyDown}
          />
        </svg>
      </div>

      {cursor && (
        <div
          role="status"
          aria-live="polite"
          className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
        >
          <span className="font-semibold text-gray-900">{cursor.label}</span>
          {' · '}
          {cursor.onSlope} of {cursor.totalQty} on slope
          <span className="ml-2 text-gray-500">
            starting here {cursor.starting} · from earlier {cursor.fromPrior}
          </span>
          <div className="text-gray-500">{availabilityLabel(cursor)}</div>
        </div>
      )}
    </div>
  )
}

/**
 * The ring + label marking the pick, kept as its own function to keep the
 * clash-avoidance math (don't land on the "busiest bookable" label) out of
 * the main render body.
 */
function PickAnnotation({
  vb,
  plotW,
  plotH,
  cx,
  cy,
  label,
  avoid,
}: {
  vb: typeof SVG_NS_VB
  plotW: number
  plotH: number
  cx: number
  cy: number
  label: string
  avoid: { x: number; y: number }
}) {
  let rx = cx
  let anchor: 'start' | 'middle' | 'end' = 'middle'
  if (rx < vb.l + 70) {
    anchor = 'start'
    rx = vb.l + 6
  } else if (rx > vb.l + plotW - 70) {
    anchor = 'end'
    rx = vb.l + plotW - 6
  }
  const defaultY = cy + 20
  const clash = Math.abs(cx - avoid.x) < 150 && Math.abs(defaultY - avoid.y) < 26
  const ry = clash || cy > vb.t + plotH - 26 ? cy - 14 : defaultY

  return (
    <>
      <circle cx={cx} cy={cy} r={6} fill="none" className="stroke-gray-900" strokeWidth={2} />
      <text x={rx} y={ry} textAnchor={anchor} className="fill-gray-900 text-[11px] font-semibold">
        {label}
      </text>
    </>
  )
}

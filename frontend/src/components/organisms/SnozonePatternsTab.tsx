import { useMemo, useState } from 'react'
import {
  useSnozoneBusyness,
  useSnozoneBookingTimes,
  useSnozoneLeadTimes,
  useSnozoneTrend,
  useSnozoneCollectedDates,
  useSnozoneFillCurve,
} from '@/hooks/snozone/useSnozoneAnalytics'
import { useSnozoneDay } from '@/hooks/snozone/useSnozoneDay'
import { Heatmap, type HeatmapCell } from '@/components/molecules/Heatmap'
import { InsufficientData } from '@/components/molecules/InsufficientData'
import { FillCurveChart } from '@/components/molecules/FillCurveChart'
import type {
  SnozoneBusynessResponse,
  SnozoneBookingTimesResponse,
  SnozoneLeadTimesResponse,
  SnozoneTrendResponse,
  SnozoneCollectedDate,
} from '@/types/snozone'

/**
 * The Patterns tab: "what is this slope like?" (frontend plan §3.2).
 *
 * The page that gets better every week, and the one that has to be most careful
 * about saying so. Each analytic renders its chart only once the server says it
 * has enough data, and an honest `<InsufficientData>` with a progress bar until
 * then — a heatmap built from one sample per weekday looks exactly like a
 * finding, which is the failure this whole design avoids (§5).
 */

/** Monday-first, which is how a week reads here, mapped to JS `getDay()`. */
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Section({
  title,
  blurb,
  children,
}: {
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mb-3 mt-0.5 text-xs text-gray-500">{blurb}</p>
      {children}
    </section>
  )
}

function Loading() {
  return <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
}

export function SnozonePatternsTab() {
  const busyness = useSnozoneBusyness()
  const bookingTimes = useSnozoneBookingTimes()
  const leadTimes = useSnozoneLeadTimes()
  const trend = useSnozoneTrend()
  const collected = useSnozoneCollectedDates()

  const anyError =
    busyness.isError || bookingTimes.isError || leadTimes.isError || trend.isError

  if (anyError) {
    return <p className="text-sm text-red-600">Could not load Snozone patterns.</p>
  }

  return (
    <div className="space-y-5">
      <CollectionSummary
        dates={collected.data?.dates.length ?? 0}
        isLoading={collected.isLoading}
      />

      <Section
        title="How this slot filled"
        blurb="One slot's occupancy against the hours before it started, with the previous same-weekday dates behind it."
      >
        <FillCurveSection
          dates={collected.data?.dates ?? []}
          isLoading={collected.isLoading}
        />
      </Section>

      <Section
        title="Busyness"
        blurb="Median headcount on the slope, by weekday and hour. Hours show the busiest five-minute slot within them."
      >
        {busyness.isLoading ? <Loading /> : <BusynessChart data={busyness.data} />}
      </Section>

      <Section
        title="When people book"
        blurb="The hour bookings are actually made — a question Snozone's own API can never answer, because it only ever reports the present."
      >
        {bookingTimes.isLoading ? <Loading /> : <BookingTimesChart data={bookingTimes.data} />}
      </Section>

      <Section
        title="How far ahead people book"
        blurb="Lead time from booking to the slot starting."
      >
        {leadTimes.isLoading ? <Loading /> : <LeadTimesChart data={leadTimes.data} />}
      </Section>

      <Section
        title="Week by week"
        blurb="Bookings per open slot, so a longer Friday doesn't read as a busier one."
      >
        {trend.isLoading ? <Loading /> : <TrendChart data={trend.data} />}
      </Section>
    </div>
  )
}

function CollectionSummary({ dates, isLoading }: { dates: number; isLoading: boolean }) {
  if (isLoading) return <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
  return (
    <p className="text-xs text-gray-500">
      Built from {dates} completed {dates === 1 ? 'date' : 'dates'} of collection. None of this
      can be backfilled — Snozone publishes no history — so every chart here only gets better
      from now on.
    </p>
  )
}

/* ------------------------------------------------------------ fill curve */

/**
 * The fill curve needs two choices the other analytics do not: which date, and
 * which slot. Both default to something worth looking at — the most recent
 * completed date, and its busiest slot — so the chart says something useful
 * before anyone touches a dropdown.
 */
function FillCurveSection({
  dates,
  isLoading,
}: {
  dates: SnozoneCollectedDate[]
  isLoading: boolean
}) {
  const [date, setDate] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)

  const selectedDate = date ?? dates[0]?.sessionDate ?? null

  // Slot times come from the day itself rather than any constant: opening hours
  // vary day to day, so a hardcoded list would offer slots that never existed
  // on a Wednesday and omit Friday's late ones (frontend plan §5.1).
  const day = useSnozoneDay(selectedDate)
  // Held undefined rather than defaulted to [], so the memo below depends on a
  // stable reference instead of a fresh array every render.
  const slots = day.data?.slots

  const busiestSlot = useMemo(() => {
    if (!slots || slots.length === 0) return null
    return slots.reduce((best, s) => (s.onSlope > best.onSlope ? s : best), slots[0]).time
  }, [slots])

  const selectedSlot = slot ?? busiestSlot
  const curve = useSnozoneFillCurve(selectedDate, selectedSlot)

  if (isLoading) return <div className="h-40 animate-pulse rounded-lg bg-gray-100" />

  if (dates.length === 0) {
    return <p className="text-sm text-gray-500">No completed dates collected yet.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-gray-500">
          <span className="mr-1">Date</span>
          <select
            value={selectedDate ?? ''}
            onChange={(e) => {
              setDate(e.target.value)
              // The chosen slot may not exist on the new date, so fall back to
              // that date's own busiest rather than carrying a dead time over.
              setSlot(null)
            }}
            className="rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-700"
          >
            {dates.map((d) => (
              <option key={d.sessionDate} value={d.sessionDate}>
                {d.sessionDate}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-gray-500">
          <span className="mr-1">Slot</span>
          <select
            value={selectedSlot ?? ''}
            onChange={(e) => setSlot(e.target.value)}
            disabled={!slots || slots.length === 0}
            className="rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-700 disabled:opacity-50"
          >
            {(slots ?? []).map((s) => (
              <option key={s.time} value={s.time}>
                {s.time}
              </option>
            ))}
          </select>
        </label>
      </div>

      {curve.isLoading && <div className="h-40 animate-pulse rounded-lg bg-gray-100" />}
      {curve.isError && (
        <p className="text-sm text-red-600">Could not load this slot's fill curve.</p>
      )}

      {curve.data && !curve.data.maturity.ready && (
        <InsufficientData
          title="Fill curve"
          maturity={curve.data.maturity}
          description="Needs one slot watched from the moment it was first listed through to its start."
        />
      )}

      {curve.data && curve.data.maturity.ready && selectedSlot && (
        <>
          <FillCurveChart series={curve.data.series} slotTime={selectedSlot} />
          <FirstSightNote series={curve.data.series} />
        </>
      )}
    </div>
  )
}

/**
 * Every curve begins where observation began, not where booking began. Saying
 * so is the difference between "this slot filled late" and "we started
 * watching late", which the chart alone cannot distinguish.
 */
function FirstSightNote({
  series,
}: {
  series: { isTarget: boolean; firstSeenOnSlope: number; firstSeenHoursBefore: number }[]
}) {
  const target = series.find((s) => s.isTarget)
  if (!target || target.firstSeenOnSlope === 0) return null

  return (
    <p className="text-[11px] text-gray-400">
      {target.firstSeenOnSlope} were already on the slope when this slot was first seen,{' '}
      {Math.round(target.firstSeenHoursBefore)} hours before it started. When those were
      booked is not knowable — the curve starts where the collector started looking.
    </p>
  )
}

/* --------------------------------------------------------------- busyness */

function BusynessChart({ data }: { data?: SnozoneBusynessResponse }) {
  const hourly = useMemo(() => {
    if (!data) return null

    const datesByDow = new Map(data.datesPerDow.map((d) => [d.dow, d.dates]))

    // Hours the timetable is ever open, across every weekday observed. Derived,
    // never assumed: the plan is explicit that no constant, axis or fixture may
    // hardcode 121 slots or 10:00-20:00 (§5.1).
    const hours = Array.from(
      new Set(data.cells.map((c) => Number(c.slotTime.slice(0, 2))))
    ).sort((a, b) => a - b)

    // Busiest five-minute slot within each hour: "how bad does this hour get".
    // A mean across the hour would flatten exactly the peak worth avoiding.
    const peak = new Map<string, number>()
    for (const cell of data.cells) {
      const key = `${cell.dow}:${Number(cell.slotTime.slice(0, 2))}`
      peak.set(key, Math.max(peak.get(key) ?? 0, cell.medianOnSlope))
    }

    const cells: HeatmapCell[] = []
    DOW_ORDER.forEach((dow, row) => {
      const dates = datesByDow.get(dow) ?? 0
      hours.forEach((hour, col) => {
        const value = peak.get(`${dow}:${hour}`)
        if (value !== undefined) {
          cells.push({
            row,
            col,
            value,
            state: 'value',
            description: `${DOW_LABELS[row]} ${String(hour).padStart(2, '0')}:00 — typically ${Math.round(value)} on the slope, from ${dates} ${dates === 1 ? 'date' : 'dates'}`,
          })
        } else {
          // The distinction the plan insists on: with dates for this weekday,
          // a missing hour means the slope was SHUT; with none, we simply have
          // not collected that weekday yet.
          cells.push({
            row,
            col,
            value: null,
            state: dates > 0 ? 'closed' : 'unobserved',
            description:
              dates > 0
                ? `${DOW_LABELS[row]} ${String(hour).padStart(2, '0')}:00 — closed`
                : `${DOW_LABELS[row]} ${String(hour).padStart(2, '0')}:00 — not collected yet`,
          })
        }
      })
    })

    return {
      cells,
      colLabels: hours.map((h) => String(h).padStart(2, '0')),
      max: Math.max(...cells.map((c) => c.value ?? 0), 1),
    }
  }, [data])

  if (!data || !hourly) return null

  if (!data.maturity.ready) {
    return (
      <InsufficientData
        title="Busyness by weekday and hour"
        maturity={data.maturity}
        description="Needs several samples of every weekday before a typical Friday can be told from an unusual one."
      />
    )
  }

  return (
    <Heatmap
      rowLabels={DOW_LABELS}
      colLabels={hourly.colLabels}
      cells={hourly.cells}
      max={hourly.max}
      caption="Median headcount on the slope by weekday and hour"
    />
  )
}

/* ---------------------------------------------------------- booking times */

function BookingTimesChart({ data }: { data?: SnozoneBookingTimesResponse }) {
  const grid = useMemo(() => {
    if (!data) return null
    const hours = Array.from({ length: 24 }, (_, h) => h)
    const byKey = new Map(data.cells.map((c) => [`${c.dow}:${c.hour}`, c]))

    const cells: HeatmapCell[] = []
    DOW_ORDER.forEach((dow, row) => {
      hours.forEach((hour, col) => {
        const cell = byKey.get(`${dow}:${hour}`)
        cells.push({
          row,
          col,
          value: cell?.bookings ?? 0,
          state: 'value',
          description: `${DOW_LABELS[row]} ${String(hour).padStart(2, '0')}:00 — ${cell?.bookings ?? 0} places booked`,
        })
      })
    })

    return {
      cells,
      colLabels: hours.map((h) => String(h).padStart(2, '0')),
      max: Math.max(...cells.map((c) => c.value ?? 0), 1),
    }
  }, [data])

  if (!data || !grid) return null

  if (!data.maturity.ready) {
    return (
      <InsufficientData
        title="Booking times"
        maturity={data.maturity}
        description="Needs a week or two of events before a daily rhythm is distinguishable from noise."
      />
    )
  }

  return (
    <>
      <Heatmap
        rowLabels={DOW_LABELS}
        colLabels={grid.colLabels}
        cells={grid.cells}
        max={grid.max}
        caption="Places booked by hour of week"
      />
      {data.excludedWideBracket > 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          {data.excludedWideBracket} further {data.excludedWideBracket === 1 ? 'booking' : 'bookings'}{' '}
          are known only to within a day — seen by the daily sweep rather than the
          half-hourly poll — so they cannot be placed in an hour and are left out here.
        </p>
      )}
    </>
  )
}

/* ------------------------------------------------------------- lead times */

function LeadTimesChart({ data }: { data?: SnozoneLeadTimesResponse }) {
  if (!data) return null

  if (!data.maturity.ready) {
    return (
      <InsufficientData
        title="Lead times"
        maturity={data.maturity}
        description="Needs enough bookings for the distribution to have a shape."
      />
    )
  }

  const max = Math.max(...data.buckets.map((b) => b.bookings), 1)

  return (
    <>
      <ul className="space-y-1">
        {data.buckets.map((bucket) => (
          <li key={bucket.label} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-right text-gray-500">{bucket.label}</span>
            <span className="h-4 flex-1 overflow-hidden rounded-sm bg-gray-100">
              <span
                className="block h-full rounded-sm bg-primary-500"
                style={{ width: `${(bucket.bookings / max) * 100}%` }}
              />
            </span>
            <span className="w-10 shrink-0 tabular-nums text-gray-600">{bucket.bookings}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-gray-400">
        Truncated at about {data.observableLeadDays}{' '}
        {data.observableLeadDays === 1 ? 'day' : 'days'}: no booking made before collection
        began can ever appear here, so the long tail is missing by construction rather than
        genuinely empty.
      </p>
    </>
  )
}

/* ----------------------------------------------------------------- trend */

function TrendChart({ data }: { data?: SnozoneTrendResponse }) {
  if (!data) return null

  if (!data.maturity.ready) {
    return (
      <InsufficientData
        title="Week by week"
        maturity={data.maturity}
        description="Needs a few weeks before a change is a trend rather than a fluctuation."
      />
    )
  }

  const max = Math.max(...data.weeks.map((w) => w.startingPerOpenSlot), 0.01)

  return (
    <>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
            <th scope="col" className="pb-1 font-medium">Week of</th>
            <th scope="col" className="pb-1 font-medium">Dates</th>
            <th scope="col" className="pb-1 text-right font-medium">Per slot</th>
            <th scope="col" className="pb-1 text-right font-medium">Peak</th>
          </tr>
        </thead>
        <tbody>
          {data.weeks.map((week) => (
            <tr key={week.weekStart} className="border-t border-gray-100">
              <td className="py-1.5 text-gray-700">{week.weekStart}</td>
              <td className="py-1.5 text-gray-500">{week.dates}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-700">
                <span className="mr-2 inline-block h-1.5 rounded-full bg-primary-400 align-middle"
                  style={{ width: `${Math.max(2, (week.startingPerOpenSlot / max) * 48)}px` }}
                />
                {week.startingPerOpenSlot.toFixed(2)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-gray-700">{week.peakOnSlope}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.slotTypes.length > 0 && (
        <p className="mt-3 text-[11px] text-gray-400">
          Snozone's own pricing tiers over this period:{' '}
          {data.slotTypes.map((t) => `${t.slotType} (${t.slots} slots)`).join(', ')}.
        </p>
      )}
    </>
  )
}

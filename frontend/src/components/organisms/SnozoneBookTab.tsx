import { useEffect, useState } from 'react'
import { useSnozoneDates } from '@/hooks/snozone/useSnozoneDates'
import { useSnozoneDay, useSnozoneDays } from '@/hooks/snozone/useSnozoneDay'
import { useSnozoneRecommend } from '@/hooks/snozone/useSnozoneRecommend'
import { DateStrip } from '@/components/molecules/DateStrip'
import { PickSummary } from '@/components/molecules/PickSummary'
import { OccupancyChart } from '@/components/molecules/OccupancyChart'
import { SlotTable } from '@/components/molecules/SlotTable'
import type { SnozonePick } from '@/types/snozone'

const STRIP_SIZE = 7

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = ((h * 60 + m + minutes) % 1440 + 1440) % 1440
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function pickLabel(pick: SnozonePick): string {
  return `Book ${pick.time} · on the slope ${pick.presenceFrom}–${pick.presenceTo}`
}

/**
 * The Book tab: "when should I go?" — the pick, a date strip, the occupancy
 * chart, the slot table, and an honesty band for dates the data can't yet
 * support a confident pick for. See docs/snozone-frontend-plan.md §3.1.
 */
export function SnozoneBookTab() {
  const { data: datesData, isLoading: datesLoading, isError: datesError } = useSnozoneDates()
  const dates = datesData?.dates ?? []
  const stripDates = dates.slice(0, STRIP_SIZE)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedDate && dates.length > 0) setSelectedDate(dates[0])
  }, [dates, selectedDate])

  const stripResults = useSnozoneDays(stripDates)
  const stripItems = stripDates.map((date, i) => ({
    date,
    day: stripResults[i]?.data ?? null,
    isLoading: stripResults[i]?.isLoading ?? false,
  }))

  const { data: day, isLoading: dayLoading, isError: dayError } = useSnozoneDay(selectedDate)
  const { data: recommend, isLoading: recommendLoading } = useSnozoneRecommend(selectedDate)

  if (datesLoading) {
    return (
      <div className="space-y-5">
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-56 animate-pulse rounded-lg bg-gray-100" />
      </div>
    )
  }

  if (datesError) {
    return <p className="text-sm text-red-600">Could not load Snozone dates.</p>
  }

  if (dates.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No bookable dates yet — the collector may need a run to prime this.
      </p>
    )
  }

  const confidence = recommend?.confidence ?? null
  // The API owns this judgement. It knows the venue-local lead time and how
  // many bookings the date actually has, and returns `note` explaining itself;
  // re-deriving "more than two days out" from the browser's clock would be a
  // second, cruder copy of the same policy, wrong for anyone not in UK time and
  // free to disagree with the server the moment either threshold moves.
  const showHonestyBand = !recommendLoading && confidence !== null && confidence !== 'good'
  const pick = recommend?.pick ?? null
  const confidentPick = pick && !showHonestyBand ? pick : null

  return (
    <div className="space-y-5">
      <DateStrip items={stripItems} selected={selectedDate} onSelect={setSelectedDate} />

      <PickSummary
        pick={pick}
        confidence={confidence}
        note={recommend?.note ?? null}
        showHonestyBand={showHonestyBand}
        isLoading={recommendLoading}
      />

      {dayLoading && <div className="h-56 animate-pulse rounded-lg bg-gray-100" />}
      {dayError && (
        <p className="text-sm text-red-600">Could not load this date&apos;s availability.</p>
      )}

      {day && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <OccupancyChart
            points={day.slots}
            capacity={day.summary.capacity}
            highlight={confidentPick ? { time: confidentPick.time, label: pickLabel(confidentPick) } : null}
            bands={
              confidentPick
                ? {
                    presence: { from: confidentPick.presenceFrom, to: confidentPick.presenceTo },
                    session: {
                      from: confidentPick.time,
                      to: addMinutes(confidentPick.time, recommend?.params.session ?? 60),
                    },
                  }
                : null
            }
          />

          <div className="mt-4 border-t border-gray-100 pt-4">
            <SlotTable slots={day.slots} highlightTime={confidentPick?.time ?? null} />
          </div>
        </div>
      )}

      {day?.isStale && (
        <p className="text-xs text-gray-400">
          This date&apos;s availability hasn&apos;t updated in a while — showing the last reading.
        </p>
      )}
    </div>
  )
}

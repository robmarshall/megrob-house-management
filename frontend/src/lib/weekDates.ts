// ---------------------------------------------------------------------------
// Week/date helpers for meal planning
//
// IMPORTANT: dates are formatted from their LOCAL calendar components rather
// than via `Date.toISOString()`. `toISOString()` converts to UTC, which for
// users at positive UTC offsets shifts a local midnight back to the previous
// calendar day. Formatting from local components keeps the YYYY-MM-DD aligned
// with what the user sees.
// ---------------------------------------------------------------------------

/**
 * Returns the Monday of the week containing `d`, at local midnight.
 * Sundays map back to the prior Monday (ISO week semantics).
 */
export function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * Formats a Date as `YYYY-MM-DD` using its LOCAL calendar components
 * (no UTC conversion / timezone shift).
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns a new Date offset from `date` by `weeks` weeks. */
export function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + weeks * 7)
  return result
}

/** Formats a `YYYY-MM-DD` string as e.g. "Jan 5" for display. */
export function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Returns the local `YYYY-MM-DD` for `dayOfWeek` (0-6) after `weekStart`. */
export function getDayDate(weekStart: Date, dayOfWeek: number): string {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + dayOfWeek)
  return toLocalISODate(d)
}

/** Returns the local `YYYY-MM-DD` of the last day (Sunday) of the week. */
export function getWeekEndDate(weekStart: Date): string {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  return toLocalISODate(d)
}

/**
 * Timestamp coercion for values that came back from raw SQL.
 *
 * Drizzle's typed query builder hands back real `Date` objects, but
 * `db.execute()` passes the driver's value straight through, and postgres-js
 * yields a STRING for timestamptz there — '2026-08-26 08:32:05.948+00'. Code
 * that assumed `Date` has already crashed one endpoint in production
 * (`r.observed_at.toISOString is not a function`), so both shapes are accepted
 * wherever a raw row is read.
 */

/**
 * Normalise postgres-js's timestamptz string into something `new Date()`
 * parses everywhere.
 *
 * Both substitutions are load-bearing, and the second exists only because the
 * first is not free:
 *
 * - The space separator is valid for V8 but Safari rejects it outright, which
 *   rendered "Invalid Date" on the iPhone.
 * - Postgres writes a two-digit offset ('+00'). That parses fine in the
 *   space-separated form, but swapping the space for a 'T' promotes the string
 *   to an ISO 8601 candidate, and the strict grammar demands '+00:00'. So the
 *   Safari fix alone turned every raw-SQL timestamp into `Invalid Date` under
 *   Node — silently nulling them on the collector-health endpoint while the
 *   typed-builder timestamps beside them rendered normally.
 */
function normalise(value: string): string {
  return value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
}

/** A raw-SQL timestamp as a `Date`, or null if absent or unparseable. */
export function toDate(value: unknown): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(normalise(String(value)));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A raw-SQL timestamp rendered ISO, or null if absent or unparseable. */
export function toIso(value: unknown): string | null {
  return toDate(value)?.toISOString() ?? null;
}

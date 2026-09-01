-- snozone_booking_events: when bookings were actually MADE.
--
-- Defined once in SQL, per docs/snozone-frontend-plan.md §4, so that every
-- analytic inherits the same answer to the trap in brief.md §6: a booking for
-- one slot also raises people_from_prior_session on the next twelve slots, so
-- diffing on_slope counts a single booking thirteen times. Only `starting` --
-- sessions beginning in this slot -- may be diffed.
--
-- A view rather than a table because it is a pure function of the raw
-- observations, which are append-only and never rewritten. It stays correct
-- when the rollup rules change, and costs nothing to redefine.
--
-- Three columns carry the honesty of this dataset and analytics must use them:
--
--   bracket_minutes  How wide the window containing the booking is. Rows are
--                    written only on change, and prev_seen_at records the last
--                    poll that saw no change, so a booking is known to have
--                    happened in (prev_seen_at, observed_at] and no more
--                    precisely. Inside the 30-minute window that bracket is
--                    ~30 minutes; on the daily horizon sweep it is ~24 HOURS.
--                    A 24-hour bracket says nothing whatsoever about time of
--                    day, so any hour-of-day or hour-of-week analytic MUST
--                    filter on this. Lead-time analytics need not -- a day's
--                    imprecision is immaterial against a lead time in days.
--
--   booked_at        Midpoint of that bracket: the best single estimate, and
--                    wrong by at most bracket_minutes/2. Bucket on this, never
--                    on observed_at, which is biased late by construction.
--
--   delta_starting   Signed. Positive is bookings, negative is cancellations.
--                    Both are real signals, so neither is filtered out here;
--                    consumers asking "when do people book" want > 0.
--
-- Excluded deliberately:
--   * The first observation of a slot (prev_seen_at IS NULL). Its occupancy was
--     booked before the slot entered our horizon and cannot be attributed to any
--     time, so counting it as an event at first sight would pile every
--     pre-existing booking onto the moment collection happened to start. That
--     truncation is measured instead by snozone_slot_finals.first_seen_on_slope.
--   * Observations at or after slot start. Snozone zeroes qtyavailable and stops
--     decrementing carry-over once a slot begins, so the readings are corrupted
--     (brief.md §10.2a) and their diffs are noise.
--   * Rows where starting did not move. Observations are written when ANY
--     tracked value changes -- a price or a sold_out flag will do it -- so a
--     zero delta is common and is not an event.
CREATE OR REPLACE VIEW snozone_booking_events AS
WITH usable AS (
  SELECT
    o.product_row_id,
    o.session_date,
    o.slot_time,
    o.observed_at,
    o.prev_seen_at,
    o.starting,
    o.total_qty,
    o.slot_type,
    -- Venue-local slot start as a real instant. Built from the date and the
    -- 'HH:MM' text rather than stored as one, so BST cannot corrupt it
    -- (PLAN.md §12.3).
    ((o.session_date + o.slot_time::time) AT TIME ZONE 'Europe/London') AS slot_start_at,
    lag(o.starting) OVER w AS prev_starting
  FROM snozone_slot_observations o
  WHERE o.observed_at < ((o.session_date + o.slot_time::time) AT TIME ZONE 'Europe/London')
  WINDOW w AS (
    PARTITION BY o.product_row_id, o.session_date, o.slot_time
    ORDER BY o.observed_at
  )
)
SELECT
  product_row_id,
  session_date,
  slot_time,
  slot_start_at,
  prev_seen_at                                        AS bracket_from,
  observed_at                                         AS bracket_to,
  prev_seen_at + (observed_at - prev_seen_at) / 2     AS booked_at,
  (EXTRACT(EPOCH FROM (observed_at - prev_seen_at)) / 60)::int AS bracket_minutes,
  prev_starting                                       AS starting_before,
  starting                                            AS starting_after,
  (starting - prev_starting)                          AS delta_starting,
  -- Lead time from the booking estimate to the slot's start.
  (EXTRACT(EPOCH FROM (slot_start_at - (prev_seen_at + (observed_at - prev_seen_at) / 2))) / 60)::int
                                                      AS lead_minutes,
  total_qty,
  slot_type
FROM usable
WHERE prev_starting IS NOT NULL
  AND prev_seen_at IS NOT NULL
  AND starting <> prev_starting;

# Snozone frontend plan

Companion to `PLAN.md` in the `snozone-booking` repo (which covers collection).
This covers what megrob shows, now that the data is ours.

Status of what it builds on: the collector has been running in production since
2026-08-26 and is writing observations every 30 minutes. The admin Snozone tab
(collector health) is already built. Everything below is still to do.

---

## 1. The premise: we no longer ask Snozone anything

Phase 0's viewer proxied Snozone on every page load. That inverts. The browser
talks to megrob's API, which reads Postgres. Snozone is touched only by the
collector, at a fixed 7 requests per 30 minutes, regardless of how much anyone
browses.

Four consequences shape everything else:

- **Pages are fast and stay up.** A chart renders from a local query. Snozone
  being down, slow, or challenging us does not break the UI.
- **Browsing is free.** Opening a chart fifty times costs upstream nothing, so
  there is no tension between a nice interface and brief.md §7's "keep request
  rates human".
- **We can show history.** This is the real prize: Snozone's own API can only
  ever answer "right now". Every question worth asking — when do people book,
  which evenings fill — is answerable only from accumulated data, and only we
  have it.
- **Staleness is a non-issue.** Data is at most 30 minutes old, on a slope that
  fills over days.

---

## 2. Access

**Everything requires a megrob login.** No public surface.

This was considered and rejected: publishing the data publicly would sit badly
with brief.md §7 ("do not distribute the tool"), and the realistic outcome of
Snozone noticing is that they block the VPS — which ends collection of a dataset
that cannot be rebuilt. The asymmetry is stark: a shareable page is a nice-to-
have, the dataset is the whole point.

| Tier | Sees |
|---|---|
| Any signed-in user | Book page, Patterns page — all availability and analytics |
| Admin (`ADMIN_EMAILS`) | The above, plus Settings → Snozone: collector health, run ledger, failures |

Implementation note: `routes/snozone.ts` currently applies `adminOnly` to the
whole router. When the availability routes land, that gate moves off the router
and onto `/health` alone.

---

## 3. Two pages

Nav gains one entry, **Snozone**, with two tabs or sub-routes.

### 3.1 Book — "when should I go?"

The decision page. Opinionated, phone-first, minimal scrolling.

- **The pick.** Quietest slot in your window, ranked across the *presence
  window* (`start-15` to `start+70`) rather than the booked hour — phase 0
  established these are genuinely different (on 25 Aug the quietest instant
  after 16:00 was 18:45, the quietest booked hour 18:30, the quietest presence
  window 18:55). Surfaced as one line: "Book 18:55 · on the slope 18:40–20:05".
- **Date strip.** The next ~7 bookable dates, each with a one-glance busyness
  indicator and a sparkline of its shape.
- **Occupancy chart** for the selected date: people on the slope per 5-minute
  slot against the capacity line, with the pick ringed and its two nested bands
  (presence window, booked hour).
- **Slot table** underneath — the accessible, scannable fallback, and better
  than a chart on a small phone.
- **Honesty band.** For dates more than ~2 days out, occupancy is near-zero
  because it reports *bookings so far, not expected attendance* (brief §10.5a).
  Until the forecast exists (§5), the page must say so rather than presenting a
  confident pick built on four bookings.

### 3.2 Patterns — "what is this slope like?"

The payoff page, and the one that gets better every week.

- **Busyness heatmap**: day-of-week × time-of-day, median final occupancy, and a
  fill-fraction variant (`final_on_slope / total_qty`) which is fairer when
  capacity varies.
- **Booking-time heatmap**: when bookings are *made*, hour-of-week. This is the
  answer to research question 1 and nothing else can produce it.
- **Lead-time distribution**: how far ahead people book, with the truncation
  stated (§5).
- **Fill curves**: occupancy against hours-before-start for a chosen date, with
  previous same-weekday dates ghosted behind. The chart that makes "is my slot
  contested" obvious at a glance.
- **Trend**: weekly/monthly peaks, and `slot_type` (Summer Peak / Off Peak) as
  an overlay — Snozone's own demand model, useful as a sanity check on ours.

### 3.3 Settings → Snozone (built)

Admin only. Collector health, run ledger, per-date coverage. Its job is making
*silence* legible: a collector that has stopped produces no errors and no rows.

---

## 4. API surface

All under `/api/snozone`, all behind `authMiddleware`, all reading Postgres.

| Route | Returns | Source |
|---|---|---|
| `GET /dates` | Bookable dates from the latest successful run | observations |
| `GET /days/:date` | Latest observation per slot + summary | observations |
| `GET /days/:date/history` | Every observation for a date | observations |
| `GET /recommend?date&after&session&early&stay` | Ranked slots + the pick | observations |
| `GET /analytics/busyness?from&to` | dow × time-of-day occupancy | finals |
| `GET /analytics/booking-times?from&to` | Hour-of-week booking counts | booking events |
| `GET /analytics/lead-times?from&to` | Lead-time buckets | booking events |
| `GET /analytics/trend?from&to` | Weekly/monthly peaks and totals | finals |
| `GET /health` | Collector status (**admin only**) | runs (built) |

Two design points:

- **The recommendation is computed server-side**, not in the browser as phase 0
  did. The presence-window ranking is the one genuinely subtle piece of logic in
  the project, and a future MCP tool ("when should I board this week?") should
  share it rather than reimplement it. Tunables (`after`, `session`, `early`,
  `stay`) are query parameters with phase 0's defaults (16:00, 60, 15, 10).
- **`snozone_booking_events` is a view**, not a table: `starting` diffed with
  `lag()` over `(product, session_date, slot_time)`, filtered to observations
  taken before slot start. Defining it once in SQL keeps every analytic honest
  about the §6 trap — diffing headcount instead of `starting` counts each
  booking thirteen times.

---

## 5. What is meaningful when

**This is the part to design around.** Most of these views are not worth
rendering yet, and a chart drawn from two days of data is worse than no chart —
it invites conclusions the data cannot support.

| View | Needs | Realistically |
|---|---|---|
| Occupancy for a date | Hours | Now |
| Fill curve, one date | A full D-2 → D lifecycle | ~3 days |
| Booking time-of-day | Enough events to see a shape | 1–2 weeks |
| Booking day-of-week | Several samples per weekday | 3–4 weeks |
| Busyness by dow × time | 6–8 samples per weekday | 4–6 weeks |
| Forecast / confident pick for future dates | Fill curves per weekday | 6–8 weeks |
| Seasonal shift | Months either side of a change | 6–12 months |

So: **every analytic declares a minimum, and renders an honest empty state
below it** — "Not enough data yet. Needs about four more weeks of collection."
with a progress indicator, rather than a misleading chart. This is a real
component (`<InsufficientData needs={...} have={...} />`), not a nicety.

It also sets the build order: the Book page is buildable and useful now; the
Patterns page can be built as a shell with real empty states, and each chart
switched on as its threshold is met.

### 5.1 Opening hours vary by day — normalise before comparing

Observed in production on 2026-08-26, across the only three dates collected so far:

| Date | Day | Slots | Open |
|---|---|---|---|
| 2026-08-26 | Wed | 121 | 10:00–20:00 |
| 2026-08-27 | Thu | 121 | 10:00–20:00 |
| 2026-08-28 | Fri | **133** | 10:00–**21:00** |

Friday runs an hour later: 133 − 121 = 12 extra five-minute slots, exactly one more hour.
`PLAN.md` §14 raised this as a *seasonal* question ("does the winter timetable change opening
hours?"). It is not seasonal — **it varies day to day, right now**, and it is the norm rather
than the exception.

This is benign for a single date's chart, whose axis scales to whatever that date offers.
It is a trap for everything that compares dates:

- **Never compare per-day totals** — daily bookings, daily peak, "how busy was Friday" —
  without dividing by open hours. Friday will otherwise look busier simply for being longer,
  and the day-of-week heatmap would confidently report a pattern that is partly just the
  timetable.
- **A heatmap cell is one of three things, not two**: busy, quiet, or *closed*. Render
  "closed" visually distinct from "no bookings". A blank cell that means "shut" and a blank
  cell that means "empty slope" invite opposite conclusions.
- **Side-by-side date comparisons need a shared axis** with the non-open region explicitly
  marked, rather than two charts of different widths silently rescaled to the same box.
- **Fill curves are unaffected** — they plot a single slot against lead time, so opening
  hours never enter.
- **Assume nothing about 121 slots or 10:00–20:00.** No constant, axis or test fixture may
  hardcode either. The database schema already assumes nothing; the charts must match.

Related, and checked rather than assumed: the collector's §12.2 validation rejects a reading
whose slot count collapses below half the previous. A legitimate 133 → 121 change is a 9%
drop, comfortably clear of that threshold, so ordinary timetable variation will not be
mistaken for a broken response.

---

## 6. Charting: hand-rolled, zero new dependencies

- **Occupancy / fill-curve line charts**: port phase 0's SVG chart
  (`snozone-booking/public/app.js:257-405`) to
  `components/molecules/OccupancyChart.tsx` — presentational, props
  `{ points, capacity, highlight, bands }`. It already works and is already
  tuned; ~150 lines.
- **Heatmaps**: a CSS grid of coloured cells. No library can do this more simply
  than `grid-template-columns` and a colour scale.
- **Sparklines**: a single inline `<path>`.

No chart library. Beyond keeping the bundle small, megrob's convention (from
`mcp-server-plan.md:197`) is that new dependencies must be pinned exactly
because Coolify builds `backend/` in isolation and re-resolves caret ranges —
avoidable friction for something we can draw ourselves.

**Mobile is the primary target.** A day is ~125 five-minute slots; at 375px that
is 3px per point. Therefore: `viewBox` scaling with `preserveAspectRatio`, a
touch-friendly crosshair, and on narrow screens either an hourly aggregation or
a horizontally scrollable chart inside its own overflow container — never a
horizontally scrolling *page*. The slot table is the fallback and is often the
better answer on a phone.

**Accessibility**: every chart pairs with a real `<table>` (visually hidden or
in a toggle), the crosshair is keyboard-navigable, and colour is never the sole
carrier of meaning — the heatmap cells carry text values too.

---

## 7. Caching

Data changes at most every 30 minutes, so:

- TanStack Query `staleTime`: 5 minutes for availability, 1 hour for analytics.
- `Cache-Control` on analytics responses; they are recomputed nightly at most.
- The heavy aggregations read `snozone_slot_finals` (~44k rows/year), not the
  raw observations, which is precisely why that rollup exists.
- No "refresh from Snozone" button on the availability views. If an on-demand
  poll is ever wanted, it enqueues a pg-boss job rather than calling upstream
  inline — the API must never become a proxy to Snozone again.

---

## 8. Work items

**F. Availability API + Book page** *(buildable now)*
1. Move `adminOnly` off the router onto `/health`; add availability routes.
2. `services/snozoneAvailabilityService.ts` — latest-per-slot, history, dates.
3. `services/snozoneRecommendService.ts` — presence-window ranking, ported from
   phase 0's `app.js` with its tunables as parameters. Unit-tested against the
   phase 0 fixtures, which have known-correct answers.
4. Port `OccupancyChart` to React. Presentational, no data fetching.
5. `SnozonePage` → Book tab: pick, date strip, chart, slot table, honesty band.

**G. Analytics API + Patterns page** *(shell now, charts as data matures)*
6. `snozone_booking_events` view + migration.
7. `services/snozoneAnalyticsService.ts` — busyness, booking-times, lead-times,
   trend. All bucketed with `AT TIME ZONE 'Europe/London'` (PLAN.md §12.3).
8. `<InsufficientData>` and the per-analytic minimums from §5.
9. Heatmap and fill-curve components.
10. Patterns tab assembling them.

**H. Forecast** *(needs ~6–8 weeks of data)*
11. Median fill-curve baseline per (weekday, slot, season); predicted final
    occupancy = observed now + expected remaining for that lead time.
12. Feed it into the Book page pick so future dates stop tying at zero, and
    retire the §3.1 honesty band.

**I. Optional**
13. MCP tool `get_snozone_busyness`, reusing the recommend service.
14. Revisit brief §5.5's booking scheduler — by then the data will have said
    whether the slot is ever actually contested.

---

## 9. Open questions

- Does the free weekly entitlement use a different `prodid`? (brief §10.6) If
  so, the Book page may be ranking the wrong product's availability, though the
  busyness analysis is unaffected.
- Does the winter timetable change slot granularity or opening hours? The schema
  assumes nothing, but the charts currently assume a single contiguous day.
- Should the Book page's tunables (after-hour, session length, early/stay
  minutes) be per-user saved settings, or URL state? Per-user is nicer but adds
  a table; URL state is free and shareable.

ALTER TABLE "snozone_slot_finals" ADD COLUMN "peak_from_prior" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "snozone_slot_finals" ADD COLUMN "first_seen_from_prior" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Existing rows predate the two columns, so their decomposition would read as
-- "all of the peak was people starting here" — wrong, and wrong in the
-- direction the analytics are most sensitive to (carry-over is ~96% of slope
-- headcount in the collected data). Finals is a rederivable cache, never a
-- source of truth, so the honest fix is to drop the stale rows and let the
-- rollup rebuild them rather than ship a plausible-looking zero.
--
-- The nightly job only recomputes the last seven days; to rebuild further back
-- call rollupFinals(from, to) directly over the wider range.
DELETE FROM "snozone_slot_finals";

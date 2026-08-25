CREATE TABLE "snozone_poll_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_row_id" integer NOT NULL,
	"mode" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"dates_polled" text[],
	"dates_skipped" text[],
	"horizon_length" integer,
	"slots_seen" integer,
	"changes_written" integer,
	"http_calls" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "snozone_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"location_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"prime_body" text NOT NULL,
	"session_minutes" integer DEFAULT 60 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "snozone_products_unique" UNIQUE("location_id","product_id","qty")
);
--> statement-breakpoint
CREATE TABLE "snozone_slot_finals" (
	"product_row_id" integer NOT NULL,
	"session_date" date NOT NULL,
	"slot_time" text NOT NULL,
	"final_on_slope" integer NOT NULL,
	"final_starting" integer NOT NULL,
	"total_qty" integer NOT NULL,
	"peak_on_slope" integer NOT NULL,
	"first_seen_on_slope" integer NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"slot_type" text,
	"price" numeric(8, 2),
	"observation_count" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snozone_slot_finals_product_row_id_session_date_slot_time_pk" PRIMARY KEY("product_row_id","session_date","slot_time")
);
--> statement-breakpoint
CREATE TABLE "snozone_slot_observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"product_row_id" integer NOT NULL,
	"session_date" date NOT NULL,
	"slot_time" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"prev_seen_at" timestamp with time zone,
	"starting" integer NOT NULL,
	"from_prior" integer NOT NULL,
	"on_slope" integer NOT NULL,
	"qty_available" integer NOT NULL,
	"total_qty" integer NOT NULL,
	"available" boolean NOT NULL,
	"sold_out" boolean NOT NULL,
	"blocked" boolean NOT NULL,
	"low_availability" boolean NOT NULL,
	"call_to_book" boolean NOT NULL,
	"reason" text,
	"price" numeric(8, 2),
	"slot_type" text,
	"experience" text,
	"expired_when_seen" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "snozone_poll_runs" ADD CONSTRAINT "snozone_poll_runs_product_row_id_snozone_products_id_fk" FOREIGN KEY ("product_row_id") REFERENCES "public"."snozone_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snozone_slot_finals" ADD CONSTRAINT "snozone_slot_finals_product_row_id_snozone_products_id_fk" FOREIGN KEY ("product_row_id") REFERENCES "public"."snozone_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snozone_slot_observations" ADD CONSTRAINT "snozone_slot_observations_run_id_snozone_poll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."snozone_poll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snozone_slot_observations" ADD CONSTRAINT "snozone_slot_observations_product_row_id_snozone_products_id_fk" FOREIGN KEY ("product_row_id") REFERENCES "public"."snozone_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snozone_poll_runs_started_idx" ON "snozone_poll_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "snozone_obs_slot_idx" ON "snozone_slot_observations" USING btree ("product_row_id","session_date","slot_time","observed_at");--> statement-breakpoint
CREATE INDEX "snozone_obs_observed_idx" ON "snozone_slot_observations" USING btree ("observed_at");
--> statement-breakpoint
-- Seed the single product the collector starts with: Snowboard 1 hour Lift
-- pass: Adult, at Yorkshire/Castleford (brief.md §10.1). Appended by hand to
-- the generated DDL so production gets it through the existing db:migrate CI
-- path; drizzle-kit will not reproduce it if this migration is regenerated.
--
-- prime_body is the urlencoded buildSessionGroup.php payload that puts the
-- product into the PHP session. Without it both endpoints return [] with HTTP
-- 200 (brief.md §10.2). To add another product, insert another row — no schema
-- change is needed.
INSERT INTO "snozone_products"
  ("label", "location_id", "category_id", "product_id", "qty", "prime_body", "session_minutes", "active")
VALUES
  ('Yorkshire — Snowboard 1 hour Lift pass: Adult', 2, 1545, 818, 1,
   'locationId=2&818%5Bname%5D=Snowboard+1+hour+Lift+pass%3A+Adult&818%5Bprodid%5D=818&818%5Blocationid%5D=2&818%5BselectedDate%5D=&818%5Bqty%5D=1&meetsPrerequisites=1',
   60, true)
ON CONFLICT ON CONSTRAINT "snozone_products_unique" DO NOTHING;

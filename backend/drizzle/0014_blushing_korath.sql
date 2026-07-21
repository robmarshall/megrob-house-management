CREATE TABLE "nutrition_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"height_cm" integer,
	"weight_kg" numeric,
	"date_of_birth" date,
	"sex" text,
	"activity_level" text,
	"goal" text DEFAULT 'maintain' NOT NULL,
	"override_calories_kcal" integer,
	"override_protein_g" integer,
	"override_carbs_g" integer,
	"override_fat_g" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nutrition_profiles_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "nutrition_profiles" ADD CONSTRAINT "nutrition_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
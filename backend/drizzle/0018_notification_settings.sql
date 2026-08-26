CREATE TABLE "notification_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"telegram_enabled" boolean DEFAULT false NOT NULL,
	"telegram_bot_token_cipher" text,
	"telegram_chat_id" text,
	"telegram_bot_username" text,
	"last_verified_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "notification_settings_singleton" CHECK ("notification_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
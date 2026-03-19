ALTER TYPE "public"."session_status" ADD VALUE 'synthesis_done';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "questions_asked" jsonb;
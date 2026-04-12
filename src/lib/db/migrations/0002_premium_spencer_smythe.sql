CREATE TYPE "public"."ai_mode" AS ENUM('generateObject', 'generateText', 'streamText');--> statement-breakpoint
CREATE TYPE "public"."model_tier" AS ENUM('fast', 'standard');--> statement-breakpoint
CREATE TYPE "public"."skill_type" AS ENUM('system-prompt', 'context-enrichment', 'instruction');--> statement-breakpoint
CREATE TABLE "ai_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"mode" "ai_mode" NOT NULL,
	"model" "model_tier" NOT NULL,
	"layers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"langfuse_prompt_name" text NOT NULL,
	"schema_slug" text,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_output_tokens" integer DEFAULT 1000 NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resilience" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"type" "skill_type" NOT NULL,
	"content" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "skills_slug_unique" UNIQUE("slug")
);

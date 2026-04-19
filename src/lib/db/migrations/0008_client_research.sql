CREATE TABLE "client_research" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"company_overview" text,
	"size_financials" text,
	"customers_markets" text,
	"pain_points" text,
	"recent_news" text,
	"fit_score" integer,
	"fit_score_rationale" text,
	"areas_of_expertise" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"products_and_services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_stakeholders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tech_stack" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"research_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"researched_at" timestamp with time zone,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fit_score_range" CHECK ("client_research"."fit_score" BETWEEN 1 AND 10)
);
--> statement-breakpoint
ALTER TABLE "client_research" ADD CONSTRAINT "client_research_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "ai_summary";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "profile";

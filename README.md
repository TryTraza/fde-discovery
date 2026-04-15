# FDE Discovery Tool

An internal tool for Field Discovery Engineers (FDEs) to manage client engagements, document business processes, capture shadowing sessions, and generate AI-powered synthesis and insights.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **UI:** shadcn/ui (New York style) + Tailwind CSS v4
- **Database:** Supabase (PostgreSQL) via Drizzle ORM
- **Auth:** Clerk (middleware-based, no Supabase RLS)
- **AI:** Vercel AI SDK + Anthropic Claude (per-user API keys)
- **Testing:** Vitest + Playwright
- **Deploy:** Vercel

## Prerequisites

- Node.js 20+
- A [Clerk](https://clerk.com) account with an application configured
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key (each user provides their own via Settings)

## Getting Started

1. **Clone the repo**

   ```bash
   git clone <repo-url>
   cd discovery_tool
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env.local` and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

   Required variables:

   | Variable | Description |
   |----------|-------------|
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
   | `CLERK_SECRET_KEY` | Clerk secret key |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
   | `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/` |
   | `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/` |
   | `DATABASE_URL` | Supabase connection string (Transaction mode) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

   > **Note:** There is no `ANTHROPIC_API_KEY`. Each user stores their own API key via the Settings page, saved in Clerk `privateMetadata`.

4. **Run database migrations**

   ```bash
   npx drizzle-kit push
   ```

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest once |
| `npm run type-check` | TypeScript type checking |

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Sign-in / sign-up pages
│   ├── (dashboard)/     # Protected pages (clients, processes, sessions)
│   └── api/             # API routes
├── components/
│   ├── ui/              # shadcn/ui components (auto-generated)
│   ├── layout/          # Sidebar, breadcrumb, research panel
│   └── shared/          # Reusable components
└── lib/
    ├── db/              # Drizzle schema, queries, types
    ├── ai/              # AI config, prompts, schemas
    ├── auth/            # Auth utilities (requireAdmin, requireAuth)
    ├── hooks/           # SWR hooks
    └── supabase/        # Supabase storage client
```

## Key Concepts

- **Per-user AI keys** -- Users provide their own Anthropic API key via Settings. There is no shared server key.
- **Per-feature model selection** -- Each AI feature (research, hypothesis, suggestions, synthesis, interview) can use a different Claude model, configurable per user.
- **Soft deletes** -- Records are never hard-deleted; a `deletedAt` timestamp is set instead.
- **Query layer** -- All database access goes through typed query functions in `lib/db/queries/`. No raw SQL.

## License

Private -- all rights reserved.


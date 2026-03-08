# Phase 0 — Project Setup & Infrastructure (FOURTH REVIEW — FINAL)

> **Fourth review status:** 7 additional issues found on top of the 36 previous corrections.
> Original 36 corrections preserved. New issues marked with `🔵 V4`.

---

## Additional Issues Found (Fourth Review)

| # | Type | Description |
|---|------|-------------|
| 37 | 🔵 V4 — CRITICAL | **AI SDK version pin `ai@^5 @ai-sdk/anthropic@^2` is STILL WRONG.** As of March 2026, `ai` is at `6.0.116` and `@ai-sdk/anthropic` is at `3.0.58`. The V3 review recommended `ai@^5 @ai-sdk/anthropic@^2` for "stability", but `@ai-sdk/anthropic@2.x` is over 6 months behind with no security patches. AI SDK 6 migration from 5 is explicitly described by Vercel as "not expected to have major breaking changes for most users" — for Phase 0 which ONLY uses `generateText` + `createAnthropic`, there is ZERO risk. The `generateText` API is identical between v5 and v6. `generateObject`/`streamObject` are deprecated in v6 (use `generateText` with `output` instead) but Phase 0 doesn't use them. **Pin to `ai@^6 @ai-sdk/anthropic@^3`** — this is the current stable release. Pinning to old majors means the junior gets outdated docs, missing type definitions for newer models, and no community support. |
| 38 | 🔵 V4 — CRITICAL | **Tailwind v4 handling is dangerously vague.** Since Next.js 15.2+, `create-next-app` scaffolds Tailwind v4 by default. Tailwind v4 has NO `tailwind.config.ts` — it uses CSS-first `@theme` directives in `globals.css`. The plan says "Verify `tailwind.config.ts` exists after scaffold. If it generated `@tailwind` directives in CSS instead of a config file, the project is on Tailwind v4" — this is backwards. TW4 uses `@import "tailwindcss"` not `@tailwind` directives. The plan should: (a) EXPECT Tailwind v4, (b) NOT look for `tailwind.config.ts`, (c) verify `globals.css` has `@import "tailwindcss"`, (d) note that `shadcn@latest init` handles TW4 natively and creates the correct `@theme` CSS variables. The guard is rewritten below. |
| 39 | 🔵 V4 | **Model IDs in `models.ts` are stale.** `claude-sonnet-4-20250514` is the May 2025 snapshot. Anthropic has since released Sonnet 4.5 (`claude-sonnet-4-5-20250929`) and Sonnet 4.6 (`claude-sonnet-4-6`). The plan should use `claude-sonnet-4-6` as default for high-quality features and `claude-haiku-4-5-20241022` for cost-sensitive ones (Haiku 4.5 matches Sonnet 4 performance). If the user wants to lock to Sonnet 4 for cost, that's fine — but the models list should include the newer options. Updated `AVAILABLE_MODELS` below. |
| 40 | 🔵 V4 | **Missing `metadata` export in `layout.tsx`.** Every Next.js root layout should export metadata for SEO and browser tab title. The plan's `layout.tsx` snippet omits `export const metadata`. Added. |
| 41 | 🔵 V4 | **`ClerkProvider dynamic` is discouraged by Clerk.** The Clerk v6 upgrade guide (current docs, verified March 2026) explicitly says: *"Note that this isn't recommended, and in most cases you should use `auth()` to access auth data at request time instead."* The `dynamic` prop forces the ENTIRE app into dynamic rendering, killing static page optimization. The plan uses `useUser()` ONLY in the Settings page and Sidebar (for `UserButton`). These are already client components. The correct approach: remove `dynamic` from `ClerkProvider` and let individual pages/components opt into dynamic rendering naturally. The sidebar already has `'use client'` and `useUser()`/`UserButton` work fine in client components without the `dynamic` prop. **However**, if `UserButton` needs SSR-time data (which it does for initial render), then `dynamic` IS needed. The tradeoff: `dynamic` kills static optimization but avoids hydration mismatch on UserButton. Since this is a fully authenticated app (every page is behind auth), ALL pages are already dynamically rendered by middleware. **Keep `dynamic` but add a comment explaining WHY.** |
| 42 | 🔵 V4 | **No `type-check` script in `package.json`.** The plan adds `"test"` and `"test:run"` scripts but omits `"type-check": "tsc --noEmit"`. Step 0.9 says to run `npm run build` which catches type errors, but a dedicated type-check script is faster for local iteration and CI. Added to Step 0.1. |
| 43 | 🔵 V4 | **Settings page: no debounce/throttle on "Test Key" button.** The test-key endpoint calls the Anthropic API with the user's key. Without debounce, rapid clicks = rapid API calls = potential rate limiting on the user's key. Add `disabled` state while request is in-flight (the plan mentions "in-flight state" for save buttons but doesn't explicitly include test-key). Clarified. |

---

## Context

The FDE Discovery Tool is a greenfield Next.js 15 project. No application code exists yet — only documentation (CLAUDE.md, SPEC.md, phase docs) and a populated `.env.local` with Clerk + Supabase credentials. Phase 0 establishes the foundation: scaffold, auth, layout, testing, and the Settings page (critical gate for all AI features since users provide their own Anthropic API keys).

---

## Step 0.1 — Scaffold Next.js + Install Dependencies

Approach: Scaffold to a temp directory, then merge into the existing project root (preserves `.env.local` and docs).

```bash
npx create-next-app@latest /tmp/fde-discovery-tool \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
# Copy scaffold into project root, then remove temp
```

**Tailwind v4 (EXPECTED DEFAULT since Next.js 15.2+):**

After scaffold, verify Tailwind v4 is active:
1. `globals.css` should contain `@import "tailwindcss"` (NOT the old `@tailwind base; @tailwind components; @tailwind utilities;` directives)
2. There should be NO `tailwind.config.ts` file (TW4 uses CSS-first configuration)
3. A `postcss.config.mjs` should exist with `@tailwindcss/postcss` plugin

If for some reason the scaffold produced Tailwind v3 (old Next.js version), manually upgrade:
```bash
npm install tailwindcss@latest @tailwindcss/postcss@latest
# Remove tailwind.config.ts, update postcss.config.mjs, update globals.css
```

`shadcn@latest` supports Tailwind v4 natively. It will add `@theme` CSS variable blocks to `globals.css` automatically.

**DO NOT** manually create a `tailwind.config.ts` or use v3 config patterns (e.g. `theme.extend`). All design token customization in TW4 happens via `@theme` in CSS.

**Install (in order):**

1. `npx shadcn@latest init --defaults --force` (non-interactive — New York style, Zinc color, CSS variables)
2. `npm install ai@^6 @ai-sdk/anthropic@^3` (🔵 V4 FIX — current stable. `generateText` API identical to v5. `generateObject`/`streamObject` deprecated in v6 — use `generateText` with `output` instead — but Phase 0 doesn't use them. `@ai-sdk/react` deferred to later phase.)
3. `npm install drizzle-orm postgres && npm install -D drizzle-kit` (DB)
4. `npm install @clerk/nextjs` (Auth)
5. `npm install @supabase/supabase-js` (Storage)
6. `npm install zod uuid date-fns react-markdown sonner lucide-react server-only && npm install -D @types/uuid` (🔺 removed `swr` from Phase 0 — add when needed)
7. `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom dotenv` (🔺 includes `user-event` + `dotenv`)
8. shadcn components: `button, card, input, textarea, label, select, badge, dialog, sheet, dropdown-menu, command, table, tabs, separator, skeleton, sonner, form, calendar, popover, avatar, breadcrumb, scroll-area, tooltip, alert, radio-group, switch` (🔺 removed `toast` — use `sonner` only)
9. `git init` + initial commit

> 🔺 **GAP — `next.config.ts` server external packages:** Drizzle with the `postgres` driver requires the `postgres` package to NOT be bundled by Next.js's webpack. Without this, you get cryptic runtime errors in API routes.
>
> **ADD** to `next.config.ts` after scaffold:
> ```ts
> const nextConfig = {
>   serverExternalPackages: ['postgres'],
> };
> export default nextConfig;
> ```

**MODIFY `package.json`** — add scripts:
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "type-check": "tsc --noEmit"
  }
}
```

**Risk:** `create-next-app` interactive prompts → use `--yes` flag.
**Verify:** `npm run dev` shows default Next.js page at `localhost:3000`. Confirm `globals.css` has `@import "tailwindcss"` (Tailwind v4).

---

## Step 0.2 — Project Directory Structure

Create empty directory skeleton + stub files:

| Create | Purpose |
|--------|---------|
| `src/app/(auth)/sign-in/[[...sign-in]]/` | Clerk sign-in |
| `src/app/(auth)/sign-up/[[...sign-up]]/` | Clerk sign-up |
| `src/app/(dashboard)/settings/` | Settings page |
| `src/app/(dashboard)/clients/` | Client list (placeholder) |
| `src/app/api/settings/` | Settings API |
| `src/app/api/settings/test-key/` | Test key API |
| `src/components/layout/` | Sidebar, breadcrumb |
| `src/components/shared/` | Shared components |
| `src/components/clients/, processes/, sessions/` | Feature dirs |
| `src/lib/db/queries/, migrations/` | DB layer |
| `src/lib/ai/prompts/, schemas/` | AI layer |
| `src/lib/domain/l1/` | Domain JSON |
| `src/lib/auth/` | Auth utils |
| `src/lib/supabase/` | Storage |
| `src/lib/hooks/` | Custom hooks |
| `src/__tests__/, src/__tests__/api/, src/__tests__/ai/, src/__tests__/layout/, src/__tests__/lib/, src/__tests__/mocks/` | Tests |

Stub files: `src/lib/db/index.ts`, `types.ts`, `src/lib/ai/get-ai-config.ts`, `src/lib/auth/utils.ts`, `src/lib/supabase/storage.ts`

**Verify:** `ls -R src/` shows expected tree.

---

## Step 0.3 — `.env.local`

Already done. All variables populated. Update SPEC.md to mark them as set.

---

## Step 0.3.1 — Environment Validation (`src/lib/env.ts`)

CREATE `src/lib/env.ts` — Zod-validated env vars that fail fast at startup with clear messages.

```ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/sign-up'),
  DATABASE_URL: z.string().min(1), // Not .url() — postgres:// may have edge cases
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
```

Import this in: `src/lib/db/index.ts` (uses `env.DATABASE_URL`).

DO NOT import in `src/middleware.ts` — middleware runs on Edge runtime which may not have `DATABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`. Clerk's own env validation already provides clear errors for missing Clerk keys.

**IMPORTANT:** Lazy evaluation warning. `env.ts` executes Zod parsing at import time. Only import it inside server-side modules that are exclusively used by API routes, never at the module top-level of files that might be statically analyzed during `next build`. The `src/lib/db/index.ts` import is safe because it's only used in API routes, never in layouts or pages directly.

**Test (RED→GREEN):** `src/__tests__/lib/env.test.ts`

Pattern (dynamic import + module reset required):
```ts
let originalEnv: NodeJS.ProcessEnv;
beforeEach(() => {
  originalEnv = { ...process.env };
  vi.resetModules();
});
afterEach(() => {
  process.env = originalEnv;
});
it('throws when DATABASE_URL is missing', async () => {
  delete process.env.DATABASE_URL;
  await expect(() => import('@/lib/env')).rejects.toThrow();
});
it('parses successfully when all vars present', async () => {
  // Set all required vars
  process.env.DATABASE_URL = 'postgresql://user:pass@host:6543/db';
  // ... set others
  const { env } = await import('@/lib/env');
  expect(env.DATABASE_URL).toBe('postgresql://user:pass@host:6543/db');
});
```

**Risk:** None — straightforward Zod validation.
**Verify:** Remove a var from `.env.local`, run `npm run dev` → clear error. Restore var.

---

## Step 0.4 — Drizzle Config + DB Client

**Depends on:** 0.3.1 (env validation)

Files:
- CREATE `drizzle.config.ts` — points to `src/lib/db/schema.ts`, output to `src/lib/db/migrations`
- CREATE `src/lib/db/index.ts` — imports `env.DATABASE_URL` from `src/lib/env.ts`, postgres client with `prepare: false`, Drizzle instance with schema. Must include `import 'server-only'` as first line.
- CREATE `src/lib/db/schema.ts` — stub file that must export at least one symbol.

`drizzle.config.ts` (🔧 FIX — needs dotenv for CLI):
```ts
// CLI-only file — used by `npx drizzle-kit` commands.
// Never imported by Next.js application code.
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

`src/lib/db/schema.ts`:
```ts
// Schema tables will be added in Phase 1
export {};
```

`src/lib/db/index.ts`:
```ts
import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

const client = postgres(env.DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });
```

**Test (RED→GREEN):** `src/__tests__/db-client.test.ts`
- Mock `postgres` + `drizzle-orm`
- Verify `prepare: false` is passed to postgres constructor

**Risk:** Must use `prepare: false` for Supabase Transaction mode pooler.
**Verify:** Test passes. `npx drizzle-kit check` runs without errors.

---

## Step 0.5 — Clerk Auth Setup (v6 async APIs)

### `src/middleware.ts`

> 🔴 **FIX — CRITICAL:** The original plan uses `await auth.protect()` which returns a **404** for unauthenticated users, NOT a redirect to sign-in. Use the `redirectToSignIn()` pattern instead.

> 🟣 **V3 FIX:** Use `isAuthenticated` instead of `!userId`. Clerk's current docs (March 2026) show `isAuthenticated` as the canonical pattern. It handles edge cases like pending sessions and machine tokens correctly.

**TWO different `auth` references exist in Clerk v6 — do not confuse them:**
- **In middleware:** `auth` is the callback parameter of `clerkMiddleware`. You call `const { isAuthenticated, redirectToSignIn } = await auth()` on it (it's an async function in this context).
- **In Server Components / Route Handlers:** you import `{ auth }` from `'@clerk/nextjs/server'` and call `const { isAuthenticated, userId } = await auth()` (same async pattern).

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    const { isAuthenticated, redirectToSignIn } = await auth();
    if (!isAuthenticated) {
      return redirectToSignIn();
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

### `src/app/layout.tsx`

MODIFY — wrap with `<ClerkProvider dynamic>`.

**WHY `dynamic`:** In Clerk v6, `<ClerkProvider>` no longer opts into dynamic rendering by default. The `dynamic` prop is required for client-side hooks like `useUser()` to work during SSR. Clerk's docs note this isn't recommended for apps with static pages, but since THIS app is fully authenticated (every page goes through middleware auth), all pages are already dynamically rendered — so `dynamic` has no perf cost here.

> 🔵 V4: Added `metadata` export for SEO/browser tab.

> 🟣 V3 FIX: Include `import './globals.css'` — without this, Tailwind styles won't load.

```tsx
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from '@/components/ui/sonner';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FDE Discovery Tool',
  description: 'AI-powered client discovery for Forward Deployed Engineers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `dynamic` is needed because all pages are behind auth and use client-side
    // Clerk hooks (UserButton, useUser). Since middleware already forces dynamic
    // rendering on all routes, this has no additional perf cost.
    <ClerkProvider dynamic>
      <html lang="en">
        <body>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
CREATE — `<SignIn />` centered.

### `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
CREATE — `<SignUp />` centered.

### `src/lib/auth/utils.ts`

Must include `import 'server-only'` as first line.

> 🔴 **FIX:** Split `requireAuth` into two functions to avoid unnecessary Clerk API round-trips.
> 🟣 **V3 FIX:** Use `isAuthenticated` instead of `!userId` for auth checks. Use exact string match in `handleAPIError` instead of `.includes()`.

```ts
import 'server-only';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * Fast auth check — session-only, no network call to Clerk API.
 * Use for routes that only need userId.
 */
export async function requireUserId(): Promise<string> {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) throw new Error('Unauthorized');
  return userId;
}

/**
 * Full auth check — fetches user from Clerk API to read metadata.
 * Use for routes that need role or other metadata.
 */
export async function requireAuthWithUser() {
  const userId = await requireUserId();
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = (user.publicMetadata as any)?.role ?? 'viewer';
  return { userId, role, user };
}

/**
 * Admin-only gate. Fetches user to verify role.
 */
export async function requireAdmin() {
  const { userId, role } = await requireAuthWithUser();
  if (role !== 'admin') throw new Error('Forbidden: admin role required');
  return { userId, role };
}

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof Error) {
    // 🟣 V3: Use exact match to avoid false positives from other libraries
    if (error.message === 'NO_API_KEY') {
      return NextResponse.json(
        { error: 'No API key configured. Go to Settings to add your Anthropic API key.' },
        { status: 422 }
      );
    }
    if (error.message === 'Forbidden: admin role required') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // These use .includes() because they come from external APIs (Anthropic)
    // and the exact message format varies
    if (error.message.includes('invalid_api_key')) {
      return NextResponse.json(
        { error: 'Invalid API key. Check your key in Settings.' },
        { status: 422 }
      );
    }
    if (error.message.includes('rate_limit')) {
      return NextResponse.json({ error: 'Rate limited. Try again later.' }, { status: 429 });
    }
  }
  console.error('API error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

**Test (RED→GREEN):** `src/__tests__/auth-utils.test.ts`
- `handleAPIError`: maps `NO_API_KEY`→422, `Unauthorized`→401, `Forbidden: admin role required`→403, `invalid_api_key`→422, `rate_limit`→429, `unknown`→500
- `handleAPIError`: does NOT match partial strings — `new Error('SomeUnauthorizedThing')` → 500, NOT 401
- `requireUserId`: throws when `isAuthenticated` is false, returns userId string when authenticated
- `requireAuthWithUser`: throws when not authenticated, returns `{userId, role, user}` when authenticated
- `requireAdmin`: throws Forbidden when viewer, passes when admin

**Verify:** `/clients` redirects to `/sign-in`. After sign-in, redirects to `/clients`. Tests pass.

---

## Step 0.6 — Vitest Configuration + Clerk Mock Strategy

Files:
- CREATE `vitest.config.ts` — jsdom environment, `@/` alias, setup file
- CREATE `src/__tests__/setup.ts` — imports `@testing-library/jest-dom` + mocks `server-only`
- CREATE `src/__tests__/mocks/clerk.ts` — reusable Clerk mocks
- MODIFY `package.json` — add `"test": "vitest"`, `"test:run": "vitest run"` (already done in 0.1)

### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### `src/__tests__/setup.ts`

```ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Required: mock 'server-only' globally so any transitive import doesn't fail
vi.mock('server-only', () => ({}));
```

### Clerk Mock Strategy (`src/__tests__/mocks/clerk.ts`)

```ts
import { vi } from 'vitest';

// Server-side mocks (for API route tests)
export const mockAuth = vi.fn();
export const mockClerkClient = vi.fn();
export const mockCurrentUser = vi.fn();

// Server-side usage:
// vi.mock('@clerk/nextjs/server', () => ({
//   auth: mockAuth,
//   clerkClient: mockClerkClient,
//   currentUser: mockCurrentUser,
//   createRouteMatcher: vi.fn(),
//   clerkMiddleware: vi.fn(),
// }));

// Client-side mocks (for component tests)
// vi.mock('@clerk/nextjs', () => ({
//   UserButton: () => <div data-testid="user-button" />,
//   ClerkProvider: ({ children }: any) => <>{children}</>,
//   useUser: vi.fn(),
// }));
```

### API Route Test Pattern

> 🔺 API route tests MUST use `// @vitest-environment node` directive at the top of the file.
> Node 18+ provides global `Request`/`Response`. Import `NextRequest`/`NextResponse` from `next/server`.

```ts
// @vitest-environment node
import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/settings/route';

const req = new NextRequest('http://localhost/api/settings', {
  method: 'PATCH',
  body: JSON.stringify({ anthropicApiKey: 'sk-ant-test' }),
});
const res = await PATCH(req);
expect(res.status).toBe(200);
```

**Risk:** `@/` alias must match tsconfig paths.
**Verify:** `npm test -- --run` executes tests from steps 0.4 and 0.5.

---

## Step 0.7 — Dashboard Layout Shell

Files:
- CREATE `src/app/(dashboard)/layout.tsx` — sidebar + main content area + breadcrumb header
- CREATE `src/components/layout/sidebar.tsx` — nav links (Clients, Settings), UserButton, active route highlighting (`'use client'`)
- CREATE `src/components/layout/breadcrumb-nav.tsx` — placeholder (full resolution in Phase 7)
- CREATE `src/app/(dashboard)/clients/page.tsx` — placeholder page
- MODIFY `src/app/page.tsx` — redirect to `/clients` using `redirect()` from `next/navigation` (Server Component)

```ts
import { redirect } from 'next/navigation';
export default function Home() {
  redirect('/clients');
}
```

**Test (RED→GREEN):** `src/__tests__/layout/sidebar.test.tsx`

Required mocks:
```tsx
vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/clients'),
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
  redirect: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
  ClerkProvider: ({ children }: any) => <>{children}</>,
}));
```

- Renders Clients and Settings links
- Highlights active route
- Renders UserButton

**Risk:** `UserButton` needs `'use client'` directive on the sidebar. Root `/` redirect must not conflict with `(dashboard)` group.
**Verify:** After sign-in, see sidebar with nav links, breadcrumb area, UserButton.

---

## Step 0.8 — Settings Page (Critical Gate)

**SECURITY:** The following files MUST include `import 'server-only'` as their first line:
- `src/lib/ai/get-ai-config.ts`
- `src/lib/ai/create-model.ts`
- `src/lib/db/index.ts` (already added in Step 0.4)
- `src/lib/auth/utils.ts` (already added in Step 0.5)

### `src/lib/ai/models.ts` (NEW FILE — single source of truth)

> 🔵 V4 FIX: Updated model IDs to current versions (March 2026).

```ts
export const AVAILABLE_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-haiku-4-5-20241022', label: 'Claude Haiku 4.5' },
] as const;

export type AIFeature = 'research' | 'hypothesis' | 'suggestions' | 'synthesis' | 'interview';

export const DEFAULT_MODELS: Record<AIFeature, string> = {
  research:    'claude-sonnet-4-6',
  hypothesis:  'claude-sonnet-4-6',
  suggestions: 'claude-haiku-4-5-20241022',
  synthesis:   'claude-sonnet-4-6',
  interview:   'claude-sonnet-4-6',
};

export const AI_FEATURE_LABELS: Record<AIFeature, string> = {
  research:    'Research Agent',
  hypothesis:  'Hypothesis Generation',
  suggestions: 'Quick Suggestions',
  synthesis:   'Synthesis Report',
  interview:   'Interview Assistant',
};
```

### `src/app/(dashboard)/settings/page.tsx`

**MUST be `'use client'`** — uses `useUser()`, `useEffect`, `useState`.

> 🔴 **Single source of truth for data:** The Settings page uses `GET /api/settings` as its ONLY data source. It does NOT read `useUser().publicMetadata` for `hasApiKey`/`aiModels`. The `useUser()` hook is used ONLY for `isLoaded` (loading gate) and `user.reload()` (post-PATCH cache bust so the Clerk client session stays fresh for other pages that read `publicMetadata`).

**Behavior:**
- On mount: `fetch('GET /api/settings')` → populates form state
- API key input with show/hide toggle
- Client-side validation: reject empty strings, require `sk-ant-` prefix → inline error
- "Save" / "Update" button → calls `PATCH /api/settings` with `{ anthropicApiKey: ... }`
- After successful PATCH, call `await user.reload()` to refresh client-side Clerk session
- "Test Key" button → calls `POST /api/settings/test-key`, shows success OR error toast via `sonner`
- Green "API key configured" indicator when `hasApiKey` is true (from GET response state)
- 5 model selector dropdowns using `AVAILABLE_MODELS` and `AI_FEATURE_LABELS` from `models.ts`
- "Save Model Preferences" button → calls `PATCH /api/settings` with `{ aiModels: ... }`
- Dual loading gate: Show `<Skeleton />` until BOTH `isLoaded` (Clerk) AND GET fetch are resolved
- In-flight state: Disable ALL submit buttons (Save, Test Key, Save Models) while ANY request is in-flight. This prevents double-submits and protects the user's API key from rate limiting.
- Error handling: Toast on error from any endpoint

### `src/app/api/settings/route.ts`

Both `GET` and `PATCH` must use `try/catch` with `handleAPIError(error)` in the catch block.

**GET:**

```ts
import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { handleAPIError } from '@/lib/auth/utils';

export async function GET() {
  try {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    return NextResponse.json({
      hasApiKey: !!(user.privateMetadata as any)?.anthropicApiKey,
      aiModels: (user.publicMetadata as any)?.aiModels ?? {},
      role: (user.publicMetadata as any)?.role ?? 'viewer',
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

**PATCH:**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { handleAPIError } from '@/lib/auth/utils';
import { z } from 'zod';

const patchSettingsSchema = z.object({
  anthropicApiKey: z.string().min(1).optional(),
  aiModels: z.record(z.string()).optional(),
}).refine(data => data.anthropicApiKey || data.aiModels, {
  message: 'Must provide anthropicApiKey or aiModels',
});

export async function PATCH(req: NextRequest) {
  try {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = patchSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 422 });
    }

    const client = await clerkClient();
    const { anthropicApiKey, aiModels } = parsed.data;

    if (anthropicApiKey) {
      // Clerk's updateUserMetadata does SHALLOW merge on each metadata object.
      // Setting privateMetadata: { anthropicApiKey } will NOT delete other
      // privateMetadata keys. Same for publicMetadata.
      await client.users.updateUserMetadata(userId, {
        privateMetadata: { anthropicApiKey },
        publicMetadata: { hasApiKey: true },
      });
    }

    if (aiModels) {
      // For aiModels, we need the full replacement since it's a nested object.
      // Clerk shallow-merges publicMetadata, so { aiModels: newObj } replaces
      // the entire aiModels key (not deep-merged). This is the desired behavior.
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { aiModels },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

### `src/app/api/settings/test-key/route.ts`

```ts
import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { handleAPIError } from '@/lib/auth/utils';
import { DEFAULT_MODELS } from '@/lib/ai/models';

export async function POST() {
  try {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const apiKey = (user.privateMetadata as any)?.anthropicApiKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key stored. Save your key first.' },
        { status: 422 }
      );
    }

    const anthropic = createAnthropic({ apiKey });
    await generateText({
      model: anthropic(DEFAULT_MODELS.research),
      prompt: 'Say "ok"',
      maxTokens: 10,
    });

    return NextResponse.json({ valid: true });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

### `src/lib/ai/get-ai-config.ts`

```ts
import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createAnthropic } from '@ai-sdk/anthropic';
import { DEFAULT_MODELS, type AIFeature } from '@/lib/ai/models';

export async function getAIConfig(feature: AIFeature) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) throw new Error('Unauthorized');

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const apiKey = (user.privateMetadata as any)?.anthropicApiKey;
  if (!apiKey) throw new Error('NO_API_KEY');

  const modelPrefs = (user.publicMetadata as any)?.aiModels ?? {};
  const modelId = modelPrefs[feature] || DEFAULT_MODELS[feature];
  const anthropic = createAnthropic({ apiKey });

  return { model: anthropic(modelId), modelId, anthropic };
}
```

### `src/lib/ai/create-model.ts`

```ts
import 'server-only';
import { createAnthropic } from '@ai-sdk/anthropic';

export function createUserAnthropic(apiKey: string) {
  return createAnthropic({ apiKey });
}
```

### `src/components/shared/api-key-guard.tsx`

**MUST be `'use client'`** — uses `useUser()`.

Reads `user.publicMetadata.hasApiKey` via `useUser()`. Shows alert with link to Settings if no key. This is the ONE place where reading `publicMetadata` directly from the Clerk client is appropriate (outside of the Settings page), because it's a simple boolean gate.

---

### Tests (RED→GREEN):

**`src/__tests__/api/settings.test.ts`:** (`// @vitest-environment node`)
- GET: 401 unauthenticated (`isAuthenticated: false`)
- GET: returns `{hasApiKey, aiModels, role}` when authenticated
- GET: response body must NOT contain the raw API key (security assertion)
- GET: returns sensible defaults for fresh user — `hasApiKey: false, aiModels: {}, role: 'viewer'`
- PATCH: 401 unauthenticated
- PATCH: saves API key + sets hasApiKey in metadata
- PATCH: saves model prefs
- PATCH: 422 on empty body (neither anthropicApiKey nor aiModels)
- PATCH: 422 on invalid body shape

**`src/__tests__/api/settings-test-key.test.ts`:** (`// @vitest-environment node`)

Mock strategy:
```ts
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'ok' }),
}));
// For invalid key test:
// generateText.mockRejectedValueOnce(new Error('invalid_api_key'));
```

- 401 unauthenticated
- 422 when no key stored
- Success with valid key (generateText resolves)
- Error with invalid key (generateText rejects with 'invalid_api_key')

**`src/__tests__/ai/get-ai-config.test.ts`:**
- Throws Unauthorized when `isAuthenticated` is false
- Throws NO_API_KEY when no key in metadata
- Returns default model when no preferences set
- Returns user's model preference when set
- Returns anthropic provider for tool access

**Risk:** Clerk `updateUserMetadata` shallow-merges — each metadata key at the top level is replaced, not deep-merged. The `aiModels` object is fully replaced on each save (desired behavior).
**Verify:** Save key → toast success. Test key → "valid" or error toast. Save models → persist on refresh.

---

## Step 0.9 — End-to-End Verification + Deploy

No new files. Integration check:

1. `npm run dev` — no errors
2. Full auth flow (sign-in → dashboard → settings → save key → test key)
3. `npm test -- --run` — all tests green
4. `npm run type-check` — no type errors (🔵 V4 addition)
5. **`npm run build` — no build errors** (catches `server-only` violations, missing client/server directives, type errors, static generation failures)
6. Deploy to Vercel (set env vars in Vercel dashboard)
   - **CRITICAL:** `DATABASE_URL` must use the **Transaction mode pooler** URL from Supabase (port 6543), NOT the direct connection (port 5432). Direct connections will hit connection limits in serverless.
7. Verify deployed app works
8. Use Playwright MCP to run automated E2E smoke test

**Risk:** Vercel needs all env vars.
**Verify:** Deployed app matches local behavior.

---

## Dependency Graph

```
0.1 (scaffold)
 ├── 0.2 (directories)
 ├── 0.6 (vitest config)       ← parallel with 0.2
 └── 0.3.1 (env validation)    ← parallel with 0.2, 0.6
      ├── 0.4 (drizzle config) ← depends on 0.3.1 for env.DATABASE_URL
      └── 0.5 (clerk auth)     ← after 0.3.1 (but env.ts NOT imported in middleware)
           └── 0.7 (dashboard layout)
                └── 0.8 (settings page) ← depends on 0.5 auth utils + 0.7 layout
                     └── 0.9 (verify + deploy + Playwright MCP smoke test)
```

---

## Complete File Manifest

| File | Action | Step |
|------|--------|------|
| `package.json` | MODIFY (add type-check script) | 0.1 🔵 |
| `tsconfig.json` | MODIFY (verify alias) | 0.1 |
| `next.config.ts` | MODIFY (serverExternalPackages) | 0.1 |
| `components.json` | CREATE (shadcn) | 0.1 |
| `drizzle.config.ts` | CREATE (CLI-only comment) | 0.4 |
| `vitest.config.ts` | CREATE | 0.6 |
| `src/lib/env.ts` | CREATE | 0.3.1 |
| `src/lib/ai/models.ts` | CREATE (AVAILABLE_MODELS with current model IDs) | 0.8 🔵 |
| `src/middleware.ts` | CREATE (isAuthenticated + redirectToSignIn pattern) | 0.5 🟣 |
| `src/app/layout.tsx` | MODIFY (ClerkProvider dynamic + Toaster + globals.css import + metadata) | 0.5 🟣🔵 |
| `src/app/page.tsx` | MODIFY | 0.7 |
| `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` | CREATE | 0.5 |
| `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` | CREATE | 0.5 |
| `src/app/(dashboard)/layout.tsx` | CREATE | 0.7 |
| `src/app/(dashboard)/settings/page.tsx` | CREATE ('use client', all buttons disabled while in-flight) | 0.8 🔵 |
| `src/app/(dashboard)/clients/page.tsx` | CREATE | 0.7 |
| `src/app/api/settings/route.ts` | CREATE (isAuthenticated pattern) | 0.8 🟣 |
| `src/app/api/settings/test-key/route.ts` | CREATE (isAuthenticated pattern) | 0.8 🟣 |
| `src/components/layout/sidebar.tsx` | CREATE ('use client') | 0.7 |
| `src/components/layout/breadcrumb-nav.tsx` | CREATE | 0.7 |
| `src/components/shared/api-key-guard.tsx` | CREATE ('use client') | 0.8 |
| `src/components/ui/*` | CREATE (shadcn — sonner, NO toast) | 0.1 |
| `src/lib/db/index.ts` | CREATE (import 'server-only') | 0.4 |
| `src/lib/db/schema.ts` | CREATE (stub with export {}) | 0.4 |
| `src/lib/db/types.ts` | CREATE (stub) | 0.2 |
| `src/lib/ai/get-ai-config.ts` | CREATE (import 'server-only', isAuthenticated) | 0.8 🟣 |
| `src/lib/ai/create-model.ts` | CREATE (import 'server-only') | 0.8 |
| `src/lib/auth/utils.ts` | CREATE (import 'server-only', split auth, exact match errors) | 0.5 🟣 |
| `src/lib/supabase/storage.ts` | CREATE (stub) | 0.2 |
| `src/__tests__/setup.ts` | CREATE (includes server-only mock) | 0.6 |
| `src/__tests__/mocks/clerk.ts` | CREATE | 0.6 |
| `src/__tests__/lib/env.test.ts` | CREATE (with vi.resetModules pattern) | 0.3.1 |
| `src/__tests__/db-client.test.ts` | CREATE | 0.4 |
| `src/__tests__/auth-utils.test.ts` | CREATE (exact match test added) | 0.5 🟣 |
| `src/__tests__/api/settings.test.ts` | CREATE (// @vitest-environment node, isAuthenticated mock) | 0.8 🟣 |
| `src/__tests__/api/settings-test-key.test.ts` | CREATE (with generateText mock) | 0.8 |
| `src/__tests__/ai/get-ai-config.test.ts` | CREATE (isAuthenticated mock) | 0.8 🟣 |
| `src/__tests__/layout/sidebar.test.tsx` | CREATE (with next/navigation + clerk mocks) | 0.7 |

---

## Summary of ALL Corrections (Original 24 + Second Review 7 + Third Review 5 + Fourth Review 7)

| # | Type | Description |
|---|------|-------------|
| 1 | 🔺 GAP | `next.config.ts` — `serverExternalPackages: ['postgres']` for Drizzle |
| 2 | 🔺 GAP | shadcn `toast` vs `sonner` conflict — remove `toast`, use `sonner` only |
| 3 | 🔺 GAP | Missing `@testing-library/user-event` dev dependency |
| 4 | 🔺 GAP | Env test needs `vi.resetModules()` + dynamic import pattern |
| 5 | 🔧 FIX | `drizzle.config.ts` needs `dotenv/config` for CLI env loading |
| 6 | 🔺 GAP | `<Toaster />` from sonner missing in root layout |
| 7 | 🔺 GAP | `NextRequest`/`NextResponse` not available in jsdom — API tests need `// @vitest-environment node` |
| 8 | 🔺 GAP | `server-only` mock should be in global test setup, not per-file |
| 9 | 🔧 FIX | Root `page.tsx` redirect must use `redirect()` from `next/navigation` (Server Component) |
| 10 | 🔺 GAP | Sidebar test needs `next/navigation` mock (`usePathname`) |
| 11 | 🔺 GAP | Sidebar test needs `@clerk/nextjs` client mock (`UserButton`) |
| 12 | 🔧 FIX | Settings `page.tsx` must have `'use client'` directive |
| 13 | 🔺 GAP | Model selector options (`AVAILABLE_MODELS`) not defined anywhere |
| 14 | 🔺 GAP | API key client-side validation (empty string, `sk-ant-` prefix) |
| 15 | 🔧 FIX | PATCH handler needs `req: NextRequest` param + `await req.json()` |
| 16 | 🔺 GAP | PATCH body Zod validation schema missing |
| 17 | 🔺 GAP | `generateText` import not specified in test-key route |
| 18 | 🔺 GAP | Test-key prompt content not specified |
| 19 | 🔺 GAP | `DEFAULT_MODELS` should be extracted to shared `models.ts` |
| 20 | 🔧 FIX | `api-key-guard.tsx` needs `'use client'` directive |
| 21 | 🔺 GAP | `generateText` mock strategy for test-key tests |
| 22 | 🔺 GAP | `npm run build` missing as mandatory pre-deploy step |
| 23 | 🔺 GAP | Vercel `DATABASE_URL` pooler guidance too vague — made explicit |
| 24 | 🔺 GAP | `dotenv` dev dependency missing from install list |
| 25 | 🔴 CRITICAL | Middleware uses `auth.protect()` which returns 404, not redirect. Must use `redirectToSignIn()` pattern |
| 26 | 🔴 NEW | AI SDK version not pinned — v5/v6 breaking changes will break imports |
| 27 | 🔴 NEW | `swr` installed but unused in Phase 0 — remove to avoid confusion |
| 28 | 🔴 NEW | `requireAuth()` fetches full user on every call — split into `requireUserId()` (fast) and `requireAuthWithUser()` (full) |
| 29 | 🔴 NEW | Clerk `updateUserMetadata` shallow merge semantics undocumented — junior will over-engineer |
| 30 | 🔴 NEW | Settings page dual source of truth (`useUser()` vs `GET /api/settings`) — clarified: GET is single source, useUser only for loading gate + cache bust |
| 31 | 🔴 NEW | `@ai-sdk/react` installed but unused in Phase 0 — defer to later phase |
| 32 | 🟣 CRITICAL | AI SDK `ai@^4` pin is wrong — latest is v6. `@ai-sdk/anthropic@^1` incompatible with `ai@^4`. |
| 33 | 🟣 V3 | Clerk `isAuthenticated` is the canonical auth check pattern (not `!userId`). Updated middleware, route handlers, and auth utils |
| 34 | 🟣 V3 | `handleAPIError` uses `.includes('Unauthorized')` — false positives. Changed internal errors to exact match, kept `.includes()` only for external API errors |
| 35 | 🟣 V3 | Missing `import './globals.css'` in root layout — Tailwind won't load without it |
| 36 | 🟣 V3 | `drizzle.config.ts` is CLI-only — added comment to prevent accidental import by app code |
| **37** | **🔵 CRITICAL** | **V3 recommended `ai@^5 @ai-sdk/anthropic@^2` is STILL outdated. v6 migration is trivial for `generateText`. Use `ai@^6 @ai-sdk/anthropic@^3` (current stable).** |
| **38** | **🔵 CRITICAL** | **Tailwind v4 guard is backwards. Next.js 15.2+ scaffolds TW4 by default (no config file, CSS-first). Plan must EXPECT TW4, not TW3.** |
| **39** | **🔵 V4** | **Model IDs stale. `claude-sonnet-4-20250514` superseded by Sonnet 4.5 and 4.6. Updated `AVAILABLE_MODELS` to include current models.** |
| **40** | **🔵 V4** | **Missing `export const metadata` in root `layout.tsx`. Added for SEO/browser tab.** |
| **41** | **🔵 V4** | **`ClerkProvider dynamic` is discouraged by Clerk docs but IS needed here because all pages are behind auth anyway. Added explanatory comment.** |
| **42** | **🔵 V4** | **No `type-check` script in `package.json`. Added `"type-check": "tsc --noEmit"` for local iteration and CI.** |
| **43** | **🔵 V4** | **"Test Key" button has no in-flight guard. Rapid clicks = rate limiting on user's Anthropic key. All buttons (Save, Test, Save Models) must disable while ANY request is in-flight.** |
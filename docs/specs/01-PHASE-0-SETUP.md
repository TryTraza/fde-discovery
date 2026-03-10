# Phase 0 — Project Setup & Infrastructure

**Goal:** Running Next.js app with Clerk auth, database connection, Settings page for API keys and model config, deployment to Vercel.
**Duration:** 2 days
**Gate:** App deploys, Clerk login works, Settings page saves API key and model preferences, Drizzle connects to Supabase.

---

## Step 0.1 — Scaffold Next.js Project

```bash
npx create-next-app@latest fde-discovery-tool \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd fde-discovery-tool
```

### Install All Dependencies

```bash
# UI framework
npx shadcn@latest init
# When prompted: New York style, Zinc color, CSS variables: yes

# shadcn components (install all needed upfront)
npx shadcn@latest add button card input textarea label select badge \
  dialog sheet dropdown-menu command combobox \
  table tabs separator skeleton toast sonner \
  form calendar popover avatar breadcrumb \
  scroll-area tooltip alert radio-group switch accordion

# AI SDK
npm install ai @ai-sdk/anthropic @ai-sdk/react

# AI Elements (pre-built chat components)
npx ai-elements@latest

# Database
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Auth
npm install @clerk/nextjs

# Supabase (ONLY for file storage, not data queries)
npm install @supabase/supabase-js

# Utilities
npm install zod uuid date-fns react-markdown swr
npm install -D @types/uuid

# Testing
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
npm install -D playwright @playwright/test
```

---

## Step 0.2 — Project Structure

Create all directories:

```bash
mkdir -p src/app/{(auth)/sign-in/[[...sign-in]],(auth)/sign-up/[[...sign-up]]}
mkdir -p src/app/(dashboard)/{clients/{new,[clientId]/processes/{new,[processId]/sessions/{new,[sessionId]/{capture,debrief}}}},settings}
mkdir -p src/app/api/{clients/[clientId]/{contacts,processes},processes/[processId]/{model/apply,sessions,questions,artifacts,email-draft},sessions/[sessionId]/{interview,events,debrief,synthesize},contacts/[contactId],questions/[questionId],artifacts/[artifactId],ai/{company-research,suggestions,research},settings/test-key,webhooks/clerk}
mkdir -p src/components/{layout,clients,processes,sessions,shared}
mkdir -p src/lib/{db/{queries,migrations},ai/{prompts,schemas},domain/l1,auth,supabase}
mkdir -p src/__tests__/{unit/{db,ai,lib},integration/api,e2e}
```

Full structure:

```
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar + breadcrumb + research button
│   │   ├── clients/
│   │   │   ├── page.tsx            # Client list
│   │   │   ├── new/page.tsx        # Client creation
│   │   │   └── [clientId]/
│   │   │       ├── page.tsx        # Client overview
│   │   │       └── processes/
│   │   │           ├── new/page.tsx
│   │   │           └── [processId]/
│   │   │               ├── page.tsx        # Process overview
│   │   │               └── sessions/
│   │   │                   ├── new/page.tsx
│   │   │                   └── [sessionId]/
│   │   │                       ├── page.tsx        # Session detail
│   │   │                       ├── capture/page.tsx
│   │   │                       └── debrief/page.tsx
│   │   └── settings/
│   │       └── page.tsx            # API key + model config
│   ├── api/
│   │   ├── clients/
│   │   │   ├── route.ts
│   │   │   └── [clientId]/
│   │   │       ├── route.ts
│   │   │       ├── contacts/route.ts
│   │   │       └── processes/route.ts
│   │   ├── processes/[processId]/
│   │   │   ├── route.ts
│   │   │   ├── model/
│   │   │   │   ├── route.ts
│   │   │   │   └── apply/route.ts
│   │   │   ├── sessions/route.ts
│   │   │   ├── questions/route.ts
│   │   │   ├── artifacts/route.ts
│   │   │   └── email-draft/route.ts
│   │   ├── sessions/[sessionId]/
│   │   │   ├── route.ts
│   │   │   ├── interview/route.ts
│   │   │   ├── events/route.ts
│   │   │   ├── debrief/route.ts
│   │   │   └── synthesize/route.ts
│   │   ├── contacts/[contactId]/route.ts
│   │   ├── questions/[questionId]/route.ts
│   │   ├── artifacts/[artifactId]/route.ts
│   │   ├── ai/
│   │   │   ├── company-research/route.ts
│   │   │   ├── suggestions/route.ts
│   │   │   └── research/route.ts
│   │   ├── settings/
│   │   │   ├── route.ts
│   │   │   └── test-key/route.ts
│   │   └── webhooks/clerk/route.ts
│   ├── layout.tsx                  # Root layout (ClerkProvider)
│   └── page.tsx                    # Redirect to /clients
├── components/
│   ├── ui/                         # shadcn (auto-generated)
│   ├── ai-elements/                # AI Elements (auto-generated)
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── breadcrumb-nav.tsx
│   │   └── ai-research-panel.tsx
│   ├── clients/
│   ├── processes/
│   ├── sessions/
│   └── shared/
│       ├── loading-skeleton.tsx
│       ├── status-badge.tsx
│       ├── confirm-dialog.tsx
│       └── api-key-guard.tsx
├── lib/
│   ├── db/
│   │   ├── index.ts                # Drizzle client connection
│   │   ├── schema.ts               # All table definitions
│   │   ├── types.ts                # JSONB field TypeScript interfaces
│   │   ├── migrations/             # Generated by drizzle-kit
│   │   └── queries/
│   │       ├── clients.ts
│   │       ├── contacts.ts
│   │       ├── processes.ts
│   │       ├── sessions.ts
│   │       ├── events.ts
│   │       ├── artifacts.ts
│   │       ├── questions.ts
│   │       └── research-notes.ts
│   ├── ai/
│   │   ├── get-ai-config.ts        # Reads user's API key + model prefs from Clerk
│   │   ├── prompts/
│   │   │   ├── company-research.ts
│   │   │   ├── process-hypothesis.ts
│   │   │   ├── session-interview.ts
│   │   │   ├── prep-brief.ts
│   │   │   ├── capture-suggestions.ts
│   │   │   ├── synthesis-shadowing.ts
│   │   │   ├── synthesis-general.ts
│   │   │   ├── follow-up-email.ts
│   │   │   └── research-panel.ts
│   │   └── schemas/
│   │       ├── hypothesis.ts
│   │       ├── prep-brief.ts
│   │       ├── suggestions.ts
│   │       └── synthesis.ts
│   ├── domain/l1/
│   │   ├── procurement.json
│   │   ├── freight-forwarding.json
│   │   ├── rebate-processing.json
│   │   ├── unknown.json
│   │   └── index.ts
│   ├── auth/
│   │   └── utils.ts
│   ├── supabase/
│   │   └── storage.ts
│   ├── hooks/
│   │   ├── use-clients.ts
│   │   ├── use-role.ts
│   │   └── ... (one per entity)
│   └── utils.ts
├── __tests__/
│   ├── unit/db/
│   ├── unit/ai/
│   ├── integration/api/
│   └── e2e/
├── drizzle.config.ts
└── vitest.config.ts
```

---

## Step 0.3 — Environment Variables

Create `.env.local`:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/clients
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/clients

# Database (Supabase connection pooler — Transaction mode)
DATABASE_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres

# Supabase (ONLY for file storage)
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# NO ANTHROPIC_API_KEY — each user provides their own via Settings
```

Create `.env.example` with placeholder values. Add `.env.local` to `.gitignore`.

---

## Step 0.4 — Drizzle Configuration

Create `drizzle.config.ts`:

```typescript
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

Create `src/lib/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// prepare: false is REQUIRED for Supabase connection pooler (Transaction mode)
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "npx tsx src/lib/db/seed.ts",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

---

## Step 0.5 — Clerk Auth

### Root Layout: `src/app/layout.tsx`

```tsx
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'FDE Discovery Tool',
  description: 'AI-powered process discovery for Forward Deployed Engineers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### Middleware: `src/middleware.ts`

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

### Auth Utilities: `src/lib/auth/utils.ts`

```typescript
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export type UserRole = 'admin' | 'viewer';

export async function getAuthRole(): Promise<{ userId: string; role: UserRole }> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  const user = await currentUser();
  const role = (user?.publicMetadata?.role as UserRole) || 'viewer';
  return { userId, role };
}

export async function requireAdmin() {
  const { userId, role } = await getAuthRole();
  if (role !== 'admin') throw new Error('Forbidden: admin role required');
  return { userId, role };
}

export async function requireAuth() {
  return getAuthRole();
}

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof Error) {
    switch (error.message) {
      case 'NO_API_KEY':
        return NextResponse.json(
          { error: 'No Anthropic API key configured. Go to Settings to add your key.', code: 'NO_API_KEY' },
          { status: 422 }
        );
      case 'Unauthorized':
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      case 'Forbidden: admin role required':
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      default:
        if (error.message.includes('invalid_api_key') || error.message.includes('authentication_error')) {
          return NextResponse.json(
            { error: 'Your Anthropic API key is invalid. Update it in Settings.', code: 'INVALID_API_KEY' },
            { status: 422 }
          );
        }
        if (error.message.includes('rate_limit')) {
          return NextResponse.json(
            { error: 'Rate limit exceeded. Wait a moment and try again.', code: 'RATE_LIMIT' },
            { status: 429 }
          );
        }
    }
  }
  console.error('Unhandled API error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

### Sign-In Page: `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`

```tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn />
    </div>
  );
}
```

### Sign-Up Page: `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

```tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignUp />
    </div>
  );
}
```

---

## Step 0.6 — Per-User AI Configuration

There is no server-side `ANTHROPIC_API_KEY`. Each user stores their key in Clerk and picks which Claude model to use per feature.

### Clerk Metadata Schema

```
privateMetadata (server-only, never sent to browser):
  anthropicApiKey: "sk-ant-api03-..."

publicMetadata (readable by client for UI):
  role: "admin" | "viewer"
  hasApiKey: true | false
  aiModels:
    research:    "claude-sonnet-4-20250514"
    hypothesis:  "claude-sonnet-4-20250514"
    suggestions: "claude-haiku-3-5-20241022"
    synthesis:   "claude-sonnet-4-20250514"
    interview:   "claude-sonnet-4-20250514"
```

### AI Config Helper: `src/lib/ai/get-ai-config.ts`

```typescript
import { currentUser } from '@clerk/nextjs/server';
import { createAnthropic } from '@ai-sdk/anthropic';

export type AIFeature = 'research' | 'hypothesis' | 'suggestions' | 'synthesis' | 'interview';

const DEFAULT_MODELS: Record<AIFeature, string> = {
  research:    'claude-sonnet-4-20250514',
  hypothesis:  'claude-sonnet-4-20250514',
  suggestions: 'claude-haiku-3-5-20241022',
  synthesis:   'claude-sonnet-4-20250514',
  interview:   'claude-sonnet-4-20250514',
};

export async function getAIConfig(feature: AIFeature) {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');

  const apiKey = (user.privateMetadata as any)?.anthropicApiKey;
  if (!apiKey) throw new Error('NO_API_KEY');

  const modelPrefs = (user.publicMetadata as any)?.aiModels ?? {};
  const modelId = modelPrefs[feature] || DEFAULT_MODELS[feature];

  const anthropic = createAnthropic({ apiKey });

  return {
    model: anthropic(modelId),
    modelId,
    anthropic,  // Needed for: anthropic.tools.webSearch_20250305()
  };
}
```

### API Key Guard Component: `src/components/shared/api-key-guard.tsx`

```tsx
'use client';

import { useUser } from '@clerk/nextjs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Key } from 'lucide-react';
import Link from 'next/link';

export function APIKeyGuard({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const hasKey = !!(user?.publicMetadata as any)?.hasApiKey;

  if (!hasKey) {
    return (
      <Alert>
        <Key className="h-4 w-4" />
        <AlertTitle>API Key Required</AlertTitle>
        <AlertDescription className="flex items-center gap-4">
          <span>Set your Anthropic API key in Settings to enable AI features.</span>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings">Go to Settings</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
```

---

## Step 0.7 — Settings Page

### `src/app/(dashboard)/settings/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Eye, EyeOff, Key, Cpu, CheckCircle, Loader2 } from 'lucide-react';

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (balanced)' },
  { id: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5 (fast, cheap)' },
  { id: 'claude-opus-4-20250414', label: 'Claude Opus 4 (most capable, expensive)' },
];

const FEATURE_CATEGORIES = [
  { key: 'research', label: 'Research & Company Analysis', description: 'Research panel, company research on client creation' },
  { key: 'hypothesis', label: 'Process Hypothesis', description: 'Initial process model generation' },
  { key: 'suggestions', label: 'Capture Suggestions', description: 'Real-time suggestion chips during shadowing (needs speed)' },
  { key: 'synthesis', label: 'Session Synthesis', description: 'Post-session analysis and ProcessModel updates' },
  { key: 'interview', label: 'Session Interview', description: 'AI-guided session setup questions' },
];

export default function SettingsPage() {
  const { user } = useUser();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    if (user) {
      const meta = user.publicMetadata as any;
      setHasExistingKey(!!meta?.hasApiKey);
      setModels(meta?.aiModels ?? {});
    }
  }, [user]);

  async function handleSaveApiKey() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicApiKey: apiKey }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setHasExistingKey(true);
      setApiKey('');
      toast.success('API key saved successfully');
    } catch {
      toast.error('Failed to save API key');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestKey() {
    setTesting(true);
    try {
      const res = await fetch('/api/settings/test-key', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Key works! Tested with ${data.model}`);
      } else {
        toast.error(`Key failed: ${data.error}`);
      }
    } catch {
      toast.error('Network error testing key');
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveModels() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiModels: models }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Model preferences saved');
    } catch {
      toast.error('Failed to save model preferences');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />Anthropic API Key</CardTitle>
          <CardDescription>
            Your key is stored securely and used for all AI features. Get one at{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="underline">console.anthropic.com</a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasExistingKey && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>API key configured</span>
              <Button variant="ghost" size="sm" onClick={handleTestKey} disabled={testing}>
                {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasExistingKey ? 'Enter new key to replace...' : 'sk-ant-api03-...'}
              />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button onClick={handleSaveApiKey} disabled={!apiKey.trim() || saving}>
              {hasExistingKey ? 'Update' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5" />AI Model Preferences</CardTitle>
          <CardDescription>
            Choose which Claude model per feature. Haiku is faster/cheaper for real-time suggestions. Sonnet is better for analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FEATURE_CATEGORIES.map((feature) => (
            <div key={feature.key} className="space-y-1">
              <Label className="text-sm font-medium">{feature.label}</Label>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
              <Select
                value={models[feature.key] || ''}
                onValueChange={(val) => setModels((prev) => ({ ...prev, [feature.key]: val }))}
              >
                <SelectTrigger><SelectValue placeholder="Use default" /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <Button onClick={handleSaveModels} disabled={saving}>Save Model Preferences</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Settings API: `src/app/api/settings/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return NextResponse.json({
    hasApiKey: !!(user.privateMetadata as any)?.anthropicApiKey,
    aiModels: (user.publicMetadata as any)?.aiModels ?? {},
    role: (user.publicMetadata as any)?.role ?? 'viewer',
  });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const client = await clerkClient();

  if (body.anthropicApiKey) {
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { anthropicApiKey: body.anthropicApiKey },
      publicMetadata: { hasApiKey: true },
    });
  }

  if (body.aiModels) {
    const user = await client.users.getUser(userId);
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { ...(user.publicMetadata as any), aiModels: body.aiModels },
    });
  }

  return NextResponse.json({ success: true });
}
```

### Test Key API: `src/app/api/settings/test-key/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { currentUser } from '@clerk/nextjs/server';

export async function POST() {
  const user = await currentUser();
  const apiKey = (user?.privateMetadata as any)?.anthropicApiKey;
  if (!apiKey) return NextResponse.json({ success: false, error: 'No key stored' });

  try {
    const anthropic = createAnthropic({ apiKey });
    await generateText({
      model: anthropic('claude-haiku-3-5-20241022'),
      maxTokens: 10,
      prompt: 'Say "ok"',
    });
    return NextResponse.json({ success: true, model: 'claude-haiku-3.5' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
```

---

## Step 0.8 — Dashboard Layout

### `src/app/(dashboard)/layout.tsx`

```tsx
'use client';

import { useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import { Sidebar } from '@/components/layout/sidebar';
import { BreadcrumbNav } from '@/components/layout/breadcrumb-nav';
import { AIResearchPanel } from '@/components/layout/ai-research-panel';
import { Button } from '@/components/ui/button';
import { Brain } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [researchOpen, setResearchOpen] = useState(false);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b px-6 py-3 flex items-center justify-between">
          <BreadcrumbNav />
          <UserButton />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <Button
        onClick={() => setResearchOpen(true)}
        className="fixed bottom-6 right-6 rounded-full w-12 h-12 shadow-lg z-40"
        size="icon"
      >
        <Brain className="h-5 w-5" />
      </Button>
      <AIResearchPanel open={researchOpen} onOpenChange={setResearchOpen} />
    </div>
  );
}
```

### `src/components/layout/sidebar.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Users, Settings } from 'lucide-react';

const navItems = [
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 border-r bg-muted/30 p-4 flex flex-col">
      <div className="mb-8 px-2">
        <h2 className="text-lg font-bold">FDE Discovery</h2>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

### `src/components/layout/breadcrumb-nav.tsx` (placeholder)

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

export function BreadcrumbNav() {
  const pathname = usePathname();
  // Placeholder — will resolve UUIDs to names via SWR in Phase 7
  const segments = pathname.split('/').filter(Boolean);
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.slice(0, 1).map((seg, i) => (
          <BreadcrumbItem key={i}>
            <BreadcrumbLink href={`/${seg}`} className="capitalize">{seg}</BreadcrumbLink>
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

### `src/components/layout/ai-research-panel.tsx` (placeholder)

```tsx
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Brain } from 'lucide-react';

interface AIResearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIResearchPanel({ open, onOpenChange }: AIResearchPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] p-4">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />AI Research
          </SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground mt-4">Research panel will be built in Phase 7.</p>
      </SheetContent>
    </Sheet>
  );
}
```

---

## Step 0.9 — Vitest Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

Create `src/__tests__/setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

---

## Step 0.10 — Verify & Deploy

```bash
npm run dev
# 1. Visit localhost:3000 → should redirect to Clerk sign-in
# 2. Sign in → should see dashboard with sidebar
# 3. Go to /settings → enter API key → save → see green checkmark
# 4. Click "Test" → should show "Key works!"
# 5. Set model preferences → save

npx vercel
# Set all env vars in Vercel dashboard (NOT ANTHROPIC_API_KEY)
```

### Phase 0 Gate Checklist

- [ ] `npm run dev` starts without errors
- [ ] Clerk sign-in/sign-up works
- [ ] Dashboard layout renders (sidebar, breadcrumb, user button)
- [ ] Settings page: API key input + show/hide + save
- [ ] Settings page: "Test" button verifies key with a Haiku call
- [ ] Settings page: 5 model selectors with save
- [ ] API key stored in Clerk `privateMetadata`
- [ ] Model prefs stored in Clerk `publicMetadata`
- [ ] `hasApiKey` flag in `publicMetadata`
- [ ] `vitest` runs (0 tests OK)
- [ ] Deployed to Vercel and accessible
- [ ] Supabase project created with DATABASE_URL working

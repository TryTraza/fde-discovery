# Phase 0 — Project Setup & Infrastructure

**Goal:** Running Next.js app with auth, database connection, Settings page for API keys + model config, deployment pipeline.
**Duration:** 2 days
**Gate:** App deploys, Clerk login works, Settings page saves API key and model preferences.

---

## Step 0.1 — Scaffold Next.js Project

```bash
npx create-next-app@latest fde-discovery-tool \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd fde-discovery-tool
```

### Install Core Dependencies

```bash
# UI
npx shadcn@latest init  # New York style, Zinc color, CSS variables: yes

# AI SDK
npm install ai @ai-sdk/anthropic @ai-sdk/react

# AI Elements (chat components for research panel)
npx ai-elements@latest
# Installs: conversation, message, prompt-input, reasoning, sources, suggestion, shimmer

# Database
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Auth
npm install @clerk/nextjs

# Supabase (ONLY for file storage — not for data queries)
npm install @supabase/supabase-js

# Utilities
npm install zod uuid date-fns react-markdown swr
npm install -D @types/uuid

# Testing
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
npm install -D playwright @playwright/test
```

### Install shadcn Components

```bash
npx shadcn@latest add button card input textarea label select badge \
  dialog sheet dropdown-menu command combobox \
  table tabs separator skeleton toast sonner \
  form calendar popover avatar breadcrumb \
  scroll-area tooltip alert radio-group switch
```

---

## Step 0.2 — Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── clients/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [clientId]/
│   │   │       ├── page.tsx
│   │   │       └── processes/
│   │   │           ├── new/page.tsx
│   │   │           └── [processId]/
│   │   │               ├── page.tsx
│   │   │               └── sessions/
│   │   │                   ├── new/page.tsx
│   │   │                   └── [sessionId]/
│   │   │                       ├── page.tsx
│   │   │                       ├── capture/page.tsx
│   │   │                       └── debrief/page.tsx
│   │   └── settings/
│   │       └── page.tsx            # API key + model config
│   ├── api/
│   │   ├── clients/ ...
│   │   ├── processes/ ...
│   │   ├── sessions/ ...
│   │   ├── contacts/ ...
│   │   ├── questions/ ...
│   │   ├── artifacts/ ...
│   │   ├── ai/
│   │   │   ├── company-research/route.ts
│   │   │   ├── suggestions/route.ts
│   │   │   └── research/route.ts
│   │   ├── settings/
│   │   │   └── route.ts            # GET/PATCH user settings via Clerk
│   │   └── webhooks/clerk/route.ts
│   ├── layout.tsx
│   └── page.tsx                    # Redirect to /clients
│
├── components/
│   ├── ui/                         # shadcn (auto-generated)
│   ├── ai-elements/                # AI Elements (auto-generated)
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── breadcrumb-nav.tsx
│   │   └── ai-research-panel.tsx
│   ├── clients/ ...
│   ├── processes/ ...
│   ├── sessions/ ...
│   └── shared/
│       ├── loading-skeleton.tsx
│       ├── status-badge.tsx
│       ├── confirm-dialog.tsx
│       └── api-key-guard.tsx       # Wraps AI features, shows "Set API key" if missing
│
├── lib/
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   ├── migrations/
│   │   └── queries/ ...
│   ├── ai/
│   │   ├── get-ai-config.ts        # NEW: reads user's API key + model prefs from Clerk
│   │   ├── create-model.ts          # NEW: creates anthropic model instance per-request
│   │   ├── prompts/ ...
│   │   └── schemas/ ...
│   ├── domain/l1/ ...
│   ├── auth/utils.ts
│   ├── supabase/storage.ts
│   └── utils.ts
│
├── __tests__/ ...
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

# NO ANTHROPIC_API_KEY HERE — each user provides their own via Settings
```

> **IMPORTANT:** There is no server-side `ANTHROPIC_API_KEY`. Each user enters their own key in the Settings page, stored in Clerk `privateMetadata`.

---

## Step 0.4 — Per-User AI Configuration

This is the most important new pattern. Every AI call reads the API key and model preferences from the current user's Clerk profile.

### Clerk Metadata Schema

```typescript
// User privateMetadata (server-only, never sent to client)
{
  "anthropicApiKey": "sk-ant-api03-..."    // encrypted by Clerk at rest
}

// User publicMetadata (readable by client for UI)
{
  "role": "admin",               // "admin" | "viewer"
  "aiModels": {
    "research":    "claude-sonnet-4-20250514",     // Research panel + company research
    "hypothesis":  "claude-sonnet-4-20250514",     // Process hypothesis generation
    "suggestions": "claude-haiku-3-5-20241022",    // Capture suggestion chips (fast + cheap)
    "synthesis":   "claude-sonnet-4-20250514",     // Post-session synthesis
    "interview":   "claude-sonnet-4-20250514"      // Session interview questions
  }
}
```

### AI Config Helper: `src/lib/ai/get-ai-config.ts`

```typescript
import { currentUser } from '@clerk/nextjs/server';
import { createAnthropic } from '@ai-sdk/anthropic';

export type AIFeature = 'research' | 'hypothesis' | 'suggestions' | 'synthesis' | 'interview';

const DEFAULT_MODELS: Record<AIFeature, string> = {
  research: 'claude-sonnet-4-20250514',
  hypothesis: 'claude-sonnet-4-20250514',
  suggestions: 'claude-haiku-3-5-20241022',
  synthesis: 'claude-sonnet-4-20250514',
  interview: 'claude-sonnet-4-20250514',
};

export async function getAIConfig(feature: AIFeature) {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');

  const apiKey = (user.privateMetadata as any)?.anthropicApiKey;
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const modelPrefs = (user.publicMetadata as any)?.aiModels ?? {};
  const modelId = modelPrefs[feature] || DEFAULT_MODELS[feature];

  // Create a per-request Anthropic provider with the user's key
  const anthropic = createAnthropic({ apiKey });

  return {
    model: anthropic(modelId),
    modelId,
    anthropic, // For tool access (e.g., anthropic.tools.webSearch)
  };
}
```

### Model Factory: `src/lib/ai/create-model.ts`

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';

/**
 * Create an Anthropic provider instance with a specific API key.
 * Used in streaming routes where we need the provider for tools.
 */
export function createUserAnthropic(apiKey: string) {
  return createAnthropic({ apiKey });
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

> **Note:** We store a `hasApiKey: true` flag in `publicMetadata` (readable client-side) so the UI can show the guard. The actual key stays in `privateMetadata` (server-only).

---

## Step 0.5 — Settings Page

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
import { Eye, EyeOff, Key, Cpu, CheckCircle } from 'lucide-react';

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

      {/* API Key Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Anthropic API Key
          </CardTitle>
          <CardDescription>
            Your API key is stored securely and used for all AI features. Each user manages their own key and costs.
            Get yours at{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" className="underline">
              console.anthropic.com
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasExistingKey && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              API key configured
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
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button onClick={handleSaveApiKey} disabled={!apiKey.trim() || saving}>
              {hasExistingKey ? 'Update' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Model Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            AI Model Preferences
          </CardTitle>
          <CardDescription>
            Choose which Claude model to use for each feature. Haiku is faster and cheaper for real-time suggestions. Sonnet is better for analysis and research.
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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Use default" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>
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

### Settings API Route: `src/app/api/settings/route.ts`

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

  // Update API key (private metadata — never exposed to client)
  if (body.anthropicApiKey) {
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { anthropicApiKey: body.anthropicApiKey },
      publicMetadata: { hasApiKey: true }, // Flag for UI
    });
  }

  // Update model preferences (public metadata — readable by client)
  if (body.aiModels) {
    const user = await client.users.getUser(userId);
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...(user.publicMetadata as any),
        aiModels: body.aiModels,
      },
    });
  }

  return NextResponse.json({ success: true });
}
```

---

## Step 0.6 — Drizzle, Clerk Auth, Vitest, Layout

These are unchanged from v1. See:
- Drizzle config: `drizzle.config.ts` pointing at `src/lib/db/schema.ts`
- DB client: `src/lib/db/index.ts` with `prepare: false` for Supabase pooler
- Auth utils: `src/lib/auth/utils.ts` with `requireAdmin()`, `requireAuth()`, `getAuthRole()`
- Middleware: `src/middleware.ts` protecting all routes except sign-in/sign-up/webhooks
- Root layout: `src/app/layout.tsx` with `ClerkProvider`
- Dashboard layout: `src/app/(dashboard)/layout.tsx` with Sidebar + Breadcrumb + UserButton
- Vitest config: `vitest.config.ts`
- Sign-in/Sign-up pages: Clerk components

### Auth Utils — Updated for API Key Errors

```typescript
// src/lib/auth/utils.ts — add this helper
import { NextResponse } from 'next/server';

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.message === 'NO_API_KEY') {
      return NextResponse.json(
        { error: 'No API key configured. Go to Settings to add your Anthropic API key.' },
        { status: 422 }
      );
    }
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  console.error('API error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

---

## Step 0.7 — Verify & Deploy

```bash
npm run dev
# 1. Sign in via Clerk
# 2. Go to /settings
# 3. Enter Anthropic API key → Save
# 4. Select model preferences → Save
# 5. Verify key is stored (check Clerk dashboard → Users → your user → metadata)
```

### Phase 0 Gate Checklist

- [ ] `npm run dev` starts without errors
- [ ] Clerk sign-in/sign-up works
- [ ] Dashboard layout renders (sidebar, breadcrumb, user button)
- [ ] Settings page renders with API key input + model selectors
- [ ] API key saves to Clerk `privateMetadata`
- [ ] Model prefs save to Clerk `publicMetadata`
- [ ] `hasApiKey` flag appears in `publicMetadata`
- [ ] `vitest` runs (even with 0 tests)
- [ ] Deployed to Vercel
- [ ] Supabase project created, DATABASE_URL connects

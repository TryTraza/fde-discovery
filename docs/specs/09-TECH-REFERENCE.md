# Tech Reference v2 — AI Patterns, Per-User Keys, Model Resolver

---

## 1. The Golden Rule: Per-User API Keys

**Every AI call in this app reads the API key from the current user's Clerk metadata.** There is NO server-side `ANTHROPIC_API_KEY` env var.

### How it works:

```
User signs up → Goes to Settings → Enters Anthropic API key
                                          ↓
                              Stored in Clerk privateMetadata
                              (encrypted at rest, never sent to client)
                                          ↓
                              User also picks model per feature type
                              Stored in Clerk publicMetadata
                                          ↓
                              Every API route calls getAIConfig(feature)
                              → reads key from Clerk → creates provider
                              → resolves model from user's prefs
```

### The Helper: `src/lib/ai/get-ai-config.ts`

```typescript
import { currentUser } from '@clerk/nextjs/server';
import { createAnthropic } from '@ai-sdk/anthropic';

export type AIFeature = 'research' | 'hypothesis' | 'suggestions' | 'synthesis' | 'interview';

const DEFAULT_MODELS: Record<AIFeature, string> = {
  research:    'claude-sonnet-4-20250514',
  hypothesis:  'claude-sonnet-4-20250514',
  suggestions: 'claude-haiku-3-5-20241022',   // Fast + cheap for real-time capture
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
    anthropic,  // For tool access: anthropic.tools.webSearch_20250305()
  };
}
```

### Usage in Every AI Route:

```typescript
// Pattern: structured output
import { generateObject } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';

const { model } = await getAIConfig('hypothesis');
const { object } = await generateObject({ model, schema: mySchema, ... });
```

```typescript
// Pattern: plain text with web search
import { generateText } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';

const { model, anthropic } = await getAIConfig('research');
const { text } = await generateText({
  model,
  tools: { web_search: anthropic.tools.webSearch_20250305() },
  maxSteps: 3,
  ...
});
```

```typescript
// Pattern: streaming chat (research panel)
// Can't use getAIConfig because streaming needs direct provider access
import { createAnthropic } from '@ai-sdk/anthropic';
import { currentUser } from '@clerk/nextjs/server';

const user = await currentUser();
const apiKey = (user?.privateMetadata as any)?.anthropicApiKey;
const anthropic = createAnthropic({ apiKey });
const modelId = (user?.publicMetadata as any)?.aiModels?.research || 'claude-sonnet-4-20250514';

const result = streamText({
  model: anthropic(modelId),
  tools: { web_search: anthropic.tools.webSearch_20250305() },
  ...
});
return result.toUIMessageStreamResponse();
```

### Error Handling for Missing Keys:

```typescript
// In every API route that calls AI:
import { handleAPIError } from '@/lib/auth/utils';

try {
  const { model } = await getAIConfig('synthesis');
  // ... AI call
} catch (error) {
  return handleAPIError(error);
  // NO_API_KEY → 422 with helpful message
  // Unauthorized → 401
  // Forbidden → 403
  // Everything else → 500
}
```

### Frontend: Catch 422 and Show Guide

```typescript
// In any component that calls an AI endpoint:
const res = await fetch('/api/sessions/synthesize', { method: 'POST' });
if (res.status === 422) {
  toast.error('Set your Anthropic API key in Settings to use AI features.');
  return;
}
```

---

## 2. Anthropic Web Search Tool

The AI SDK's Anthropic provider includes a built-in web search tool. **We do not need to implement web search ourselves.** Claude handles it natively.

```typescript
const { model, anthropic } = await getAIConfig('research');

const { text } = await generateText({
  model,
  tools: {
    web_search: anthropic.tools.webSearch_20250305(),
  },
  maxSteps: 5,  // Allow up to 5 search-then-respond cycles
  prompt: 'Research X company...',
});
```

This is used in:
- **Company research** (client creation): `maxSteps: 3`
- **Research panel** (streaming chat): `maxSteps: 5`
- **Follow-up research** ("Research more" button): `maxSteps: 3`

---

## 3. API Route Pattern (Updated)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    // ... validate, process, return
  } catch (error) {
    return handleAPIError(error);  // Handles NO_API_KEY, auth errors, generic errors
  }
}
```

### `handleAPIError` (full implementation):

```typescript
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
        // Check for Anthropic API errors
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

---

## 4. Per-Feature Model Selection

### Clerk publicMetadata Schema:

```json
{
  "role": "admin",
  "hasApiKey": true,
  "aiModels": {
    "research": "claude-sonnet-4-20250514",
    "hypothesis": "claude-sonnet-4-20250514",
    "suggestions": "claude-haiku-3-5-20241022",
    "synthesis": "claude-sonnet-4-20250514",
    "interview": "claude-sonnet-4-20250514"
  }
}
```

### Available Models (Settings page dropdown):

| Model ID | Label | Best For |
|----------|-------|----------|
| `claude-sonnet-4-20250514` | Claude Sonnet 4 (balanced) | Research, synthesis, hypothesis |
| `claude-haiku-3-5-20241022` | Claude Haiku 3.5 (fast, cheap) | Capture suggestions |
| `claude-opus-4-20250414` | Claude Opus 4 (most capable) | Complex synthesis |

### Feature → Default Model Mapping:

| Feature | Default | Why |
|---------|---------|-----|
| Research | Sonnet 4 | Needs web search + good reasoning |
| Hypothesis | Sonnet 4 | Needs domain understanding |
| Suggestions | **Haiku 3.5** | Must be < 1.5s latency, cheap per-call |
| Synthesis | Sonnet 4 | Complex analysis, longest output |
| Interview | Sonnet 4 | Needs to be adaptive and contextual |

---

## 5. Session Transcript + Notes

### Data Model:

```typescript
// On sessions table:
transcriptText: text('transcript_text'),  // Pasted from recording tool
notes: text('notes'),                      // FDE's own observations
```

### When Each is Used:

| Session Type | Transcript | Notes |
|-------------|------------|-------|
| Discovery | Paste Granola/recording transcript | Personal observations |
| Process Mapping | Paste transcript | Personal observations |
| Shadowing | Paste after capture (post-capture screen) | Add after capture |
| Validation | Paste transcript | Personal observations |
| Demo | Paste transcript | Feedback notes |

### Synthesis Prompt Pattern:

Both are always included:
```
Transcript: ${session.transcriptText ?? 'No transcript provided'}
FDE personal notes: ${session.notes ?? 'No personal notes'}
```

---

## 6. SystemEntry.detailNotes

### Current (Phase 1): Free-Text

```typescript
interface SystemEntry {
  name: string;
  confirmed: boolean;
  role: string;
  details: string;
  gaps: string;
  detailNotes: string;  // Free text, e.g.:
                         // "Sheet: Quotes2024
                         //  Col A = Supplier Name
                         //  Col B = Unit Price (EUR)
                         //  Col C = Delivery Date
                         //  Data from: supplier email body, manual copy-paste
                         //  Naming: [SupplierCode]_[Date]_quote.xlsx"
  sourceSessionId?: string;
}
```

### Future (Phase 2): Structured Metadata

```typescript
interface SystemSchema {
  sheets?: Array<{
    name: string;
    columns: Array<{
      name: string;
      header: string;
      dataType: string;
      sourceMapping?: string;  // e.g., "email:supplier_name"
    }>;
  }>;
  emailFields?: Array<{
    field: string;  // subject, body, from, attachment
    mapsTo: string; // "Excel:Quotes2024:Col_A"
  }>;
  filePaths?: string[];
  namingConventions?: string[];
}

interface SystemEntry {
  // ... existing fields
  detailNotes: string;  // Kept for backward compat
  schema?: SystemSchema; // Phase 2: structured metadata
}
```

---

## 7. Environment Variables Checklist

```env
# Required
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk routing
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/clients
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/clients

# NOTE: No ANTHROPIC_API_KEY — each user provides their own
```

---

## 8. Key Dependencies

| Package | Purpose |
|---------|---------|
| `ai` | Vercel AI SDK core (`generateText`, `generateObject`, `streamText`) |
| `@ai-sdk/anthropic` | Claude provider with `createAnthropic({ apiKey })` + built-in tools |
| `@ai-sdk/react` | `useChat` hook for streaming chat UI |
| `drizzle-orm` + `postgres` | Type-safe DB access |
| `@clerk/nextjs` | Auth + user metadata (API keys + model prefs) |
| `@supabase/supabase-js` | File storage only |
| `zod` | Schema validation for API bodies + AI structured output |
| `swr` | Client-side data fetching with revalidation |
| `react-markdown` | Markdown rendering in prep briefs + research |
| `sonner` | Toast notifications |
| `lucide-react` | Icons |

# Phase 2 — Client CRUD + Company Research

**Goal:** Full client management with AI company research using the user's API key.
**Duration:** 3 days
**Gate:** Create/list/edit clients, AI research runs with user's key, contacts CRUD works.

---

## Core Pattern: Per-User API Key on Every AI Call

Every AI call now uses `getAIConfig(feature)` instead of a hardcoded `anthropic()` import. This reads the user's API key and model preference from Clerk metadata.

### Without per-user keys (wrong):
```typescript
import { anthropic } from '@ai-sdk/anthropic';
const { text } = await generateText({ model: anthropic('claude-sonnet-4-20250514'), ... });
```

### With per-user keys (correct):
```typescript
import { getAIConfig } from '@/lib/ai/get-ai-config';
const { model, anthropic } = await getAIConfig('research');
const { text } = await generateText({ model, ... });
// For web search tool: anthropic.tools.webSearch_20250305()
```

This pattern applies to **every AI call in every phase**.

---

## Step 2.1 — Company Research with User's Key

### `src/lib/ai/prompts/company-research.ts`

```typescript
import { generateText } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { updateClient } from '@/lib/db/queries/clients';

export async function triggerCompanyResearch(
  clientId: string,
  name: string,
  industry: string,
  website?: string
) {
  try {
    const { model, anthropic } = await getAIConfig('research');

    const { text } = await generateText({
      model,
      maxTokens: 1500,
      tools: {
        web_search: anthropic.tools.webSearch_20250305(),
      },
      maxSteps: 3,
      system: `You are a research assistant for a Forward Deployed Engineer at an AI automation company. Research a company and provide useful context for someone who will be automating their operational processes.`,
      prompt: `Research the company "${name}" in the ${industry} industry.${
        website ? ` Their website is ${website}.` : ''
      }

Provide:
1. A 2-3 sentence summary of what the company does, their size, and market position.
2. Their operational structure if findable — departments, key functions, supply chain.
3. Any information about their processes, systems, or pain points relevant for operations automation.
4. Notable recent news or changes (acquisitions, expansions, restructuring).

Keep it factual and concise. Flag what you couldn't find.`,
    });

    await updateClient(clientId, { aiSummary: text });
  } catch (error: any) {
    if (error.message === 'NO_API_KEY') {
      await updateClient(clientId, {
        aiSummary: 'AI research unavailable — no API key configured. Go to Settings to add your Anthropic API key.',
      });
      return;
    }
    console.error(`Company research failed for ${name}:`, error);
    await updateClient(clientId, {
      aiSummary: `Limited information found for ${name}. Use the Research panel for more specific queries.`,
    });
  }
}
```

> **Key insight:** `anthropic.tools.webSearch_20250305()` is a built-in Anthropic tool that gives Claude web search capability. We get this for free from the AI SDK — no external search API needed.

---

## Step 2.2 — Client API Routes

The POST handler wraps the async research call with proper NO_API_KEY handling:

```typescript
// In POST /api/clients
const client = await createClient(parsed.data);

// Trigger AI research — catch NO_API_KEY gracefully
triggerCompanyResearch(client.id, client.name, client.industry, client.website ?? undefined)
  .catch((err) => {
    // Already handled inside triggerCompanyResearch
    console.error('Company research error:', err);
  });

return NextResponse.json(client, { status: 201 });
```

---

## Steps 2.3–2.6 — Client List, Creation Form, Overview, SWR Hooks

The client creation form and overview page display the AI summary with appropriate messages based on state:

- Loading skeleton while research runs
- Research result when complete
- "AI research unavailable — set API key in Settings" if no key
- "Research failed — click to retry" on error
- "Research more" button for deeper research (triggers new call)

---

## Phase 2 Gate Checklist

- [ ] Client list page shows all clients
- [ ] Client creation validates and creates
- [ ] AI research runs with **user's API key** (not server env var)
- [ ] If no API key: research shows "set key in Settings" message (not crash)
- [ ] "Research more" button triggers additional research
- [ ] Contacts CRUD works
- [ ] Viewer role cannot create/edit
- [ ] All API routes return proper error codes

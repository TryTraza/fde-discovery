# Phase 3 — Process CRUD + Hypothesis Generation

**Goal:** Create processes with AI hypothesis (using user's key + model), display ProcessModel flow.
**Duration:** 3 days
**Gate:** Process creation with AI, ProcessModel flow renders, steps clickable.

---

## Step 3.1 — L1 Domain Library

Unchanged from v1. JSON files in `src/lib/domain/l1/` for procurement, freight-forwarding, rebate-processing, unknown. Alberto seeds these before launch.

---

## Step 3.2 — Process Hypothesis with User's AI Config

### `src/lib/ai/prompts/process-hypothesis.ts`

```typescript
import { generateObject } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { hypothesisOutputSchema } from '../schemas/hypothesis';
import { getL1, getAllL1Types } from '@/lib/domain/l1';
import type { Client } from '@/lib/db/schema';

export async function generateHypothesis(
  client: Client,
  processName: string,
  description: string | null,
  knownSystems: string[] | null,
  knownPainPoints: string | null,
  departmentTag: string | null
) {
  const { model } = await getAIConfig('hypothesis');  // Uses user's key + model pref
  const availableTypes = getAllL1Types();

  const { object } = await generateObject({
    model,
    schema: hypothesisOutputSchema,
    maxTokens: 2000,
    system: `You are an expert process analyst. Generate an initial hypothesis for a client's operational process.

Available process types to match against: ${availableTypes.join(', ')}. Use "unknown" if none match.`,
    prompt: `Client: ${client.name}, industry: ${client.industry}
Company summary: ${client.aiSummary ?? 'No summary available'}
Process name: ${processName}
Department: ${departmentTag ?? 'Not specified'}
Description: ${description ?? 'No description provided'}
Known systems: ${knownSystems?.join(', ') ?? 'None specified'}
Known pain points: ${knownPainPoints ?? 'None specified'}

Domain knowledge for reference:
${JSON.stringify(getL1('unknown'), null, 2)}

Generate:
1. HYPOTHESIS: 3-5 sentence paragraph. Be specific but flag uncertainty.
2. INITIAL_STEPS: Ordered list of likely steps. Name (3-8 words), description, systems, confidence always "inferred".
3. MATCHED_PROCESS_TYPE: Which process type best matches.`,
  });

  return object;
}
```

### Process Creation API — Handle NO_API_KEY

```typescript
// In POST /api/clients/[clientId]/processes
try {
  const hypothesis = await Promise.race([
    generateHypothesis(client, parsed.data.name, /* ... */),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000)),
  ]);
  // Apply hypothesis to process and model...
} catch (error: any) {
  if (error.message === 'NO_API_KEY') {
    // Process created, but no hypothesis. User can add key and retry.
    console.log('Hypothesis skipped: no API key');
  } else {
    console.error('Hypothesis generation failed:', error);
  }
  // Process is still created — just without AI content
}
```

---

## Step 3.3 — SystemEntry with detailNotes

When the ProcessModel flow renders systems, we now show `detailNotes` if present:

```tsx
// In ProcessFlow component, when showing a step's systems:
{step.systems.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-1">
    {step.systems.map((sysName) => {
      const sysEntry = systems.find((s) => s.name === sysName);
      return (
        <Tooltip key={sysName}>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-xs cursor-help">
              {sysName}
            </Badge>
          </TooltipTrigger>
          {sysEntry?.detailNotes && (
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{sysEntry.detailNotes}</p>
            </TooltipContent>
          )}
        </Tooltip>
      );
    })}
  </div>
)}
```

On step expand, if there's a related SystemEntry with `detailNotes`, show it:

```
Systems: Excel
  └ "Sheet: Quotes2024, Col A=Supplier Name, Col B=Unit Price, Col C=Currency.
     Data comes from supplier email body. Maria manually copies values."
```

---

## Steps 3.4–3.5 — Process Flow, Creation Form

Same as v1 but with the `detailNotes` tooltip on systems. The creation form is unchanged.

---

## Phase 3 Gate Checklist

- [ ] L1 JSON files created (procurement + unknown minimum)
- [ ] Process creation works with user's API key
- [ ] If no key: process created without hypothesis (graceful)
- [ ] Hypothesis uses model from user's `hypothesis` preference
- [ ] ProcessModel flow renders with confidence colors
- [ ] System badges show detailNotes on hover (empty for now — populated during shadowing)
- [ ] Process status dropdown works

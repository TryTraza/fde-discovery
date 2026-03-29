# AI Layer Refactor: Modular, Observable, Extensible

## Context

The current AI layer has 7 call sites with hardcoded prompt templates, 3 inconsistent context builders, no observability, and no extension points for tools or skills. Alberto wants full control over prompts (versioning, editing without deploys), context assembly (toggleable layers, skill injection), and visibility (traces, cost, latency). This refactor introduces a unified `executeAI()` function that orchestrates everything through clean, separated layers.

---

## New File Structure

```
src/lib/ai/
  execute.ts                        # executeAI() — single entry point for all AI calls
  types.ts                          # All shared interfaces
  get-ai-config.ts                  # KEEP unchanged
  models.ts                         # KEEP unchanged

  observability/
    langfuse.ts                     # Singleton Langfuse client
    tracing.ts                      # withTrace() wrapper

  context/
    pipeline.ts                     # ContextPipeline — runs layers, assembles context
    layers/
      l1-domain.ts                  # L1: domain library lookup
      l2-client-process.ts          # L2: client + process + model from DB
      l3-session.ts                 # L3: session data, configurable via l3Options (full or lightweight)
      skills.ts                     # Skills: injectable knowledge fragments

  prompts/
    registry.ts                     # Fetch from Langfuse or fall back to local
    local/                          # Local prompt templates (system + user, with {{variables}})
      company-research.ts
      process-hypothesis.ts
      session-interview.ts
      prep-brief.ts
      session-synthesis.ts
      shadowing-synthesis.ts
      capture-suggestions.ts

  tools/
    registry.ts                     # Tool name → factory map
    web-search.ts                   # web_search tool wrapper

  features/                         # One config per AI call site
    company-research.ts
    process-hypothesis.ts
    session-interview.ts
    prep-brief.ts
    session-synthesis.ts
    shadowing-synthesis.ts
    capture-suggestions.ts

  schemas/                          # KEEP unchanged (all Zod schemas stay)
```

---

## Key Types

```typescript
// --- Context ---
type ContextLayerName = 'l1-domain' | 'l2-client-process' | 'l3-session' | 'skills';

interface AssembledContext {
  l1?: { domain: L1Domain };
  l2?: { client: ClientContext; process: ProcessContext };
  l3?: SessionLayerData;  // Single L3 layer, loads different fields based on l3Options
  skills?: SkillFragment[];
  raw: Record<string, unknown>;  // Flat key-value map for prompt template interpolation
}

// --- Skills ---
interface SkillFragment {
  slug: string;
  label: string;
  content: string;
  type: 'system-prompt' | 'context-enrichment' | 'instruction';
}

// --- Prompts ---
interface PromptTemplate {
  name: string;
  version: string;
  systemPrompt: string | null;
  userPromptTemplate: string;  // Uses {{variable}} placeholders
}

// --- Feature Config (one per AI call site) ---
interface AIFeatureConfig {
  name: string;
  feature: AIFeature;              // Model resolution slot
  promptName: string;              // Key in prompt registry
  contextLayers: ContextLayerName[];
  l3Options?: {                    // Only when 'l3-session' is in contextLayers
    events?: 'all' | 'last20' | 'none';  // default: 'all'
    includeContacts?: boolean;     // default: true
    includePriorSessions?: boolean; // default: true
    includeDebrief?: boolean;      // default: true
  };
  tools?: ToolDeclaration[];
  skills?: string[];               // Skill slugs to auto-inject
  schema?: z.ZodType<any>;        // For generateObject; omit for generateText
  mode: 'generateObject' | 'generateText';
  maxOutputTokens?: number;
  stopWhen?: any;
}

// --- executeAI ---
interface ExecuteAIInput<T = unknown> {
  featureConfig: AIFeatureConfig;
  params: Record<string, unknown>;  // Pipeline params + extra template vars
  model?: LanguageModel;            // Pre-resolved (for fire-and-forget)
  anthropic?: any;                  // Pre-resolved provider (for tools)
}

interface ExecuteAIResult<T = unknown> {
  data: T;
  traceId: string;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
  promptVersion: string;
  modelId: string;
}
```

---

## How executeAI() Works

```
executeAI(input):
  1. Start Langfuse trace (name = feature name, metadata = params)
  2. Resolve model — use input.model or call getAIConfig(feature)
  3. Run ContextPipeline.assemble(layers, params) → AssembledContext
  4. Fetch prompt from PromptRegistry.getPrompt(promptName) → PromptTemplate
  5. Compile prompt — replace {{variables}} with AssembledContext.raw values
  6. Inject skills:
     - 'system-prompt' skills → append to system prompt
     - 'instruction' skills → append to user prompt
     - 'context-enrichment' skills → merge into template vars before compile
  7. Resolve tools from feature config declarations
  8. Call generateObject() or generateText() via Vercel AI SDK
  9. Record Langfuse generation (model, tokens, latency, prompt version)
  10. Return ExecuteAIResult
```

---

## Implementation Phases

### Phase 0: Foundation (no behavior change)
1. `npm install langfuse`
2. Create `types.ts` with all interfaces
3. Create `observability/langfuse.ts` — singleton client from env vars (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`)
4. Create `observability/tracing.ts` — `withTrace()` wrapper that creates trace → generation span → records usage
5. Add env vars to `.env.example`

### Phase 1: Prompt Registry
6. Create `prompts/registry.ts` — `getPrompt(name, version?)`:
   - Try Langfuse `langfuse.getPrompt(name)` if configured
   - Fall back to local file
   - Cache with 60s TTL (dev) / 300s (prod)
7. Migrate each of the 7 existing prompt functions into `prompts/local/` as split `{ systemPrompt, userPromptTemplate }` — pure string templates, no AI calls, no DB queries

### Phase 2: Context Pipeline
8. Create `context/pipeline.ts` — `ContextPipeline.assemble(config)`
9. Create layer files:
   - `l1-domain.ts` — wraps `getL1()` / `getAllL1Domains()`
   - `l2-client-process.ts` — fetches client + process + model from DB
   - `l3-session.ts` — fetches session data; respects `l3Options` to load full (contacts, prior sessions, all events, debrief) or lightweight (last 20 events only, skip contacts/prior sessions)
   - `skills.ts` — loads skill fragments by slug from a local registry
10. Each layer returns typed data + contributes to `raw` flat map for template vars

### Phase 3: Tool Registry + Skills
11. Create `tools/registry.ts` — map of tool name → factory function
12. Create `tools/web-search.ts` — wraps `anthropic.tools.webSearch_20250305()`
13. Create initial skill fragments (e.g., `procurement-expert`) as static files

### Phase 4: Feature Configs + executeAI
14. Create `features/*.ts` — one config per AI call site declaring layers, prompt, schema, tools, skills
15. Create `execute.ts` — the unified executor wiring everything together

### Phase 5: Migrate Call Sites (one at a time, lowest risk first)

| Order | Feature | Current File | Notes |
|-------|---------|-------------|-------|
| 1 | capture-suggestions | `api/ai/suggestions/route.ts` | Graceful degradation makes it safe. Uses L3 with `{ events: 'last20', includeContacts: false, includePriorSessions: false }`. |
| 2 | company-research | `prompts/company-research.ts` | Self-contained fire-and-forget. Pass pre-resolved model. |
| 3 | process-hypothesis | `prompts/process-hypothesis.ts` | Fire-and-forget. Pre-resolved model pattern preserved. |
| 4 | session-interview | `api/sessions/interview/route.ts` | Currently builds context manually — will use L2 layer. |
| 5 | prep-brief | `api/sessions/[id]/prep-brief/route.ts` | Cleanest current implementation. Straightforward. |
| 6 | session-synthesis | `api/sessions/[id]/synthesize/route.ts` | Two code paths (shadowing vs non). Become two feature configs. |
| 7 | shadowing-synthesis | Same route as above | Migrated alongside session-synthesis. |

Each migration:
- Create feature config in `features/`
- Verify local prompt template produces equivalent output to old inline template
- Update route to call `executeAI()` instead of direct `generateObject`/`generateText`
- Delete old prompt builder once migrated

### Phase 6: Langfuse Prompt Sync
16. Create `scripts/sync-prompts-to-langfuse.ts` — reads each local template, uploads to Langfuse
17. In production, Langfuse is runtime source (hot updates, A/B testing). In dev, local files.

---

## Inconsistencies Fixed

1. **System prompt**: Shadowing synthesis has one, non-shadowing doesn't → both get explicit system prompts
2. **Context builders**: 3 different approaches → 1 pipeline with configurable layers
3. **Interview context**: Manual DB queries in route → uses L2 layer like everything else
4. **L1 domain usage**: Only 2 of 7 calls use it → any feature can declare `l1-domain` layer

---

## Fire-and-Forget Pattern (Preserved)

For company-research and process-hypothesis, the route resolves model BEFORE detaching:
```typescript
const { model, anthropic } = await getAIConfig('research');
// fire-and-forget — auth context gone after response sent
executeAI({ featureConfig, params, model, anthropic }).then(persist).catch(log);
return NextResponse.json({ message: 'Started' }, { status: 202 });
```

## Suggestions Graceful Degradation (Preserved)

The suggestions route keeps its try/catch returning `{ suggestions: [] }`. `executeAI` throws on errors — the route catches them.

---

## Verification Plan

1. **Unit tests** for each new module:
   - `context/pipeline.test.ts` — mock DB, verify layer assembly with different configs
   - `prompts/registry.test.ts` — mock Langfuse, verify fallback + caching
   - `observability/tracing.test.ts` — mock Langfuse, verify trace structure
   - `execute.test.ts` — mock everything, verify full orchestration

2. **Prompt snapshot tests**: For each `prompts/local/*.ts`, compile with known vars and snapshot the output. Catches regressions during migration.

3. **Migration regression**: After each call site migration, run existing API route tests to confirm identical behavior.

4. **Manual smoke test**: After all migrations, run through the full flow (create client → research → create process → hypothesis → create session → interview → prep brief → shadowing → debrief → synthesis) and verify Langfuse dashboard shows all traces.

---

## Critical Files

| File | Role |
|------|------|
| `src/lib/ai/execute.ts` | **New** — Unified executor, central piece |
| `src/lib/ai/types.ts` | **New** — All shared interfaces |
| `src/lib/ai/context/pipeline.ts` | **New** — Replaces 3 context builders |
| `src/lib/ai/prompts/registry.ts` | **New** — Langfuse-or-local prompt resolution |
| `src/lib/ai/observability/tracing.ts` | **New** — Langfuse trace wrapper |
| `src/lib/ai/observability/langfuse.ts` | **New** — Singleton client |
| `src/lib/ai/features/*.ts` | **New** — One config per AI call site |
| `src/lib/ai/prompts/local/*.ts` | **New** — Migrated prompt templates |
| `src/lib/ai/context.ts` | **Delete** after Phase 5 (replaced by pipeline) |
| `src/lib/ai/context/capture-context.ts` | **Delete** after Phase 5 (absorbed into l3-session layer with lightweight options) |
| `src/lib/ai/prompts/company-research.ts` | **Delete** after migration |
| `src/lib/ai/prompts/process-hypothesis.ts` | **Delete** after migration |
| `src/lib/ai/prompts/session-interview.ts` | **Delete** after migration |
| `src/lib/ai/prompts/prep-brief.ts` | **Delete** after migration |
| `src/lib/ai/prompts/session-synthesis.ts` | **Delete** after migration |
| `src/lib/ai/prompts/shadowing-synthesis.ts` | **Delete** after migration |
| `src/lib/ai/prompts/capture-suggestions.ts` | **Delete** after migration |

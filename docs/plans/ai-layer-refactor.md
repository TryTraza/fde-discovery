# AI Layer Refactor v4: Config-Driven Builder with Langfuse Prompt Repository

## Context

The current AI layer has 7+ call sites with hardcoded prompt templates, 3 inconsistent context builders, no observability, and no extension points. This refactor replaces everything with a **config-driven builder** — a single `executeAI()` function that constructs and executes AI calls from declarative config objects.

The goal: defining a new AI feature should require inserting config rows into the database, registering a prompt in Langfuse, and optionally adding a Zod schema. Zero orchestration code. Hot-swappable prompts without redeployment.

---

## Architectural Corrections from v3 Plan

The v3 plan correctly identified the need for DB-persisted config and a builder pattern. But it made several structural mistakes that this v4 plan corrects:

### 1. Prompt templates do NOT belong in the database

The v3 plan stores prompt templates in an `ai_prompt_templates` table. This is wrong. Langfuse already provides a purpose-built prompt management system with versioning, labels (production/staging), diff views, rollback, A/B testing via experiments, a playground for iteration, and cached SDK fetching with zero added latency. Building a homebrew prompt table duplicates all of this — badly.

**v4 correction:** Prompts live in Langfuse. The `ai_features` config references prompts by Langfuse prompt name (not a DB slug). The builder fetches the `production`-labeled version at runtime via the Langfuse JS SDK (cached client-side, sub-1ms after first fetch). Prompt iteration happens in the Langfuse UI — no code change, no DB migration, no deploy.

What this gives you for free that the v3 DB table doesn't:
- Immutable version history with diff view
- Labels for environment routing (`production`, `staging`, `experiment-a`)
- Rollback by reassigning the `production` label to a previous version
- A playground for testing prompt changes against live models before promoting
- Linking prompt versions to traces for performance analysis per version
- Protected labels (only admins can modify `production`)

### 2. Skills MUST be user-creatable via UI

The v3 plan treats skills as seed data with a future settings UI (Phase 7d). This inverts the priority. Skills are the primary extensibility mechanism — they let Alberto define domain-specific context (freight forwarding knowledge, procurement patterns, rebate processing rules) that gets injected into any AI feature. The UI for creating and managing skills should be built early, not deferred to the last phase.

**v4 correction:** Skills are a first-class entity with full CRUD UI in Phase 3. Skills are DB-persisted with three types: `system-prompt` (prepended to system prompt), `context-enrichment` (merged into template vars), `instruction` (appended to user prompt). Any AI feature config can reference skills by slug. Users create skills directly from the settings page — no code required.

### 3. Tools belong in code, not in the database

The v3 plan stores tools as a `ToolsConfig` JSONB blob (`{ webSearch: true, maxSteps: 3 }`). This conflates two concerns: **which tools exist** (code-level infrastructure — SDK objects, provider methods, MCP connections) and **which tools an agent uses** (configuration). A non-developer cannot meaningfully create a tool from a settings UI — tools are SDK integrations that require code.

**v4 correction:** Tools live in a code-side registry (`tools/registry.ts`), same pattern as the Zod schema registry. Each tool is a factory function that produces the SDK tool object. The agent config references tools by slug in a JSONB array with per-agent options (like `maxSteps`). Adding a new tool type = adding a factory function to the registry. Configuring which agents use it = editing the agent's `tools` JSONB in the DB. No tool tables, no join tables, no tool CRUD UI.

### 4. The template engine is unnecessary complexity

The v3 plan builds a custom `{{variable}}` / `{{#if}}` / `{{#each}}` template engine. Langfuse already has its own variable syntax (`{{variable}}`), and the Langfuse SDK compiles templates with variables at fetch time. Building a second template engine means maintaining two interpolation syntaxes and debugging mismatches between them.

**v4 correction:** Use Langfuse's built-in variable interpolation. The builder collects template variables from layers, skills, and overrides, then passes them to `langfusePrompt.compile({ variables })`. One template engine, managed by Langfuse.

For complex rendering needs (arrays, conditionals), the layer's `resolve()` function pre-renders that section into a string. The template variable receives the already-formatted string. This keeps the template simple and the logic in testable TypeScript.

### 5. The hook registry is over-engineered

The v3 plan creates a `hookRegistry` map with string keys referencing functions, stored in the feature config as `hooks.onFinish: 'save-research-response'`. This is indirection for the sake of indirection. Only one feature (research-chat) uses `onFinish`, and it's inherently tied to that route's behavior (saving to `research_notes`).

**v4 correction:** Drop the hook registry entirely. `onFinish` behavior stays in the route handler, not the builder. The builder returns the result (or stream); the route decides what to do with it. This is simpler, more explicit, and doesn't require a string-to-function lookup table.

### 6. Missing: The concept of an "AI Agent" as the top-level entity

The v3 plan calls the top-level config `AIFeatureConfig` — a generic name that doesn't communicate intent. In Traza's domain, these are AI agents: capture-suggestions is an agent, research-chat is an agent, session-synthesis is an agent. Each agent has a specific purpose, a configured set of context layers, a prompt (from Langfuse), tools, and skills.

**v4 correction:** Rename `ai_features` → `ai_agents`. The table and types use the term "agent" consistently. This aligns with Traza's workforce design methodology and makes the settings UI intuitive: "AI Agents" is a settings section where you see capture-suggestions, research-chat, etc., each with its configuration.

### 7. Observability is shallow

The v3 plan wraps AI calls in `withTrace()` and records generations. But it doesn't link prompt versions to traces (Langfuse's killer feature for debugging), doesn't track layer-level spans as proper Langfuse spans, and doesn't record the resolved template variables (critical for debugging why a prompt produced bad output).

**v4 correction:** Full Langfuse integration:
- Each `executeAI()` call creates a Langfuse trace with `name = agentSlug`
- Each layer execution is a span within the trace (with timing + input/output)
- The prompt fetch links the prompt version to the trace automatically (Langfuse SDK does this when you pass `langfusePrompt` metadata)
- The final generation records: model, resolved system prompt, resolved user prompt, output, token usage
- Template variables are recorded as trace metadata (for debugging)

---

## Summary of Changes from v3

| v3 Plan | v4 Correction | Why |
|---------|---------------|-----|
| `ai_prompt_templates` DB table | Langfuse prompt repository | Purpose-built tool with versioning, labels, rollback, playground, diff views. Don't rebuild it. |
| Custom `{{variable}}` / `{{#if}}` / `{{#each}}` template engine | Langfuse `prompt.compile()` + layer pre-rendering | One template engine, not two. Complex rendering in testable TypeScript. |
| Skills as seed data, UI in Phase 7 | Skills as first-class CRUD entity in Phase 3 | Skills are the primary extensibility point. Users need to create them early. |
| Tools as inline JSONB (`{ webSearch: true }`) | Code-side tool registry + JSONB `tools` array on agent config | Tools are code infrastructure (SDK objects). Config says which tools + options. Same pattern as schema registry. |
| `AIFeatureConfig` / `ai_features` table | `AIAgentConfig` / `ai_agents` table | Aligns with Traza workforce design. "Agent" communicates intent. |
| `hookRegistry` with string-to-function mapping | Hooks stay in route handlers | One feature uses `onFinish`. Indirection adds complexity without value. |
| Shallow Langfuse (wrap + record) | Deep Langfuse (trace → layer spans → prompt link → generation) | Debug-grade observability. Link prompt versions to performance. |
| `LayerResult.templateVars` as `Record<string, unknown>` | `LayerResult.templateVars` as `Record<string, string>` | Langfuse variables are strings. Layers pre-render complex types to strings. |
| Phase ordering: layers, skills, templates in parallel | Phase ordering: DB schema → skills (with UI) → layers → builder → routes | Skills UI early so Alberto can start creating domain knowledge immediately. |

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Route Handler                           │
│  (auth, request parsing, response formatting)               │
│                                                             │
│  const result = await executeAI({                          │
│    agentSlug: 'capture-suggestions',                       │
│    params: { sessionId },                                   │
│    userId,                                                  │
│  });                                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    executeAI() Builder                       │
│                                                             │
│  1. Load agent config from DB (ai_agents table)             │
│  2. Validate config with Zod                                │
│  3. Resolve model (user API key + tier mapping)             │
│  4. Start Langfuse trace                                    │
│  5. Run context layers in parallel (with timeout)           │
│  6. Resolve skills from DB                                  │
│  7. Resolve tools from code-side registry                   │
│  8. Fetch prompt from Langfuse (cached)                     │
│  9. Merge template variables (layers + skills + overrides)  │
│ 10. Compile prompt with variables (Langfuse SDK)            │
│ 11. Build system prompt (skills + compiled prompt)          │
│ 12. Execute AI SDK call (generateObject/Text, streamText)   │
│ 13. Record generation to Langfuse                           │
│ 14. Return structured result with metadata                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Target File Structure

```
src/lib/ai/
  types.ts                     # All shared interfaces + Zod validation schemas
  builder.ts                   # executeAI() — config reader + executor
  observe.ts                   # Langfuse client singleton + trace/span helpers
  get-ai-config.ts             # KEEP — per-user API key + model resolution
  models.ts                    # KEEP
  create-model.ts              # KEEP

  schemas/
    registry.ts                # Code-side Zod schema map: slug → { label, description, schema }

  layers/
    types.ts                   # ContextLayer interface + LayerResult
    registry.ts                # Layer registry (name → ContextLayer)
    l1-domain.ts               # L1: domain library
    l2-client.ts               # L2: client data
    l3-process.ts              # L3: process + model data
    l4-session.ts              # L4: session data

  skills/
    resolver.ts                # resolveSkills(slugs) → ResolvedSkills

  tools/
    registry.ts                # Code-side tool registry: slug → factory function

  # DELETE after all migrations complete:
  context.ts
  context/capture-context.ts
  prompts/capture-suggestions.ts
  prompts/company-research.ts
  prompts/email-draft.ts
  prompts/prep-brief.ts
  prompts/process-hypothesis.ts
  prompts/session-interview.ts
  prompts/session-synthesis.ts
  prompts/shadowing-synthesis.ts

src/lib/db/
  schema.ts                    # Add: aiAgents, skills tables
  queries/
    ai-agents.ts               # getAgentBySlug, listAgents, upsertAgent
    skills.ts                  # CRUD for skills

app/api/settings/
  ai-agents/
    route.ts                   # GET (list)
    [slug]/route.ts            # GET, PATCH
  skills/
    route.ts                   # GET (list), POST (create)
    [id]/route.ts              # GET, PATCH, DELETE (soft)
  registries/
    route.ts                   # GET — returns available tools + schemas (for UI dropdowns)

app/(dashboard)/settings/
  ai-agents/page.tsx           # Agent list + edit dialogs
  skills/page.tsx              # Skills CRUD UI

# Seed migration (idempotent):
drizzle/seed/
  ai-agents.ts                 # 9 initial agent configs
  skills.ts                    # Initial skills (process-archaeology, etc.)

# Langfuse seed script:
scripts/
  seed-langfuse-prompts.ts     # Upload 9 initial prompts to Langfuse
```

---

## Database Schema

### Enums

```typescript
export const aiModeEnum = pgEnum('ai_mode', ['generateObject', 'generateText', 'streamText']);
export const modelTierEnum = pgEnum('model_tier', ['fast', 'standard']);
export const skillTypeEnum = pgEnum('skill_type', ['system-prompt', 'context-enrichment', 'instruction']);
```

### AI Agents (main config table)

```typescript
export const aiAgents = pgTable('ai_agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),                           // What this agent does (for settings UI)
  mode: aiModeEnum('mode').notNull(),
  model: modelTierEnum('model').notNull(),

  layers: jsonb('layers').notNull().default([]),              // LayerSpec[] — which layers + options
  langfusePromptName: text('langfuse_prompt_name').notNull(), // Prompt name in Langfuse
  schemaSlug: text('schema_slug'),                            // Key into code-side schema registry
  tools: jsonb('tools').notNull().default([]),                // ToolSpec[] — which tools + options

  maxOutputTokens: integer('max_output_tokens').notNull().default(1000),
  skills: jsonb('skills').notNull().default([]),              // string[] — skill slugs to inject

  resilience: jsonb('resilience').notNull(),                  // ResilienceConfig

  enabled: boolean('enabled').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Skills (user-creatable)

```typescript
export const skills = pgTable('skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),                           // What this skill does (for settings UI)
  type: skillTypeEnum('type').notNull(),
  content: text('content').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

**Why no `ai_prompt_templates` table?** Because prompts live in Langfuse. See correction #1 above.

---

## Key Types

```typescript
// ═══════════════════════════════════════
// Layer System
// ═══════════════════════════════════════

interface LayerParams {
  sessionId?: string;
  processId?: string;
  clientId?: string;
  rawData?: Record<string, unknown>;  // Pre-loaded data (avoids DB queries)
}

interface LayerResult {
  data: Record<string, unknown>;      // Typed data for programmatic access
  templateVars: Record<string, string>; // For Langfuse prompt interpolation — ALL strings
}

// WHY templateVars is Record<string, string>:
// Langfuse variables are strings. The layer is responsible for pre-rendering
// complex types (arrays, objects, conditionals) into formatted strings.
// This eliminates the need for a custom template engine.
//
// Example: L4 session layer with events
//   Instead of: templateVars.sessionEvents = [event1, event2, event3]  // array
//   Do:         templateVars.sessionEvents = "- Step: Open ERP\n- Step: Check PO\n- Edge: If approved"
//   And:        templateVars.hasSessionEvents = "true"  // for Langfuse {{#if}} equiv
//
// For conditionals, use a boolean-as-string flag and structure the Langfuse
// prompt as two variants (with/without section), or use the layer to produce
// the entire conditional block as a single string variable.

interface ContextLayer<TOptions = unknown> {
  name: string;
  resolve(params: LayerParams, options?: TOptions): Promise<LayerResult>;
}

// ═══════════════════════════════════════
// Layer Option Types
// ═══════════════════════════════════════

interface L1Options {
  mode: 'matched' | 'all';
}

interface L2Options {
  fields?: 'full' | 'summary';
}

interface L3Options {
  includeModel: boolean;
  fields?: 'full' | 'summary';
}

interface L4Options {
  events: 'all' | 'last20' | 'none';
  contacts: boolean;
  priorSessions: boolean;
  debrief: boolean;
}

// ═══════════════════════════════════════
// Layer Spec (stored as JSONB in ai_agents)
// ═══════════════════════════════════════

const layerSpecSchema = z.object({
  layer: z.enum(['l1-domain', 'l2-client', 'l3-process', 'l4-session']),
  options: z.record(z.unknown()).optional(),
});

interface LayerSpec {
  layer: 'l1-domain' | 'l2-client' | 'l3-process' | 'l4-session';
  options?: Record<string, unknown>;
}

// ═══════════════════════════════════════
// Config Sub-Types
// ═══════════════════════════════════════

interface ResilienceConfig {
  layerTimeout: number;          // Per-layer timeout in ms
  totalTimeout: number;          // Total execution timeout in ms
  fallbackOnLayerError: boolean; // Continue with partial context if a layer fails
}

// ═══════════════════════════════════════
// AIAgentConfig (runtime type after DB read)
// ═══════════════════════════════════════

type AIMode = 'generateObject' | 'generateText' | 'streamText';
type ModelTier = 'fast' | 'standard';

interface AIAgentConfig {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  mode: AIMode;
  model: ModelTier;
  layers: LayerSpec[];
  langfusePromptName: string;
  schemaSlug: string | null;
  tools: ToolSpec[];
  maxOutputTokens: number;
  skills: string[];
  resilience: ResilienceConfig;
  enabled: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// Zod validation schema:
const resilienceConfigSchema = z.object({
  layerTimeout: z.number().int().positive(),
  totalTimeout: z.number().int().positive(),
  fallbackOnLayerError: z.boolean(),
});

const aiAgentConfigSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  description: z.string().nullable().default(null),
  mode: z.enum(['generateObject', 'generateText', 'streamText']),
  model: z.enum(['fast', 'standard']),
  layers: z.array(layerSpecSchema),
  langfusePromptName: z.string().min(1),
  schemaSlug: z.string().nullable(),
  tools: z.array(toolSpecSchema).default([]),
  maxOutputTokens: z.number().int().positive().default(1000),
  skills: z.array(z.string()).default([]),
  resilience: resilienceConfigSchema,
  enabled: z.boolean().default(true),
}).refine(
  (c) => c.mode !== 'generateObject' || c.schemaSlug !== null,
  { message: 'generateObject mode requires a schemaSlug' }
);

// ═══════════════════════════════════════
// Skills
// ═══════════════════════════════════════

type SkillType = 'system-prompt' | 'context-enrichment' | 'instruction';

interface Skill {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  type: SkillType;
  content: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface ResolvedSkills {
  systemPromptFragments: string[];            // Prepended to system prompt
  contextEnrichments: Record<string, string>; // Merged into template vars
  instructions: string[];                     // Appended after compiled prompt
}

// ═══════════════════════════════════════
// Tool Spec (stored as JSONB in ai_agents.tools)
// ═══════════════════════════════════════

const toolSpecSchema = z.object({
  tool: z.string().min(1),                  // Slug into code-side tool registry
  options: z.record(z.unknown()).optional(), // Per-agent options (e.g., { maxSteps: 3 })
});

interface ToolSpec {
  tool: string;                             // 'web-search', 'mcp-asana', etc.
  options?: Record<string, unknown>;        // { maxSteps: 3 }
}

// ═══════════════════════════════════════
// Code-Side Registries (tools + schemas)
// ═══════════════════════════════════════

// Both registries follow the same pattern:
// - Implementation lives in code (can't be serialized to DB)
// - Agent config references entries by slug
// - Registry exposes metadata (label, description) so the settings UI
//   can present dropdowns without hardcoding names in the frontend
// - A GET /api/settings/registries endpoint returns all available
//   tools and schemas for the UI to consume

// ── Tool Registry ──
// src/lib/ai/tools/registry.ts

interface ToolRegistryEntry {
  slug: string;
  label: string;
  description: string;
  optionsSchema?: z.ZodType;               // Zod schema for validating per-agent options
  factory: (anthropic: any, options?: Record<string, unknown>) => unknown;
}

const toolRegistry: Record<string, ToolRegistryEntry> = {
  'web-search': {
    slug: 'web-search',
    label: 'Web Search',
    description: 'Anthropic built-in web search tool. Options: maxSteps (default 3).',
    optionsSchema: z.object({ maxSteps: z.number().int().positive().optional() }).optional(),
    factory: (anthropic, _options) => anthropic.tools.webSearch_20250305(),
  },
  // Future examples:
  // 'mcp-asana': {
  //   slug: 'mcp-asana',
  //   label: 'Asana (MCP)',
  //   description: 'Create and manage Asana tasks via MCP.',
  //   factory: (_, options) => createMCPTool(options?.serverUrl as string),
  // },
};

export function getTool(slug: string): ToolRegistryEntry {
  const entry = toolRegistry[slug];
  if (!entry) throw new Error(`Unknown tool: "${slug}". Available: ${Object.keys(toolRegistry).join(', ')}`);
  return entry;
}

export function listAvailableTools(): Array<{ slug: string; label: string; description: string }> {
  return Object.values(toolRegistry).map(({ slug, label, description }) => ({ slug, label, description }));
}

// ── Schema Registry ──
// src/lib/ai/schemas/registry.ts

interface SchemaRegistryEntry {
  slug: string;
  label: string;
  description: string;
  schema: z.ZodType;
}

const schemaRegistry: Record<string, SchemaRegistryEntry> = {
  'capture-suggestions': {
    slug: 'capture-suggestions',
    label: 'Capture Suggestions',
    description: 'Array of suggested next steps with name, description, and confidence.',
    schema: captureSuggestionsSchema,
  },
  'process-hypothesis': {
    slug: 'process-hypothesis',
    label: 'Process Hypothesis',
    description: 'Hypothesis text + array of inferred process steps.',
    schema: processHypothesisSchema,
  },
  'session-interview': {
    slug: 'session-interview',
    label: 'Session Interview',
    description: 'Follow-up questions for session setup interview.',
    schema: sessionInterviewSchema,
  },
  'prep-brief': {
    slug: 'prep-brief',
    label: 'Prep Brief',
    description: 'Pre-session briefing with context summary, focus areas, and suggested questions.',
    schema: prepBriefSchema,
  },
  'session-synthesis': {
    slug: 'session-synthesis',
    label: 'Session Synthesis',
    description: 'Post-session synthesis with process model changes, open questions, and action items.',
    schema: sessionSynthesisSchema,
  },
  'shadowing-synthesis': {
    slug: 'shadowing-synthesis',
    label: 'Shadowing Synthesis',
    description: 'Post-shadowing synthesis with event analysis, system aggregation, and process model updates.',
    schema: shadowingSynthesisSchema,
  },
};

export function getSchema(slug: string): z.ZodType {
  const entry = schemaRegistry[slug];
  if (!entry) throw new Error(`Unknown schema: "${slug}". Available: ${Object.keys(schemaRegistry).join(', ')}`);
  return entry.schema;
}

export function listAvailableSchemas(): Array<{ slug: string; label: string; description: string }> {
  return Object.values(schemaRegistry).map(({ slug, label, description }) => ({ slug, label, description }));
}

// ── Registries API ──
// GET /api/settings/registries returns:
// { tools: listAvailableTools(), schemas: listAvailableSchemas() }
// The agent settings UI uses this to populate dropdowns for schema and tool selection.

// ═══════════════════════════════════════
// Builder Input / Output
// ═══════════════════════════════════════

interface AIBuilderInput {
  agentSlug: string;
  params: LayerParams;
  userId: string;                     // Required — for getAIConfig (API key resolution)
  model?: LanguageModel;              // Pre-resolved model (skips getAIConfig)
  anthropic?: any;                    // Pre-resolved provider (for tools)
  messages?: UIMessage[];             // Required for streamText mode
  overrides?: {
    templateVars?: Record<string, string>;
    systemPromptAppend?: string;
    userPromptAppend?: string;
    modelTier?: ModelTier;
  };
}

interface AIBuilderResult<T = unknown> {
  data?: T;                           // For generateObject
  text?: string;                      // For generateText
  stream?: any;                       // For streamText (DataStreamResponse)
  meta: {
    agentSlug: string;
    configVersion: number;
    promptVersion: number;            // Langfuse prompt version used
    model: string;
    layerTimings: Record<string, number>;
    totalDuration: number;
    layerErrors: Array<{ layer: string; error: string }>;
    traceId?: string;                 // Langfuse trace ID
  };
}
```

---

## The Builder: `executeAI()`

```typescript
// src/lib/ai/builder.ts

import { Langfuse } from 'langfuse';

export async function executeAI<T = unknown>(
  input: AIBuilderInput
): Promise<AIBuilderResult<T>> {
  const startTime = Date.now();

  // 1. Load agent config from DB
  const config = await getAgentBySlug(input.agentSlug);
  if (!config) throw new Error(`Unknown AI agent: "${input.agentSlug}"`);
  if (!config.enabled) throw new Error(`AI agent "${input.agentSlug}" is disabled`);

  // 2. Validate config shape (defense against bad DB data)
  const validated = aiAgentConfigSchema.parse(config);

  // 3. Resolve model (from input or via getAIConfig + tier mapping)
  const { model, anthropic } = input.model
    ? { model: input.model, anthropic: input.anthropic }
    : await resolveModelFromConfig(validated.model, input.overrides?.modelTier, input.userId);

  // 4. Start Langfuse trace
  const langfuse = getLangfuseClient();
  const trace = langfuse?.trace({
    name: validated.slug,
    metadata: {
      configVersion: validated.version,
      mode: validated.mode,
      model: validated.model,
    },
  });

  try {
    // 5. Run all layers in parallel with per-layer timeout + error isolation
    const layerResults = await runLayers(
      validated.layers,
      input.params,
      validated.resilience,
      trace,
    );

    // 6. Resolve skills (if configured)
    const skills = validated.skills.length > 0
      ? await resolveSkills(validated.skills)
      : EMPTY_SKILLS;

    // 7. Resolve tools (from code-side registry using config.tools)
    const resolvedTools = resolveTools(validated.tools, anthropic);

    // 8. Fetch prompt from Langfuse (cached, <1ms after first call)
    const langfusePrompt = await fetchLangfusePrompt(validated.langfusePromptName);

    // 9. Merge template variables
    const vars: Record<string, string> = {
      ...mergeLayerTemplateVars(layerResults.results),
      ...skills.contextEnrichments,
      ...input.overrides?.templateVars,
    };

    // 10. Compile prompt with Langfuse SDK
    const compiledPrompt = compilePrompt(langfusePrompt, vars);

    // 11. Build final system prompt
    const systemPrompt = buildSystemPrompt(compiledPrompt, skills, input.overrides);
    const userPrompt = compiledPrompt.userPrompt
      ? compiledPrompt.userPrompt + (input.overrides?.userPromptAppend ?? '')
      : undefined;

    // 12. Resolve Zod schema if generateObject
    const schema = validated.mode === 'generateObject'
      ? getSchema(validated.schemaSlug!)
      : undefined;

    // 13. Execute AI SDK call based on mode
    const result = await executeMode(
      validated, model, systemPrompt, userPrompt,
      schema, resolvedTools, input,
    );

    // 14. Record generation to Langfuse
    trace?.generation({
      name: `${validated.slug}-generation`,
      model: validated.model === 'fast' ? 'claude-haiku-4-5' : 'claude-sonnet-4',
      input: { system: systemPrompt, user: userPrompt },
      output: result.data ?? result.text ?? '[stream]',
      metadata: {
        configVersion: validated.version,
        promptVersion: langfusePrompt.version,
        templateVars: vars,
      },
      promptName: validated.langfusePromptName,
      promptVersion: langfusePrompt.version,
    });

    // 15. Return structured result
    return {
      ...result,
      meta: {
        agentSlug: validated.slug,
        configVersion: validated.version,
        promptVersion: langfusePrompt.version,
        model: validated.model,
        layerTimings: layerResults.timings,
        totalDuration: Date.now() - startTime,
        layerErrors: layerResults.errors,
        traceId: trace?.id,
      },
    } as AIBuilderResult<T>;

  } finally {
    // Flush Langfuse events (non-blocking)
    langfuse?.flushAsync().catch(() => {});
  }
}
```

### Internal Helpers

```typescript
// ── Model Resolution ──

async function resolveModelFromConfig(
  tier: ModelTier,
  tierOverride: ModelTier | undefined,
  userId: string,
): Promise<{ model: LanguageModel; anthropic: any }> {
  const effectiveTier = tierOverride ?? tier;
  const { model, anthropic } = await getAIConfig(userId);
  if (effectiveTier === 'fast') {
    const haiku = createModel(anthropic, 'claude-haiku-4-5-20251001');
    return { model: haiku, anthropic };
  }
  return { model, anthropic };
}

// ── Layer Execution ──

async function runLayers(
  specs: LayerSpec[],
  params: LayerParams,
  resilience: ResilienceConfig,
  trace?: LangfuseTraceClient,
): Promise<{
  results: LayerResult[];
  timings: Record<string, number>;
  errors: Array<{ layer: string; error: string }>;
}> {
  const timings: Record<string, number> = {};
  const errors: Array<{ layer: string; error: string }> = [];

  const results = await Promise.all(
    specs.map(async (spec) => {
      const span = trace?.span({ name: `layer:${spec.layer}` });
      const start = Date.now();
      try {
        const layer = getLayer(spec.layer);
        const result = await Promise.race([
          layer.resolve(params, spec.options),
          rejectAfter(resilience.layerTimeout, `Layer ${spec.layer} timed out after ${resilience.layerTimeout}ms`),
        ]);
        timings[spec.layer] = Date.now() - start;
        span?.end({ output: { timing: timings[spec.layer], varsKeys: Object.keys(result.templateVars) } });
        return result;
      } catch (err) {
        const duration = Date.now() - start;
        timings[spec.layer] = duration;
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ layer: spec.layer, error: errorMsg });
        span?.end({ output: { timing: duration, error: errorMsg }, level: 'ERROR' });
        console.warn(`[AI] Layer ${spec.layer} failed (${duration}ms):`, errorMsg);

        if (!resilience.fallbackOnLayerError) {
          throw new Error(`Layer ${spec.layer} failed and fallbackOnLayerError is false: ${errorMsg}`);
        }
        return { data: {}, templateVars: {} } as LayerResult;
      }
    })
  );

  return { results, timings, errors };
}

// ── Langfuse Prompt Fetching ──

async function fetchLangfusePrompt(promptName: string) {
  const langfuse = getLangfuseClient();
  if (!langfuse) {
    throw new Error('Langfuse is not configured. Set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY.');
  }
  // Fetches production-labeled version. Cached client-side by SDK (<1ms after first call).
  return langfuse.getPrompt(promptName, undefined, { label: 'production' });
}

// ── Prompt Compilation ──

interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string | null;
}

function compilePrompt(
  langfusePrompt: LangfusePrompt,
  vars: Record<string, string>,
): CompiledPrompt {
  if (langfusePrompt.type === 'chat') {
    // Chat prompt: array of messages. Find system and user roles.
    const compiled = langfusePrompt.compile(vars);
    const systemMsg = compiled.find((m: any) => m.role === 'system');
    const userMsg = compiled.find((m: any) => m.role === 'user');
    return {
      systemPrompt: systemMsg?.content ?? '',
      userPrompt: userMsg?.content ?? null,
    };
  } else {
    // Text prompt: single string (used as system prompt)
    return {
      systemPrompt: langfusePrompt.compile(vars),
      userPrompt: null,
    };
  }
}

// ── System Prompt Construction ──
// Order: [skill fragments] + [compiled Langfuse prompt] + [skill instructions] + [override append]

function buildSystemPrompt(
  compiled: CompiledPrompt,
  skills: ResolvedSkills,
  overrides?: AIBuilderInput['overrides'],
): string {
  const parts: string[] = [];

  // 1. Skill system-prompt fragments (domain context — goes first)
  if (skills.systemPromptFragments.length > 0) {
    parts.push(skills.systemPromptFragments.join('\n\n'));
  }

  // 2. Compiled Langfuse system prompt (core instruction)
  parts.push(compiled.systemPrompt);

  // 3. Skill instructions (appended as additional instructions)
  if (skills.instructions.length > 0) {
    parts.push('## Additional Instructions\n' + skills.instructions.join('\n'));
  }

  // 4. Override append (per-call tweaks — goes last)
  if (overrides?.systemPromptAppend) {
    parts.push(overrides.systemPromptAppend);
  }

  return parts.join('\n\n').trim();
}

// ── Tool Resolution (code-side registry) ──

interface ResolvedTool {
  slug: string;
  tool: unknown;           // The actual SDK tool object
  maxSteps?: number;       // From per-agent options
}

function resolveTools(
  toolSpecs: ToolSpec[],
  anthropic: any,
): ResolvedTool[] {
  if (toolSpecs.length === 0) return [];

  return toolSpecs
    .map(spec => {
      try {
        const entry = getTool(spec.tool);

        // Validate per-agent options against the tool's options schema
        if (entry.optionsSchema && spec.options) {
          entry.optionsSchema.parse(spec.options);
        }

        const tool = entry.factory(anthropic, spec.options);
        if (!tool) return null;

        return {
          slug: spec.tool,
          tool,
          maxSteps: (spec.options as any)?.maxSteps,
        };
      } catch (err) {
        console.warn(`[AI] Tool ${spec.tool} failed to resolve:`, err);
        return null;
      }
    })
    .filter(Boolean) as ResolvedTool[];
}

// ── Mode Dispatch ──

async function executeMode(
  config: AIAgentConfig,
  model: LanguageModel,
  systemPrompt: string,
  userPrompt: string | undefined,
  schema: z.ZodType | undefined,
  resolvedTools: ResolvedTool[],
  input: AIBuilderInput,
): Promise<Partial<AIBuilderResult>> {
  const tools = resolvedTools.length > 0
    ? Object.fromEntries(resolvedTools.map(t => [t.slug, t.tool]))
    : undefined;
  const maxSteps = resolvedTools.length > 0
    ? Math.max(...resolvedTools.map(t => t.maxSteps ?? 3))
    : undefined;

  switch (config.mode) {
    case 'generateObject': {
      if (!schema) throw new Error(`generateObject requires a schema for "${config.slug}"`);
      if (!userPrompt) throw new Error(`generateObject requires a user prompt for "${config.slug}"`);
      const result = await generateObject({
        model,
        schema,
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: config.maxOutputTokens,
      });
      return { data: result.object };
    }

    case 'generateText': {
      if (!userPrompt) throw new Error(`generateText requires a user prompt for "${config.slug}"`);
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: config.maxOutputTokens,
        ...(tools ? { tools, maxSteps } : {}),
      });
      return { text: result.text };
    }

    case 'streamText': {
      if (!input.messages) throw new Error(`streamText requires messages for "${config.slug}"`);
      const result = streamText({
        model,
        system: systemPrompt,
        messages: await convertToModelMessages(input.messages),
        maxTokens: config.maxOutputTokens,
        ...(tools ? { tools, maxSteps } : {}),
      });
      return { stream: result.toUIMessageStreamResponse() };
    }

    default:
      throw new Error(`Unknown AI mode: "${config.mode}"`);
  }
}
```

---

## Layer Error Isolation

Same as v3 — every layer failure is logged, recorded in `meta.layerErrors`, sent to Langfuse as span metadata, and either swallowed (when `fallbackOnLayerError: true`) or re-thrown.

Features that need real-time responsiveness (capture-suggestions, email-draft) set `fallbackOnLayerError: true`.
Features where incomplete context produces wrong output (synthesis, hypothesis) set it to `false`.

---

## Langfuse Prompt Setup

### Prompt Types

All 9 prompts are created in Langfuse as **chat** type prompts (array of messages with `system` and `user` roles). This maps cleanly to the builder's `systemPrompt` + `userPrompt` pattern.

### Variable Syntax

Langfuse uses `{{variableName}}` for variable interpolation. Since `templateVars` are all strings (layers pre-render complex types), variables are simple substitutions.

### Prompt Creation Script

```typescript
// scripts/seed-langfuse-prompts.ts
// Run: npx tsx scripts/seed-langfuse-prompts.ts
// Idempotent: creates new version if prompt exists, creates prompt if not.

import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_BASE_URL,
});

const PROMPTS = [
  {
    name: 'capture-suggestions',
    type: 'chat' as const,
    prompt: [
      {
        role: 'system',
        content: `You are an AI assistant helping an FDE capture process steps during a shadowing session.

{{domainKnowledge}}

{{processModelSection}}

Based on the observed events, suggest the most likely next steps the operator will take.
Prioritize steps that fill gaps in the current process model.`,
      },
      {
        role: 'user',
        content: `Here are the most recent capture events:

{{sessionEventsSection}}

Suggest 3-5 next steps.`,
      },
    ],
    labels: ['production'],
  },
  // ... remaining 8 prompts follow same pattern
  // Each prompt is extracted from the current prompt builder files
  // using the same 5-step migration approach from v3:
  //   1. Read current prompt builder function
  //   2. Extract the prompt text
  //   3. Replace JS interpolation (${var}) with {{varName}}
  //   4. Layers pre-render conditionals/arrays into string variables
  //   5. Test with representative data
];

async function seed() {
  for (const p of PROMPTS) {
    console.log(`Creating prompt: ${p.name}`);
    await langfuse.createPrompt({
      name: p.name,
      type: p.type,
      prompt: p.prompt,
      labels: p.labels,
    });
  }
  console.log('Prompts seeded to Langfuse.');
  await langfuse.flushAsync();
}

seed().catch(console.error);
```

### How Layers Pre-Render Complex Template Variables

Since Langfuse variables are strings, layers must convert arrays and conditional blocks into pre-rendered strings:

```typescript
// Example: L4 session layer producing sessionEventsSection

resolve(params: LayerParams, options?: L4Options): Promise<LayerResult> {
  // ... fetch events from DB

  // Pre-render the events section as a string
  let sessionEventsSection: string;
  if (events.length === 0) {
    sessionEventsSection = 'No events captured yet. Suggest initial steps based on the process model and domain knowledge.';
  } else {
    sessionEventsSection = events
      .map(e => `- ${e.type}: ${e.label}${e.details ? ` (${e.details})` : ''}`)
      .join('\n');
  }

  // Pre-render domain knowledge section
  let domainKnowledge: string;
  if (domain) {
    domainKnowledge = `## Domain Knowledge\n${JSON.stringify(domain, null, 2)}`;
  } else {
    domainKnowledge = ''; // Empty string = variable resolves to nothing in Langfuse
  }

  return {
    data: { events, domain },
    templateVars: {
      sessionEventsSection,
      domainKnowledge,
    },
  };
}
```

This approach has two advantages over a custom template engine:
1. The rendering logic is in TypeScript — testable, type-safe, debuggable
2. The Langfuse prompt stays simple — just `{{variable}}` substitution, no conditionals

---

## Agent → Layer Mapping (Seed Data Reference)

| Agent | Mode | Model | L1 | L2 | L3 | L4 | Tools | Skills | Notes |
|-------|------|-------|----|----|----|----|-------|--------|-------|
| capture-suggestions | generateObject | fast | matched | — | model, full | last20, no contacts/prior/debrief | — | process-archaeology | Real-time; <2s target |
| company-research | generateText | standard | — | summary (rawData) | — | — | web-search (maxSteps:3) | — | Fire-and-forget |
| process-hypothesis | generateObject | standard | all | summary (rawData) | summary (rawData) | — | — | — | Fire-and-forget |
| session-interview | generateObject | standard | — | full | full | — | — | — | contacts+questionIndex via overrides |
| prep-brief | generateObject | standard | — | full | full | no events, contacts+prior, no debrief | — | — | |
| session-synthesis | generateObject | standard | — | full | full | no events, contacts+prior, no debrief | — | — | |
| shadowing-synthesis | generateObject | standard | — | full | full | all events, contacts, debrief, no prior | — | — | |
| email-draft | generateText | fast | — | — | — | — | — | — | All data via overrides |
| research-chat | streamText | standard | — | full | summary | — | web-search (maxSteps:5) | — | Uses messages |

---

## Layer `rawData` Contracts

Each layer MUST document which `rawData` keys it checks before querying the DB.

### L1 (Domain Library)
| rawData key | Type | Effect |
|-------------|------|--------|
| `processType` | `string` | Used for `mode: 'matched'` instead of looking up from processId |

### L2 (Client)
| rawData key | Type | Effect |
|-------------|------|--------|
| `clientName` | `string` | If ALL summary keys present, skip DB query |
| `clientIndustry` | `string` | See above |
| `clientWebsite` | `string` | Optional, included in summary if present |

### L3 (Process)
| rawData key | Type | Effect |
|-------------|------|--------|
| `processName` | `string` | If ALL summary keys present, skip DB query |
| `processDescription` | `string` | See above |
| `processDepartment` | `string` | Optional, included in summary if present |

### L4 (Session)
No rawData support. Always queries DB.

---

## Implementation Phases

### Phase 0: Foundation Types + Langfuse Client
**No behavior change. Pure infrastructure.**

**Tests first:**

`src/__tests__/unit/ai/types.test.ts`:
- `aiAgentConfigSchema.parse(validConfig)` succeeds
- `aiAgentConfigSchema.parse(config missing slug)` throws ZodError
- `aiAgentConfigSchema.parse(config missing mode)` throws ZodError
- `aiAgentConfigSchema.parse(config with empty layers array)` succeeds (email-draft has no layers)
- `aiAgentConfigSchema.parse(config missing resilience)` throws ZodError
- `aiAgentConfigSchema.parse(config with mode='generateObject' and schemaSlug=null)` throws ZodError with message about schemaSlug
- `aiAgentConfigSchema.parse(config with mode='generateText' and schemaSlug=null)` succeeds
- `resilienceConfigSchema.parse({ layerTimeout: 0, ... })` throws (positive integer required)
- `resilienceConfigSchema.parse({ layerTimeout: -1, ... })` throws
- `layerSpecSchema.parse({ layer: 'l1-domain' })` succeeds
- `layerSpecSchema.parse({ layer: 'l1-domain', options: { mode: 'matched' } })` succeeds
- `layerSpecSchema.parse({ layer: 'invalid-layer' })` throws ZodError
- `toolSpecSchema.parse({ tool: 'web-search' })` succeeds
- `toolSpecSchema.parse({ tool: 'web-search', options: { maxSteps: 3 } })` succeeds
- `toolSpecSchema.parse({ tool: '' })` throws ZodError (empty string)
- `aiAgentConfigSchema.parse(config with tools: [{ tool: 'web-search' }])` succeeds
- `aiAgentConfigSchema.parse(config with tools: [])` succeeds (agents can have no tools)

`src/__tests__/unit/ai/observe.test.ts`:
- `getLangfuseClient()` returns a `Langfuse` instance when env vars are set
- `getLangfuseClient()` returns `null` when `LANGFUSE_SECRET_KEY` is missing
- `getLangfuseClient()` is a singleton (same instance on repeated calls)
- `getLangfuseClient()` never throws — errors are swallowed and null returned

**Files to create:**
- `src/lib/ai/types.ts` — all interfaces + Zod validation schemas (as documented above)
- `src/lib/ai/observe.ts` — singleton Langfuse client factory

**Commands:** `npm install langfuse`
**Env vars:** `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` (add to `.env.example`)

**Langfuse client implementation:**
```typescript
// src/lib/ai/observe.ts
import { Langfuse } from 'langfuse';

let instance: Langfuse | null | undefined; // undefined = not yet initialized

export function getLangfuseClient(): Langfuse | null {
  if (instance !== undefined) return instance;

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;

  if (!secretKey || !publicKey) {
    console.info('[AI] Langfuse not configured — observability disabled.');
    instance = null;
    return null;
  }

  try {
    instance = new Langfuse({
      secretKey,
      publicKey,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
    });
    return instance;
  } catch (err) {
    console.warn('[AI] Langfuse initialization failed:', err);
    instance = null;
    return null;
  }
}
```

---

### Phase 1: DB Schema + Queries + Seed Data
**Create the four new tables, query functions, and seed data.**

**Tests first:**

`src/__tests__/unit/db/schema-ai.test.ts`:
- `aiAgents` table is exported and has all required columns: `id`, `slug`, `label`, `description`, `mode`, `model`, `layers`, `langfusePromptName`, `schemaSlug`, `tools`, `maxOutputTokens`, `skills`, `resilience`, `enabled`, `version`, `createdAt`, `updatedAt`
- `skills` table is exported and has columns: `id`, `slug`, `label`, `description`, `type`, `content`, `enabled`, `createdAt`, `updatedAt`, `deletedAt`
- All three enums export correct values (`aiModeEnum`, `modelTierEnum`, `skillTypeEnum`)

`src/__tests__/unit/db/queries/ai-agents.test.ts`:
- `getAgentBySlug('capture-suggestions')` returns a valid config after seeding
- `getAgentBySlug('nonexistent')` returns `null`
- `getAgentBySlug` on disabled agent returns `null`
- `getAgentBySlug('company-research')` returns config with `tools: [{ tool: 'web-search', options: { maxSteps: 3 } }]`
- `listAgents()` returns all agents (enabled + disabled) for settings UI
- `upsertAgent(data)` with new slug creates a new row with version=1
- `upsertAgent(data)` with existing slug updates the row and increments version
- `upsertAgent(data)` with invalid mode throws Zod validation error
- `upsertAgent(data)` with mode='generateObject' and no schemaSlug throws validation error

`src/__tests__/unit/db/queries/skills.test.ts`:
- `createSkill({ slug, label, type, content })` inserts and returns skill with id
- `createSkill` with duplicate slug throws unique constraint error
- `listSkills()` returns all non-deleted skills ordered by label
- `listSkills()` excludes soft-deleted skills
- `getSkillsBySlugs(['slug-a', 'slug-b'])` returns matching enabled skills
- `getSkillsBySlugs([])` returns empty array without a DB call
- `getSkillsBySlugs(['disabled-skill'])` where skill exists but `enabled=false` returns empty array
- `updateSkill(id, { content: 'new' })` updates and returns skill
- `softDeleteSkill(id)` sets deletedAt, subsequent list excludes it

**Files to create:**
- Schema additions in `src/lib/db/schema.ts` (2 tables + 3 enums)
- `src/lib/db/queries/ai-agents.ts`
- `src/lib/db/queries/skills.ts`
- DB migration via `drizzle-kit generate` + apply
- `drizzle/seed/ai-agents.ts` — 9 initial agent configs (tools inline as JSONB)
- `drizzle/seed/skills.ts` — initial skills

**Query function implementation notes:**

`getAgentBySlug`:
```typescript
export async function getAgentBySlug(slug: string): Promise<AIAgentConfig | null> {
  const rows = await db
    .select()
    .from(aiAgents)
    .where(and(eq(aiAgents.slug, slug), eq(aiAgents.enabled, true)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    ...row,
    layers: z.array(layerSpecSchema).parse(row.layers),
    skills: z.array(z.string()).parse(row.skills),
    tools: z.array(toolSpecSchema).parse(row.tools),
    resilience: resilienceConfigSchema.parse(row.resilience),
  } as AIAgentConfig;
}
```

---

### Phase 2: Context Layers
**4 independent layers, each implementing `ContextLayer` interface.**

**Critical difference from v3:** `templateVars` values are ALL strings. Layers pre-render complex types.

**Tests first (one file per layer):**

`src/__tests__/unit/ai/layers/l1-domain.test.ts`:
- mode `'matched'` with known processType → `templateVars.domainKnowledge` contains formatted domain string (not raw object)
- mode `'matched'` with unknown processType → `templateVars.domainKnowledge` is empty string
- mode `'all'` → `templateVars.allDomains` contains pre-rendered string of all domains
- `data.domains` contains parsed domain objects (raw data for programmatic access)
- When `rawData.processType` provided, uses it directly (no DB call)
- When `processId` provided but no rawData.processType, resolves processType from DB

`src/__tests__/unit/ai/layers/l2-client.test.ts`:
- Loads client from DB when `clientId` provided
- Uses rawData when `rawData.clientName` AND `rawData.clientIndustry` present (skips DB)
- Resolves `clientId` from `processId` when only processId provided
- Resolves `clientId` from `sessionId` when only sessionId provided (double chain)
- fields `'summary'` → `templateVars` only has `clientName`, `clientIndustry`, `clientWebsite` (as strings)
- fields `'full'` (default) → `templateVars` has all client fields as strings, plus `clientSection` (pre-rendered full block)
- Returns empty `LayerResult` when no clientId/processId/sessionId AND no rawData (does not throw)

`src/__tests__/unit/ai/layers/l3-process.test.ts`:
- Loads process from DB when `processId` provided
- Uses rawData when `rawData.processName` present (skips DB)
- Resolves processId from sessionId when only sessionId provided
- `includeModel: true` → `templateVars.processModelSection` contains pre-rendered model string (with header)
- `includeModel: false` → `templateVars.processModelSection` is empty string
- fields `'summary'` → `templateVars` only has `processName`, `processDescription`, `processDepartment`
- fields `'full'` → all process fields as strings

`src/__tests__/unit/ai/layers/l4-session.test.ts`:
- Requires `sessionId` (returns empty LayerResult without it, logs warning)
- events `'all'` → `templateVars.sessionEventsSection` contains pre-rendered list of all events
- events `'last20'` → `templateVars.sessionEventsSection` contains pre-rendered list of last 20
- events `'none'` → `templateVars.sessionEventsSection` is empty string
- `contacts: true` → `templateVars.contactsSection` contains pre-rendered contacts list
- `contacts: false` → `templateVars.contactsSection` is empty string
- `priorSessions: true` → `templateVars.priorSessionsSection` contains pre-rendered prior sessions
- `debrief: true` → `templateVars.debriefSection` contains pre-rendered debrief data

`src/__tests__/unit/ai/layers/registry.test.ts`:
- `getLayer('l1-domain')` returns L1 layer instance
- `getLayer('nonexistent')` throws with descriptive error listing available layers

**Files to create:**
- `src/lib/ai/layers/types.ts`
- `src/lib/ai/layers/l1-domain.ts`
- `src/lib/ai/layers/l2-client.ts`
- `src/lib/ai/layers/l3-process.ts`
- `src/lib/ai/layers/l4-session.ts`
- `src/lib/ai/layers/registry.ts`

**Key design decisions:**
- Layers are stateless. `resolve()` receives everything it needs.
- Layers do NOT depend on each other's output. Each resolves its own chain.
- All layers run in `Promise.all` (enforced by the builder).
- `templateVars` values are always strings. Layers pre-render arrays into bullet lists, objects into formatted text, and conditional sections into complete blocks or empty strings.
- Layers never throw when data is missing — they return empty results and log warnings.

**Step 0 binding table (junior developer fills before writing code):**

| Binding Key | Grep Command | Resolved Value |
|-------------|-------------|----------------|
| `getL1` function | `grep -r "export.*getL1" src/lib/domain/` | |
| `getAllL1Domains` function | `grep -r "export.*getAllL1" src/lib/domain/` | |
| `getClientById` function | `grep -r "export.*getClientById" src/lib/db/` | |
| `getProcessWithModel` function | `grep -r "export.*getProcessWithModel\|getProcessById" src/lib/db/` | |
| `getSessionById` function | `grep -r "export.*getSessionById" src/lib/db/` | |
| `listSessionContacts` function | `grep -r "export.*listSessionContacts\|getSessionContacts" src/lib/db/` | |
| `getCompletedSessionsByProcess` function | `grep -r "export.*getCompletedSessions\|listSessionsByProcess" src/lib/db/` | |
| `getEventsBySessionId` function | `grep -r "export.*getEvents" src/lib/db/` | |
| Client table columns | `grep -A20 "export const clients" src/lib/db/schema.ts` | |
| Process table columns | `grep -A20 "export const processes" src/lib/db/schema.ts` | |
| Session table columns | `grep -A20 "export const sessions" src/lib/db/schema.ts` | |
| ProcessModel type | `grep -r "ProcessModel\|processModel" src/lib/db/schema.ts` | |
| L1 domain JSON structure | `find src/lib/domain -name "*.json" -o -name "*.ts" \| head -5` | |
| Session-to-process FK | `grep "processId" src/lib/db/schema.ts \| grep session` | |

**DO NOT PROCEED PAST PHASE 2 STEP 0 UNTIL THIS TABLE IS COMPLETE.**

---

### Phase 3: Skills Resolver + Skills CRUD UI + Schema Registry
**Skills as a first-class entity with full CRUD, plus the code-side schema map.**

This is where v4 diverges most from v3. Skills get their UI NOW, not in Phase 7. This is the extensibility mechanism Alberto needs from day one.

**Tests first:**

`src/__tests__/unit/ai/skills/resolver.test.ts`:
- `resolveSkills(['process-archaeology'])` where skill type is `system-prompt` → `systemPromptFragments` contains skill content
- `resolveSkills(['slug-a', 'slug-b'])` where slug-a is `system-prompt` and slug-b is `instruction` → correctly groups
- `resolveSkills([])` → returns `EMPTY_SKILLS` constant (no DB call)
- `resolveSkills(['disabled-skill'])` → skips disabled skills, returns empty resolved
- `resolveSkills(['nonexistent'])` → logs warning, returns empty (does not throw)
- Skill of type `context-enrichment` with content `"key1=value1\nkey2=value2"` → `contextEnrichments` has `{ key1: 'value1', key2: 'value2' }`
- Skill of type `context-enrichment` with malformed content (no `=`) → logs warning, skips that line

`src/__tests__/unit/ai/schemas/registry.test.ts`:
- `getSchema('capture-suggestions')` returns a Zod schema
- `getSchema('process-hypothesis')` returns a Zod schema
- `getSchema('nonexistent')` throws with descriptive error listing available schemas
- `listAvailableSchemas()` returns array with slug, label, description for each entry
- Every entry in `listAvailableSchemas()` has a non-empty description

`src/__tests__/unit/ai/tools/registry.test.ts`:
- `getTool('web-search')` returns entry with factory function
- `getTool('nonexistent')` throws with descriptive error listing available tools
- `listAvailableTools()` returns array with slug, label, description for each entry
- `getTool('web-search').factory(mockAnthropic)` returns a tool object
- `getTool('web-search').factory(null)` handles missing anthropic provider gracefully

**API route tests:**

`src/__tests__/unit/api/skills.test.ts`:
- `POST /api/settings/skills` with valid data creates skill, returns 201
- `POST /api/settings/skills` without auth returns 401
- `POST /api/settings/skills` with duplicate slug returns 409
- `POST /api/settings/skills` with missing required fields returns 400 with Zod errors
- `GET /api/settings/skills` returns all non-deleted skills
- `PATCH /api/settings/skills/[id]` updates skill content
- `PATCH /api/settings/skills/[id]` with nonexistent id returns 404
- `DELETE /api/settings/skills/[id]` soft-deletes (sets deletedAt)
- `DELETE /api/settings/skills/[id]` on already-deleted skill returns 404

**Files to create:**
- `src/lib/ai/skills/resolver.ts` — `resolveSkills(slugs: string[]) → ResolvedSkills`
- `src/lib/ai/schemas/registry.ts` — code-side Zod schema map with metadata
- `src/lib/ai/tools/registry.ts` — code-side tool factory map with metadata
- `app/api/settings/skills/route.ts` — GET (list), POST (create)
- `app/api/settings/skills/[id]/route.ts` — GET, PATCH, DELETE
- `app/api/settings/registries/route.ts` — GET (returns available tools + schemas for UI)
- `app/(dashboard)/settings/skills/page.tsx` — Skills management UI

**Skills UI specification:**

The Skills page has:
- A table showing: slug, label, type (badge: violet=system-prompt, teal=context-enrichment, blue=instruction), enabled toggle, actions
- "Create Skill" button → dialog with:
  - Label (text input)
  - Slug (auto-generated from label, editable)
  - Type (select: System Prompt, Context Enrichment, Instruction)
  - Description (text input, optional)
  - Content (textarea, monospace font, large — at least 10 rows)
  - For `context-enrichment` type: show helper text "Enter key=value pairs, one per line"
- Click row → edit dialog with same fields + created/updated timestamps
- Enabled/disabled toggle in table (inline, no dialog)
- Delete button with confirmation dialog ("This will soft-delete the skill. It will no longer be available to AI agents.")

**Why skills UI is Phase 3, not Phase 7:**
- Alberto can start creating freight forwarding, procurement, and rebate processing domain knowledge immediately
- Skills are referenced by slug in agent configs — the agent seed data references `process-archaeology`, which must exist
- The skills CRUD is simple (standard table + form) and doesn't depend on the builder being complete

---

### Phase 4: Langfuse Prompt Migration + Behavioral Tests
**Upload all 9 prompts to Langfuse. Validate with behavioral tests.**

**Prerequisites:** Langfuse account created, API keys in `.env`.

**Prompt migration approach per template (repeat for all 9):**

1. Read current prompt builder function (e.g., `src/lib/ai/prompts/capture-suggestions.ts`)
2. Extract the full prompt text
3. Identify conditional sections and array rendering — move this logic into the corresponding layer's `resolve()` function (Phase 2 layers produce pre-rendered strings)
4. Replace JS string interpolation (`${variable}`) with Langfuse `{{variableName}}`
5. Create the prompt in Langfuse as a `chat` type with `system` and `user` messages
6. Label the version as `production`
7. Record which `templateVars` keys each prompt expects (document in seed script)
8. Write behavioral test
9. Run the behavioral test → confirm GREEN

**Tests first:**

`src/__tests__/unit/ai/prompts/behavioral.test.ts`:

For each of the 9 prompts, test that when the layer-produced template vars are compiled:
- The output contains expected key phrases
- The output contains interpolated values
- Pre-rendered conditional sections appear when present and are absent when empty
- No `{{` or `}}` markers remain in the output (all variables resolved)
- The output length is within reasonable bounds

```typescript
describe('capture-suggestions prompt (Langfuse)', () => {
  it('includes domain knowledge when provided', () => {
    // Simulate what L1 layer would produce
    const vars = {
      domainKnowledge: '## Domain Knowledge\nProcurement domain: RFQ, PO, invoice matching...',
      processModelSection: '## Current Process Model\n{"steps": []}',
      sessionEventsSection: '- Step: Open ERP\n- Step: Check PO status',
    };
    // Use Langfuse SDK compile (or mock it for unit tests)
    const result = compileTestPrompt('capture-suggestions', vars);
    expect(result.systemPrompt).toContain('Domain Knowledge');
    expect(result.systemPrompt).toContain('Procurement domain');
  });

  it('excludes domain section when domainKnowledge is empty', () => {
    const vars = {
      domainKnowledge: '',
      processModelSection: '## Current Process Model\n{"steps": []}',
      sessionEventsSection: '- Step: Open ERP',
    };
    const result = compileTestPrompt('capture-suggestions', vars);
    expect(result.systemPrompt).not.toContain('Domain Knowledge');
  });

  it('renders events list in user prompt', () => {
    const vars = {
      domainKnowledge: '',
      processModelSection: '',
      sessionEventsSection: '- Step: Open ERP\n- Step: Check PO status\n- Edge: If PO approved',
    };
    const result = compileTestPrompt('capture-suggestions', vars);
    expect(result.userPrompt).toContain('Open ERP');
    expect(result.userPrompt).toContain('Check PO status');
  });

  it('leaves no unresolved template markers', () => {
    const vars = {
      domainKnowledge: 'test',
      processModelSection: '{}',
      sessionEventsSection: 'test events',
    };
    const result = compileTestPrompt('capture-suggestions', vars);
    expect(result.systemPrompt).not.toMatch(/\{\{[^}]+\}\}/);
    expect(result.userPrompt).not.toMatch(/\{\{[^}]+\}\}/);
  });
});
```

**Test helper:**
```typescript
// For unit tests, we don't hit Langfuse. We replicate the prompt text from the seed script
// and compile it locally using string replacement (same as Langfuse SDK does internally).
function compileTestPrompt(name: string, vars: Record<string, string>): CompiledPrompt {
  const prompt = PROMPTS.find(p => p.name === name);
  if (!prompt) throw new Error(`No test prompt fixture: ${name}`);

  const compile = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');

  const systemMsg = prompt.prompt.find((m: any) => m.role === 'system');
  const userMsg = prompt.prompt.find((m: any) => m.role === 'user');

  return {
    systemPrompt: systemMsg ? compile(systemMsg.content) : '',
    userPrompt: userMsg ? compile(userMsg.content) : null,
  };
}
```

**Files to create:**
- `scripts/seed-langfuse-prompts.ts` — complete with all 9 prompts
- `src/__tests__/unit/ai/prompts/behavioral.test.ts` — behavioral tests

---

### Phase 5: Builder (executeAI)
**Wire everything together.**

**Tests first:**

`src/__tests__/unit/ai/builder.test.ts`:

- **Config resolution:** `executeAI({ agentSlug: 'capture-suggestions', ... })` loads config from DB (mock `getAgentBySlug`)
- **Disabled agent:** Mock config with `enabled: false`; verify throws "disabled" error
- **Config validation:** Mock DB returning invalid config; verify Zod throws
- **Layer execution:** Mock layers; verify only configured layers are called
- **Layer parallelism:** Mock layers with delays; verify total time ≈ max(delays), not sum
- **Layer error isolation (fallback=true):** Mock L1 to throw; verify L3+L4 still resolve and `meta.layerErrors` contains L1 error
- **Layer error isolation (fallback=false):** Mock L1 to throw with `fallbackOnLayerError: false`; verify executeAI throws
- **Layer timeout:** Mock L4 to take 5s with timeout=3s; verify timeout error in `meta.layerErrors`
- **Langfuse prompt fetch:** Mock `fetchLangfusePrompt`; verify called with config's `langfusePromptName`
- **Prompt compilation:** Mock Langfuse prompt with variables; verify compiled values in system prompt
- **Skill injection:** Mock resolveSkills; verify system-prompt fragments prepended, instructions appended
- **System prompt order:** Verify: skills fragments → compiled Langfuse prompt → skill instructions → override append
- **Tool resolution:** Config has `tools: [{ tool: 'web-search', options: { maxSteps: 3 } }]`; verify `getTool('web-search')` called and tool passed to AI SDK
- **Tool maxSteps:** Options has `maxSteps: 3`; verify maxSteps=3 passed to AI SDK
- **Unknown tool in config:** Config references `tools: [{ tool: 'nonexistent' }]`; verify warning logged, tool skipped, AI call continues
- **No tools:** Config has `tools: []`; verify no tools passed to AI SDK
- **generateObject mode:** Mock AI SDK; verify called with correct schema, system prompt, user prompt
- **generateText mode:** Verify called without schema
- **streamText mode:** Verify messages passed through
- **Pre-resolved model:** Pass `model` in input; verify `getAIConfig` NOT called
- **Model tier resolution:** Config says `'fast'`; verify Haiku model resolved
- **Overrides templateVars:** Verify they appear in compiled prompt, overriding layer values
- **Overrides systemPromptAppend:** Verify appended after skill instructions
- **Version tracking:** Verify `meta.configVersion` and `meta.promptVersion` match mocked DB/Langfuse
- **Langfuse trace:** Verify trace started with slug, generation recorded with versions and prompt link
- **Langfuse unconfigured:** AI call still completes when `getLangfuseClient()` returns null
- **Unknown agent slug:** Throws descriptive error

**Files to create:**
- `src/lib/ai/builder.ts` — `executeAI()` function + all internal helpers

---

### Phase 6: Route Migrations (one at a time)

Same migration order as v3 (lowest risk first). Each route replaces its AI call with `executeAI()`.

| # | Agent | Route | Risk | Notes |
|---|-------|-------|------|-------|
| 1 | email-draft | `api/ai/email-draft/route.ts` | Low | No layers, all data via overrides |
| 2 | capture-suggestions | `api/ai/suggestions/route.ts` | Low | Returns `[]` on error |
| 3 | prep-brief | `api/sessions/[id]/prep-brief/route.ts` | Low | Clean generateObject |
| 4 | process-hypothesis | `api/clients/[id]/processes/*/hypothesis/route.ts` | Medium | Fire-and-forget + rawData |
| 5 | company-research | prompt builder called from route | Medium | Fire-and-forget + web_search |
| 6 | session-interview | `api/sessions/interview/route.ts` | Medium | Overrides for contacts + questionIndex |
| 7 | session-synthesis | `api/sessions/[id]/synthesize/route.ts` | High | Complex, branching logic |
| 8 | shadowing-synthesis | Same route as #7 | High | Second branch of synthesize route |
| 9 | research-chat | `api/ai/research/route.ts` | High | streamText + tools + onFinish |

**Per-migration test strategy and migration templates remain the same as v3.** The key difference is that `onFinish` for research-chat stays in the route handler:

```typescript
// research-chat route — onFinish stays here, NOT in a hook registry
const result = await executeAI({
  agentSlug: 'research-chat',
  params: { clientId: body.clientId, processId: body.processId },
  userId,
  messages: body.messages,
});

// The route handles saving, not the builder
// This is done via the stream's onFinish callback on the AI SDK side
return result.stream;
```

**After ALL 9 migrations are complete:** Delete old files (same list as v3).

---

### Phase 7: Settings UI for Agents
**Management layer for agent configs. Skills UI already done in Phase 3.**

**7a — AI Agents API routes + UI:**
- `GET /api/settings/ai-agents` — list all agents (enabled + disabled)
- `PATCH /api/settings/ai-agents/[slug]` — update agent config fields (validates with Zod, increments version)
- No POST/DELETE for now (new agents created via seed or direct DB insert)

UI: Table with slug, label, mode, model, enabled toggle. Click row → edit dialog with:
- Label, description (text inputs)
- Mode (select), Model (select)
- Langfuse Prompt Name (text input) + "Edit in Langfuse ↗" link that opens the Langfuse prompt editor
- Schema (dropdown populated from `GET /api/settings/registries` → `schemas[]`). Shown only when mode is `generateObject`. Displays slug + description.
- Tools (multi-select populated from `GET /api/settings/registries` → `tools[]`). Each selected tool shows an options editor (e.g., maxSteps number input for web-search). Displays slug + description.
- Layers (JSON editor)
- Skills (multi-select from available skills, loaded from `GET /api/settings/skills`)
- Resilience (JSON editor)
- maxOutputTokens (number input)

**7b — Registries API:**
- `GET /api/settings/registries` — returns `{ tools: listAvailableTools(), schemas: listAvailableSchemas() }`
- This endpoint powers the dropdowns in the agent edit dialog
- No write operations — registries are code-side, read-only at runtime

**Key UX principle:** The settings UI is the central hub. Agent config lives in the DB. Prompts live in Langfuse (linked from the UI). Tools and schemas live in code (surfaced as read-only options). Skills live in the DB with full CRUD. Everything is accessible from one screen.

---

## Parallelism Map

```
Phase 0 (Types + Langfuse Client)
    │
    Phase 1 (DB Schema + Queries + Seed)  ← immediately after Phase 0
        │
        ├── Phase 2 (Context Layers)      ← after Phase 0 types + Phase 1 schema
        ├── Phase 3 (Skills CRUD + UI)    ← after Phase 0 types + Phase 1 schema
        └── Phase 4 (Langfuse Prompts)    ← after Phase 0 observe + Langfuse account setup
                │
Phase 5 (Builder)  ← Phase 0 + 1 + 2 + 3 + 4 (all must complete)
Phase 6 (Route Migrations)  ← Phase 5
Phase 7 (Agent Settings UI)  ← Phase 6
```

Phases 2, 3, 4 can run in parallel after Phases 0 and 1 complete.

---

## How to Add a New AI Agent (the payoff)

After this refactor, adding a new AI agent requires:

1. **Define the Zod schema** (if `generateObject`) and register it in `schemas/registry.ts`:
   ```typescript
   // Add entry to schemaRegistry
   'new-agent': {
     slug: 'new-agent',
     label: 'New Agent Output',
     description: 'Produces X with fields Y and Z.',
     schema: newAgentSchema,  // your Zod schema
   },
   ```
   This automatically appears in the schema dropdown in the settings UI on next deploy.

2. **Create the prompt in Langfuse** (via Langfuse UI):
   - Name: `new-agent`
   - Type: chat
   - System message with `{{variable}}` placeholders
   - User message with `{{variable}}` placeholders
   - Label as `production`

3. **Insert the agent config** (via settings UI or seed script):
   ```sql
   INSERT INTO ai_agents (slug, label, mode, model, layers, langfuse_prompt_name, 
     schema_slug, tools, skills, resilience)
   VALUES ('new-agent', 'New Agent', 'generateObject', 'standard',
     '[{"layer": "l2-client", "options": {"fields": "full"}}]',
     'new-agent', 'new-agent',
     '[{"tool": "web-search", "options": {"maxSteps": 3}}]',
     '["process-archaeology"]',
     '{"layerTimeout": 5000, "totalTimeout": 15000, "fallbackOnLayerError": false}');
   ```

4. **Call it from the route**:
   ```typescript
   const result = await executeAI({ agentSlug: 'new-agent', params: { processId }, userId });
   ```

**What requires a deploy vs what doesn't:**

| Change | Deploy needed? | Where |
|--------|---------------|-------|
| Edit prompt text | No | Langfuse UI → promote to production |
| Change model tier, layers, resilience | No | Settings UI → edit agent config (DB) |
| Add/remove skills from agent | No | Settings UI → edit agent's skills array (DB) |
| Add/remove tools from agent | No | Settings UI → edit agent's tools array (DB) |
| Create a new skill | No | Settings UI → Skills CRUD (DB) |
| Toggle agent on/off | No | Settings UI → enabled toggle (DB) |
| Add a new Zod schema | Yes | Code: `schemas/registry.ts` |
| Add a new tool type | Yes | Code: `tools/registry.ts` |
| Add a new context layer | Yes | Code: `layers/*.ts` + `layers/registry.ts` |
| Create a new agent | No* | Settings UI or seed script (DB + Langfuse) |

*Unless the new agent needs a new schema, tool, or layer that doesn't exist yet.

---

## Verification Plan

1. **Unit tests** per module — written BEFORE implementation (red → green → refactor)
2. **Behavioral tests** for prompts — verify key phrases and variable interpolation using test fixtures that mirror Langfuse prompt structure
3. **Integration tests** per route migration — verify contract (auth, input shape, output shape, error codes)
4. **Manual smoke test** after all migrations:
   - Full flow: create client → research → process → hypothesis → session → interview → prep brief → shadowing → debrief → synthesis
   - Langfuse dashboard: verify traces appear with correct agent slugs, config versions, prompt versions, layer timings
   - Langfuse dashboard: verify prompt versions are linked to traces (click trace → see which prompt version was used)
   - Settings UI: create a new skill → add it to an agent config → verify next AI call includes the skill content
   - Langfuse UI: edit a prompt → promote to production → verify next AI call uses new prompt without deploy
   - Settings UI: toggle agent enabled/disabled → verify behavior changes immediately
   - Settings UI: change agent model tier from standard to fast → verify next call uses Haiku

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Langfuse is a new dependency | Langfuse client is cached (no latency after first call). If Langfuse is down, `getLangfuseClient()` returns null and the builder throws a clear error. Can add DB fallback later if needed. |
| DB query on every AI call adds latency | Agent config rows are small (<2KB). Single-row lookup by unique index is sub-1ms. |
| Bad data in DB breaks AI calls | Zod validation at read time. Invalid config = clear error, not silent corruption. |
| Prompt output differs from current prompts | Behavioral tests check key phrases and variable presence. Manual review during Phase 4. |
| Layer error kills real-time feature | `resilience.fallbackOnLayerError: true` for capture-suggestions and email-draft. |
| Breaking fire-and-forget pattern | Routes still handle `void executeAI(...)` and `.then()` chains. |
| Breaking streaming (research-chat) | Last migration. `onFinish` stays in route handler. |
| Layer latency | All layers run in parallel. Per-layer timeout. Timings in Langfuse traces. |
| Junior developer blocked | Step 0 binding table in Phase 2. Seed scripts are authoritative reference. |
| Skills UI delays other work | Skills CRUD is standard table+form. Can be done by a second developer in parallel. |
| Langfuse prompt variables don't support conditionals | Layers pre-render conditional blocks as strings. The prompt only needs `{{variable}}` substitution. |
| Agent config references nonexistent tool/schema slug | Builder calls `getTool()`/`getSchema()` which throw descriptive errors listing available options. Zod validation on the `tools` array catches malformed specs at DB read time. |
| Adding a new tool/schema requires a deploy | By design. Tools and schemas are code (SDK objects, TypeScript types). The deploy-vs-no-deploy table in "How to Add" makes this explicit. Config changes (which tools/schemas an agent uses) don't require deploys. |
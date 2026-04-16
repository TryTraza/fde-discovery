# Plan: Rediseño de datos → Aislamiento AI → (futuro) Migración a Traza

## Context

Este repo (`discovery_tool`) concentra hoy toda la lógica de IA y, además, es dueño de tablas de configuración (`aiAgents`, `skills`) que a medio plazo serán responsabilidad de **Traza**. A corto plazo Traza hospedará los workers; este repo se quedará con datos de dominio, construcción de input y una fachada (`AIGateway`) que sustituya la ejecución local por llamadas HTTP cuando cada worker esté listo.

Decisión de orden (actualizada): **primero arreglamos el modelo de datos**, ajustando las features de IA existentes para que produzcan/consuman ya las estructuras nuevas. Con el modelo sano, aislar detrás de un gateway tiene sentido (si no, encapsulamos basura). Con el gateway en su sitio, la migración a Traza es drop-in feature a feature.

Principios transversales:

- **Incrementalidad absoluta**: en cada commit el sistema compila y corre. Drops de schema sólo cuando nada lee de la columna vieja.
- **Traza será dueño** de workers, skills, tools, modelos y runs. No duplicamos telemetría local.
- **Gestión de IA desde UI desaparece** (skills, agentes, modelos). La selección de modelo es decisión del worker; las skills se versionan con código hasta que Traza ofrezca vista/edición propia.
- **Clerk**: `anthropicApiKey` se queda mientras ejecutemos local; `aiModels` se elimina.
- **Research chat (SSE)** entra al `AIGateway` desde el principio — mismo contrato conceptual que los demás, sólo cambia el tipo de retorno (`AsyncIterable`).

---

# Bloque 1 — Rediseño del modelo de datos (+ ajuste de features IA)

Objetivo: que los datos que persistimos aporten valor real (no texto libre), y que las features IA actuales ya produzcan y consuman el nuevo shape. Durante este bloque la arquitectura de ejecución IA no cambia (sigue siendo `executeAI()` + `builder.ts`): sólo cambian tipos, schemas Zod, prompts y UI.

## 1.1 Tipos y contratos (paso preparatorio, sin DB)

Primer paso: definir en `src/lib/db/types.ts` las nuevas formas. Cero cambios de DB todavía. Desbloquea los prompts y la UI.

- `ProcessGraph` — grafo de proceso (nodes + edges + edgeCases).
- `ProcessHypothesis` — hipótesis estructurada.
- `CompanyProfile` — perfil canónico de cliente.
- `ResearchNoteResult` — output estructurado de consulta de research.
- `SynthesisOutput` — tipar lo que hoy es JSONB sin tipo.

### ProcessGraph (reemplaza `processModels.steps` + `edgeCases`)

```ts
type NodeConfidence = 'confirmed' | 'inferred' | 'assumed' | 'open_question'
type NodeType = 'start' | 'end' | 'step' | 'decision' | 'system' | 'actor' | 'artifact'
type EdgeType = 'sequence' | 'conditional' | 'data_flow' | 'escalation' | 'parallel'

type GraphNode = {
  id: string
  type: NodeType
  label: string
  description?: string
  confidence: NodeConfidence
  metadata: {
    actor?: string
    systems?: string[]
    duration?: string
    systemRole?: string
    artifactType?: string
    [k: string]: unknown
  }
  position?: { x: number; y: number }
  sourceSessionIds?: string[]
}

type GraphEdge = {
  id: string
  from: string
  to: string
  type: EdgeType
  label?: string
  condition?: string
  sourceSessionIds?: string[]
}

type ProcessGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  edgeCases: Array<{
    id: string
    description: string
    affectedNodeIds: string[]
    affectedEdgeIds?: string[]
    frequency: 'rare' | 'occasional' | 'frequent' | 'unknown'
    suggestedHandling?: string
    status: 'open' | 'addressed'
    sourceSessionId?: string
  }>
}
```

Decisión: los **sistemas** empiezan como `node.metadata.systems[]`. Se promocionan a nodos `system` on-demand cuando haya data_flows interesantes (iterativo).

### ProcessHypothesis (reemplaza `processes.hypothesisText`)

```ts
type ProcessHypothesis = {
  summary: string
  triggers: Array<{
    description: string
    frequency?: 'daily' | 'weekly' | 'monthly' | 'on_demand' | 'other'
  }>
  stakeholders: Array<{ role: string; responsibility: string }>
  inputs: Array<{ name: string; source?: string; format?: string }>
  outputs: Array<{ name: string; consumer?: string; format?: string }>
  expectedSystems: Array<{
    name: string
    purpose: string
    confidence: 'high' | 'medium' | 'low'
  }>
  assumptions: Array<{
    text: string
    confidence: 'high' | 'medium' | 'low'
    validationQuestion?: string
  }>
  openQuestions: string[]
  generatedAt: string
}
```

### CompanyProfile (nueva columna `clients.profile`)

```ts
type CompanyProfile = {
  description: string                          // 1-2 párrafos
  industry: string
  size?: {
    employees?: number
    revenueRange?: string
    stage?: 'startup' | 'growth' | 'enterprise'
  }
  areasOfExpertise: string[]
  productsAndServices: Array<{ name: string; description: string }>
  keyStakeholders?: Array<{ name: string; role: string; linkedinUrl?: string }>
  techStack?: string[]
  recentNews?: Array<{ title: string; url: string; date?: string; summary: string }>
  sources: ResearchSource[]
  lastRefreshedAt: string
}
```

### ResearchNoteResult (nueva columna `researchNotes.responseStructured`)

```ts
type ResearchNoteResult = {
  summary: string
  findings: Array<{
    category: 'company' | 'market' | 'competitor' | 'technical' | 'people' | 'other'
    text: string
    confidence: 'high' | 'medium' | 'low'
  }>
  entitiesIdentified?: Array<{ name: string; type: string }>
  followUpQuestions?: string[]
}
```

### SynthesisOutput (tipar lo que hoy es JSONB sin tipo)

```ts
type SynthesisOutput = {
  graphPatch: ProcessGraphDiff                 // propuesta de modificación del grafo
  openQuestions: Array<{
    text: string
    priority: 'critical' | 'important' | 'nice_to_have'
  }>
  confidenceAssessment: {
    overall: 'high' | 'medium' | 'low'
    notes?: string
  }
  newSystems: SystemEntry[]
  newEdgeCases: EdgeCase[]
}
```

`ProcessGraphDiff` se define ligero al principio (lista de nodes/edges a añadir/editar/borrar, resueltos por id). Detalle se afina al reescribir el prompt de synthesis.

## 1.2 Migraciones y backfill (orden)

Cada paso: migración Drizzle → backfill → actualizar prompts/schemas Zod → actualizar UI que lee → validar paridad → drop columna vieja.

1. **Tipar `synthesisOutput`** — sólo types + Zod schema. Cero DB. Puede requerir pequeño refactor del prompt para que ya devuelva la shape tipada. Los sintetizadores existentes pasan a escribir la estructura documentada.
2. **`clients.profile`** — añadir columna jsonb. Feature existente de "company-research" se duplica/reemplaza por un `refresh-profile` con `generateObject(CompanyProfileSchema)`. `aiSummary` coexiste temporalmente. UI de cliente añade sección de perfil.
3. **`processes.hypothesis`** + `hypothesisLegacyText` — añadir columna. Prompt `process-hypothesis` actualizado a `generateObject(ProcessHypothesisSchema)`. El contenido de `hypothesisText` se copia a `hypothesisLegacyText` como referencia. UI muestra cards estructuradas; el texto legacy aparece como "hipótesis anterior" mientras existe.
4. **`processModels.graph`** (big-bang de grafo) — añadir columna. Backfill: cada `step` se convierte en node tipo `step`, cada `nextSteps[]` en edge `sequence`. `edgeCases` se copian. Prompt de `session-synthesis` y `shadowing-synthesis` actualizados para emitir `SynthesisOutput.graphPatch`. UI `process-flow.tsx` reescrita para leer `graph.nodes`/`graph.edges` directamente (ReactFlow ya está). Drop `steps`, `edgeCases`, `systems` del schema.
5. **`researchNotes.responseStructured`** — añadir columna. Los nuevos prompts de research ad-hoc escriben aquí. Backfill: intentar parsear `response` legacy a estructura mínima (`summary: response, findings: []`) o marcarlo como legacy. Drop `response` al final.
6. **Limpieza** — drop `aiSummary`, `hypothesisLegacyText`.

Durante cada paso, un **feature flag de lectura** (`USE_NEW_HYPOTHESIS`, `USE_NEW_GRAPH`) permite a la UI alternar entre leer viejo y nuevo mientras se valida. Se elimina el flag cuando el paso termina.

## 1.3 Ajuste de features IA (sin aislarlas aún)

En este bloque los cambios de IA son **in situ** — cambian prompts y schemas Zod dentro de `src/lib/ai/prompts/*` y `src/lib/ai/schemas/*`. La arquitectura de ejecución (`executeAI`, `builder.ts`, layers, skills resolver) no cambia.

- `process-hypothesis` → genera `ProcessHypothesis`.
- `session-synthesis` y `shadowing-synthesis` → generan `SynthesisOutput` con `graphPatch`.
- `company-research` (chat SSE) → sin cambios de shape (sigue streameando texto para la UX de chat). Se añade una feature nueva `refresh-company-profile` (generateObject) con `CompanyProfile`. Dos acciones distintas en UI: "chatear" vs "refrescar perfil".
- `prep-brief`, `capture-suggestions`, `session-interview`, `email-draft` → sin cambios de shape.
- Queries de DB que hoy leen `processModels.steps`/`edgeCases` → cambian a leer `graph`. Queries que hoy leen `processes.hypothesisText` → cambian a `processes.hypothesis`. Capas L2/L3 actualizadas para inyectar la nueva estructura en el input AI.

## 1.4 UI del bloque 1

- `src/modules/clients/components/company-profile-*.tsx` — nueva sección en página de cliente, cards por bloque del perfil, botón "Refresh profile".
- `src/modules/processes/components/hypothesis-*.tsx` — render estructurado de hipótesis, con edición manual por bloque.
- `src/modules/processes/components/process-flow.tsx` — pasa de steps[] a `graph`. Soporta nodos heterogéneos (decision, actor, artifact) y edges con condición.
- Vistas de research: acción `Refresh profile` separada del chat ad-hoc.

## 1.5 Verificación del bloque 1

- Tests unitarios de los schemas Zod (generación de fixtures válidos/invalidos).
- Scripts `scripts/backfill-*.ts` con `--dry-run` y conteo de filas transformadas/saltadas.
- `scripts/verify-data-integrity.ts` (nuevo): cada `processModel` con `graph` bien formado, cada `process` con `hypothesis` o marca legacy, cada `client` con `profile` o "nunca generado".
- E2E Playwright: los flujos existentes (crear sesión → prep-brief → synthesize, editar proceso, ver cliente) siguen pasando, ahora leyendo datos estructurados.

---

# Bloque 2 — Aislamiento tras `AIGateway`

Con el modelo de datos en su sitio, encapsulamos la ejecución IA detrás de una fachada que el resto del código consume. El objetivo es que, en Bloque 3, migrar un feature a Traza sea cambiar una implementación.

## 2.1 Forma del `AIGateway`

Una única interface. El **tipo de retorno comunica el modo de invocación**:

```ts
interface AIGateway {
  // Request-response (sync o async+polling, transparente)
  draftEmail(input: EmailInput): Promise<string>
  generateInterviewQuestion(input: InterviewInput): Promise<Question>
  generateHypothesis(input: HypothesisInput): Promise<ProcessHypothesis>
  generateSuggestions(input: SuggestionsInput): Promise<Suggestion[]>
  generatePrepBrief(input: PrepBriefInput): Promise<PrepBrief>
  synthesizeSession(input: SynthesisInput): Promise<SynthesisOutput>
  synthesizeShadowing(input: ShadowingInput): Promise<SynthesisOutput>
  refreshCompanyProfile(input: ProfileInput): Promise<CompanyProfile>

  // Fire-and-forget: el worker escribe en DB, el caller recibe handle
  recalcProcessGraph(input: GraphRecalcInput): Promise<RunHandle>

  // Stream (SSE)
  streamResearchChat(input: ResearchChatInput): AsyncIterable<ResearchEvent>
}
```

Recomendación para la API que expondrá Traza (a tu lado):
- `POST /workers/:slug` — respuesta sync si completa <N seg, si no `202 {runId}` + `GET /runs/:runId` para poll. El caller no distingue.
- `POST /workers/:slug/dispatch` — siempre async, devuelve `{runId}`.
- `POST /workers/:slug/stream` — SSE.
- Opcional: webhook de completion configurable por worker.

## 2.2 Config de features: de DB a código + salida de Langfuse

Pregunta resuelta: **¿cómo funcionan las features IA cuando eliminemos `aiAgents` y `skills`?**

- Cada método del `LocalAIGateway` tiene hardcoded su config: modelo por defecto, schema Zod, lista de skills a incluir, presupuesto de tool calls. Vive en un archivo por feature bajo `src/lib/ai/features/<slug>.ts`.
- El contenido de las skills pasa a `src/lib/ai/skills/*.md`. `skills-resolver` se reescribe para leer del filesystem.
- **Langfuse desaparece** a la vez que la DB de config. Los prompts (system + template de input) viven en el repo como ficheros. Traza será dueño del system prompt de cada worker cuando migre; mientras tanto, el repo lo hospeda.
- La UI de gestión desaparece. Cambios a prompts o skills son cambios de código, vía PR.

## 2.3 Templating estandarizado del input al worker

La división caller/worker que nos llevamos a Traza es:

- **Caller (este repo)**: construye el **input del usuario** — un string compuesto por secciones según qué capas estén disponibles. Layout estandarizado entre features.
- **Worker (Traza)**: dueño del **system prompt**, las tools, las skills que aplica, y la lógica de ejecución.

Para que el input sea estándar y portable, introducimos una capa de **templates tipo Jinja** (librería: `nunjucks` o equivalente — cercano a Jinja, con bloques condicionales). Un template por feature en `src/lib/ai/templates/<slug>.njk`.

Forma general de un template:

```jinja
{% if l1 %}
## Domain pattern
{{ l1.typicalSteps }}
{% endif %}

{% if l2 %}
## Client context
Name: {{ l2.client.name }}
Industry: {{ l2.client.industry }}
{% if l2.client.profile %}
Description: {{ l2.client.profile.description }}
Products: {{ l2.client.profile.productsAndServices | join(', ') }}
{% endif %}
{% endif %}

{% if l3 %}
## Process
{{ l3.process.name }} — {{ l3.process.description }}
{% if l3.process.hypothesis %}
Hypothesis summary: {{ l3.process.hypothesis.summary }}
{% endif %}
{% endif %}

{% if l4 %}
## Session
Transcript: {{ l4.session.transcriptText or 'No transcript' }}
FDE notes: {{ l4.session.notes or 'No notes' }}
{% endif %}

{% if params.previousAnswers %}
## Previous answers
{% for a in params.previousAnswers %}
- Q: {{ a.question }}
  A: {{ a.answer }}
{% endfor %}
{% endif %}
```

El **input builder** hace tres pasos explícitos:

1. Resuelve las capas necesarias desde DB (como hoy).
2. Renderiza el template del feature con esas capas + `params`.
3. Devuelve `{ renderedInput: string, context: {...}, params: {...} }`.

El `LocalAIGateway` toma `renderedInput` y lo pasa directamente como `prompt` a `generateObject`/`generateText`/`streamText`. El `system` lo aporta el feature file local (ver 2.2).

Cuando una feature migre a Traza en Bloque 3, el `TrazaAIGateway.<feature>` envía exactamente el mismo `renderedInput` al endpoint del worker. El worker en Traza tiene su propio system prompt; el input viene del template local. **Portable sin cambios**.

Beneficios:
- Mismo contrato de input entre local y Traza — drop-in al migrar.
- Prompts dejan de vivir en Langfuse; se versionan con el código.
- Bloques condicionales por capa dejan claro qué contexto necesita cada feature.
- Más fácil testear (fixture de DB → template render → string determinista).

Cuando cada feature migre a Traza en Bloque 3, su feature file y su template siguen siendo útiles (generan el input que Traza consume). Lo que se borra del código es el system prompt local y el schema Zod de validación (si Traza ya garantiza el shape).

## 2.4 Arquitectura

```
 UI (src/app + src/modules)
   - Dominio; Settings (API key); nada de gestión IA
            │
 API routes (src/app/api)
   1. authz
   2. const input = await buildInput(...)       // renderedInput + context
   3. const out   = await aiGateway.<feature>(input)
   4. persist
            │
 src/lib/ai/            ── frontera con Traza ──
   contracts.ts          (WorkerInput por feature + tipos retorno)
   input-builder.ts      (layers DB → render template → WorkerInput)
   templates/<slug>.njk  (un template Jinja por feature)
   gateway.ts            (interface AIGateway)
   gateway-local.ts      (impl actual — usa renderedInput como prompt)
   gateway-traza.ts      (impl futura — envía renderedInput al endpoint)
   gateway-factory.ts    (híbrido por feature flag AI_GATEWAY_TRAZA)
   features/<slug>.ts    (config: model, schema, system, skills, budgets)
   skills/*.md           (skills como archivos)
```

**Regla**: fuera de `src/lib/ai/`, nadie llama directo a `generateObject|generateText|streamText|createAnthropic`. Todo pasa por el gateway, incluido research chat.

## 2.5 Plan incremental (Bloque 2)

1. **Contratos** — `src/lib/ai/contracts.ts` con `WorkerInput` por feature y tipos retorno. Nadie los usa aún.
2. **Input builder (sin templates todavía)** — extraer de `builder.ts` las funciones `build<Feature>Input(...)` a `input-builder.ts`. Devuelven `{ templateVars, context, params }` como hoy. Cero cambio funcional. Tests unitarios con fixture.
3. **Templates Jinja** — añadir `nunjucks` como dep. Crear `src/lib/ai/templates/<slug>.njk` por feature, portando el "user prompt" actual (el que hoy se compila desde Langfuse) a template local. El input builder ahora también devuelve `renderedInput: string`. En este paso `renderedInput` se calcula pero no se usa aún — seguimos en Langfuse.
4. **Mover skills a archivos** — `src/lib/ai/skills/*.md`. Reescribir resolver para leer del filesystem; mantener lectura de DB como fallback temporal.
5. **Feature files (config de features a código)** — `src/lib/ai/features/<slug>.ts` con `{ model, systemPrompt, schema, skills, budgets }`. `systemPrompt` portado desde Langfuse al código. `executeAI` pasa a leer de aquí en vez de `aiAgents`. Langfuse sigue disponible como fallback en esta fase.
6. **Cortar Langfuse** — `executeAI` ya no consulta Langfuse. System prompt y user template vienen 100% del repo. Se borra la integración. El flag `LANGFUSE_*` en `.env` deja de usarse.
7. **Gateway local** — crear `gateway.ts` + `gateway-local.ts`. Cada método toma el `input` (que ya incluye `renderedInput`), lo pasa como `prompt` a `generateObject/Text/Stream` junto al `systemPrompt` del feature file. Reutiliza `executeAI` internamente.
8. **Migrar rutas a gateway, una a una** — orden: `email-draft` → `interview` → `hypothesis` → `prep-brief` → `suggestions` → `refresh-profile` → `synthesize` → `shadowing-synthesize` → `research-chat` (SSE). Cada ruta queda en el patrón de 4 líneas.
9. **Stub de Traza + factory + flag** — `TrazaAIGateway` con `NotImplementedError`. `AI_GATEWAY_TRAZA` vacío. `TrazaAIGateway` envía `renderedInput` al endpoint cuando se implemente un feature en Bloque 3.
10. **Limpieza UI** — eliminar Settings > AI Models y admin de skills/agentes.
11. **Limpieza de schema** — `drop table skills, ai_agents`. Grep previo confirma cero referencias. Quitar `publicMetadata.aiModels` de Clerk y de `get-ai-config.ts`.

Cada paso deja el sistema verde. 4–6 son el corazón de la respuesta a tu pregunta: las features funcionan porque system prompt, templates y skills viven en código antes de dropear DB y Langfuse.

## 2.6 Verificación del bloque 2

- Grep fuera de `src/lib/ai/` de `generateObject|generateText|streamText|createAnthropic|langfuse` → 0.
- Tests unitarios de `input-builder` (render de template por feature → snapshot) y `LocalAIGateway`.
- Tests de integración de rutas (gateway mockeado) — persistencia y status HTTP idénticos al pre-refactor.
- E2E Playwright sin cambios de UX.
- `drizzle-kit` sin drift tras drops.
- Snapshots del `renderedInput` por feature revisados manualmente antes del paso 6 (garantizan paridad con el prompt que generaba Langfuse).

---

# Bloque 3 — (Futuro) Sustitución por workers de Traza

Fuera del alcance de este plan. Cuando un worker exista en Traza:

- Implementar el método correspondiente en `TrazaAIGateway` (HTTP + transport sync/async/SSE según convenga).
- Activar el feature flag `AI_GATEWAY_TRAZA=<slug>`.
- Validar paridad con logs comparativos durante N sesiones.
- Borrar del código el feature file, el prompt local y las skills sólo-usadas-por-ese-feature.

---

## Archivos críticos

**Bloque 1**:
- `src/lib/db/types.ts` — nuevos tipos
- `src/lib/db/schema.ts` — nuevas columnas, drops al final
- `drizzle/migrations/*`
- `scripts/backfill-*.ts`, `scripts/verify-data-integrity.ts`
- `src/lib/ai/schemas/*` — Zod para nuevos outputs
- `src/lib/ai/prompts/process-hypothesis.ts`, `session-synthesis.ts`, `shadowing-synthesis.ts`, nuevo `refresh-company-profile.ts`
- `src/lib/ai/layers/*` — L2/L3 leen nuevas columnas
- `src/modules/clients/components/company-profile-*.tsx`
- `src/modules/processes/components/hypothesis-*.tsx`
- `src/modules/processes/components/process-flow.tsx`

**Bloque 2**:
- `src/lib/ai/contracts.ts` (nuevo)
- `src/lib/ai/input-builder.ts` (nuevo)
- `src/lib/ai/templates/*.njk` (nuevos, uno por feature)
- `src/lib/ai/gateway.ts`, `gateway-local.ts`, `gateway-traza.ts`, `gateway-factory.ts` (nuevos)
- `src/lib/ai/features/*.ts` (nuevos, uno por feature con system + model + schema + skills + budgets)
- `src/lib/ai/skills/*.md` (migración desde DB)
- `src/lib/ai/builder.ts` — troceado; deja de consultar Langfuse
- `package.json` — añadir `nunjucks`, quitar integración Langfuse
- `.env` — quitar vars de Langfuse
- Todas las rutas en `src/app/api/...` que invocan IA
- `src/app/(dashboard)/settings/page.tsx` — eliminar AI Models
- Páginas de admin de skills/agentes — eliminadas

---

## Decisiones aún abiertas

1. **Sistemas en `ProcessGraph`**: metadata de step al inicio; promover a nodo cuando sea útil.
2. **Versionado de `hypothesis` y `profile`**: sin histórico al inicio (sólo `generatedAt`). Añadir tabla de snapshots sólo si se pide.
3. **`researchNotes`**: queda viva (historial de chats/consultas ad-hoc) — distinto de `clients.profile` (canónico).
4. **Feature flags de lectura** durante backfills: flags simples por env var; se eliminan tras validar cada paso.

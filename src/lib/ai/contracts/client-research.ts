import { z } from 'zod'
import { CONTRACT_SCHEMA_VERSION } from './constants'

// ---------------------------------------------------------------------------
// Strict schemas (server-side validation / typing)
// ---------------------------------------------------------------------------

export const researchSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  retrievedAt: z.string().datetime().optional(),
})

export const productOrServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
})

export const keyStakeholderSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  linkedinUrl: z.string().url().optional(),
})

// ---------------------------------------------------------------------------
// Lean schema handed to `generateObject` — kept intentionally minimal so the
// generated JSON Schema fits inside Anthropic's structured-output complexity
// and grammar-compilation budgets. No nested objects, no `.min`, no `.url`,
// no `.default`, no `.transform` — these bloat the JSON Schema with
// patterns/anyOf branches and trip "Schema is too complex" or "Grammar
// compilation timed out". All fields are optional string arrays of delimited
// entries; we split/parse them in `gateway-local.ts` before handing the
// result to the strict `clientResearchSchema`.
//
// Delimiter format per array:
// - `productsAndServices`: `"<name> — <description>"`
// - `keyStakeholders`:     `"<name> | <role> | <linkedinUrl>"` (linkedinUrl
//   optional — omit trailing pipe if missing)
// The discovery/extraction system prompts spell this convention out.
// ---------------------------------------------------------------------------

export const generatedClientResearchSchema = z.object({
  // A few anchor fields kept required. Anthropic's grammar compiler
  // times out on JSON Schemas that are 100% optional — giving it a
  // concrete backbone avoids "Grammar compilation timed out" errors.
  companyOverview: z.string(),
  fitScore: z.number(),
  fitScoreRationale: z.string(),
  areasOfExpertise: z.array(z.string()),
  productsAndServices: z.array(z.string()),
  techStack: z.array(z.string()),
  // The rest stay optional — they're one-liners that may not always be
  // available and shouldn't block extraction.
  sizeFinancials: z.string().optional(),
  customersMarkets: z.string().optional(),
  painPoints: z.string().optional(),
  recentNews: z.string().optional(),
  keyStakeholders: z.array(z.string()).optional(),
})

// ---------------------------------------------------------------------------
// Persisted contract. Applied server-side after backfilling defaults, so the
// strict bounds (int fitScore 1-10, valid URLs, etc.) only gate what we
// persist — not what the model is allowed to emit.
// ---------------------------------------------------------------------------

export const clientResearchSchema = z.object({
  companyOverview: z.string().optional(),
  sizeFinancials: z.string().optional(),
  customersMarkets: z.string().optional(),
  painPoints: z.string().optional(),
  recentNews: z.string().optional(),
  fitScore: z.number().int().min(1).max(10).optional(),
  fitScoreRationale: z.string().optional(),
  areasOfExpertise: z.array(z.string()).default([]),
  productsAndServices: z.array(productOrServiceSchema).default([]),
  keyStakeholders: z.array(keyStakeholderSchema).default([]),
  techStack: z.array(z.string()).default([]),
  researchSources: z.array(researchSourceSchema).default([]),
  researchedAt: z.string().datetime(),
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
})

export type GeneratedClientResearch = z.infer<typeof generatedClientResearchSchema>
export type ClientResearchPayload = z.infer<typeof clientResearchSchema>
export type ResearchSource = z.infer<typeof researchSourceSchema>
export type ProductOrService = z.infer<typeof productOrServiceSchema>
export type KeyStakeholder = z.infer<typeof keyStakeholderSchema>

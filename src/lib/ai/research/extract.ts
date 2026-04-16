import 'server-only'
import { generateObject } from 'ai'
import type { LanguageModel } from 'ai'
import { z } from 'zod'
import {
  researchNoteResultSchema,
  type ResearchNoteResult,
  RESEARCH_FINDING_CATEGORY,
  CONFIDENCE_LEVEL,
} from '@/lib/ai/contracts'

const EXTRACT_MAX_TOKENS = 800

const SYSTEM_PROMPT = `You distill a free-form research chat reply into a structured ResearchNoteResult.

Read the assistant reply in the user message and produce:
- summary: 1-2 sentence overall takeaway
- findings: each fact or claim from the reply, categorised (company, market, competitor, technical, people, other) with a confidence (high/medium/low)
- entitiesIdentified: people, companies, products mentioned (optional)
- followUpQuestions: 0-3 questions worth asking next (optional)

Be faithful to the source reply. Do not invent facts. If the reply is short or vague, return a minimal but valid result with empty arrays where appropriate.`

// AI-side schema: lacks schemaVersion (server adds it).
const generatedExtractSchema = z.object({
  summary: z.string().min(1),
  findings: z.array(
    z.object({
      category: z.enum([
        RESEARCH_FINDING_CATEGORY.COMPANY,
        RESEARCH_FINDING_CATEGORY.MARKET,
        RESEARCH_FINDING_CATEGORY.COMPETITOR,
        RESEARCH_FINDING_CATEGORY.TECHNICAL,
        RESEARCH_FINDING_CATEGORY.PEOPLE,
        RESEARCH_FINDING_CATEGORY.OTHER,
      ]),
      text: z.string().min(1),
      confidence: z.enum([
        CONFIDENCE_LEVEL.HIGH,
        CONFIDENCE_LEVEL.MEDIUM,
        CONFIDENCE_LEVEL.LOW,
      ]),
    })
  ),
  entitiesIdentified: z
    .array(z.object({ name: z.string().min(1), type: z.string().min(1) }))
    .optional(),
  followUpQuestions: z.array(z.string()).optional(),
})

/**
 * Runs a cheap second pass on the assistant reply produced by the
 * research-chat stream and turns it into a ResearchNoteResult.
 *
 * Best-effort: returns null on any failure so the caller can still
 * persist the raw text without losing data. Latency lives inside
 * `onFinish`, after the user already saw the streamed reply.
 */
export async function extractResearchNoteResult(args: {
  query: string
  reply: string
  model: LanguageModel
}): Promise<ResearchNoteResult | null> {
  if (!args.reply.trim()) return null

  try {
    const { object } = await generateObject({
      model: args.model,
      schema: generatedExtractSchema,
      maxOutputTokens: EXTRACT_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      prompt: `## User question\n${args.query}\n\n## Assistant reply\n${args.reply}`,
    })

    return researchNoteResultSchema.parse({ schemaVersion: 1, ...object })
  } catch (err) {
    console.warn('[research-chat] structured extraction failed:', err)
    return null
  }
}

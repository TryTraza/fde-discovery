/**
 * LocalAIGateway — implements AIGateway by calling the Anthropic SDK directly.
 *
 * Each method:
 *   1. Pulls the feature's systemPrompt from src/lib/ai/features/<slug>.ts
 *   2. Renders the user message via src/lib/ai/templates/<slug>.ts
 *   3. Invokes generateObject / generateText / streamText
 *   4. Returns the contract-shaped output
 *
 * No DB agent lookup, no prompt fetching, no Langfuse. All knowledge about
 * a feature lives in its feature file + template.
 */

import { generateObject, generateText, stepCountIs } from 'ai'
import { emailDraftFeature } from '@/lib/ai/features/email-draft'
import { sessionInterviewFeature } from '@/lib/ai/features/session-interview'
import { processHypothesisFeature } from '@/lib/ai/features/process-hypothesis'
import { prepBriefFeature } from '@/lib/ai/features/prep-brief'
import { captureSuggestionsFeature } from '@/lib/ai/features/capture-suggestions'
import {
  CLIENT_RESEARCH_DISCOVERY_PROMPT,
  clientResearchFeature,
} from '@/lib/ai/features/client-research'
import { sessionSynthesisFeature } from '@/lib/ai/features/session-synthesis'
import { shadowingSynthesisFeature } from '@/lib/ai/features/shadowing-synthesis'
import { renderEmailDraftTemplate } from '@/lib/ai/templates/email-draft'
import { renderSessionInterviewTemplate } from '@/lib/ai/templates/session-interview'
import { renderProcessHypothesisTemplate } from '@/lib/ai/templates/process-hypothesis'
import { renderPrepBriefTemplate } from '@/lib/ai/templates/prep-brief'
import { renderCaptureSuggestionsTemplate } from '@/lib/ai/templates/capture-suggestions'
import {
  renderClientResearchDiscoveryTemplate,
  renderClientResearchExtractionTemplate,
} from '@/lib/ai/templates/client-research'
import { renderSessionSynthesisTemplate } from '@/lib/ai/templates/session-synthesis'
import { renderShadowingSynthesisTemplate } from '@/lib/ai/templates/shadowing-synthesis'
import { interviewQuestionSchema } from '@/lib/ai/schemas/interview'
import { hypothesisSchema, type HypothesisOutput } from '@/lib/ai/schemas/hypothesis'
import { prepBriefSchema, type PrepBrief } from '@/lib/ai/schemas/prep-brief'
import { suggestionsSchema } from '@/lib/ai/schemas/suggestions'
import { synthesisOutputSchema, type SynthesisOutput } from '@/lib/ai/schemas/synthesis'
import {
  clientResearchSchema,
  generatedClientResearchSchema,
  type ClientResearchPayload,
  type ResearchSource,
} from '@/lib/ai/contracts'
import { buildAIInput } from '@/lib/ai/input-builder'
import { composeStructuredHypothesis } from '@/lib/ai/hypothesis/compose'
import type {
  AIGateway,
  CaptureSuggestion,
  CaptureSuggestionsGatewayInput,
  EmailDraftGatewayInput,
  InterviewQuestion,
  PrepBriefGatewayInput,
  ProcessHypothesisGatewayInput,
  ProcessHypothesisGatewayResult,
  ResearchClientGatewayInput,
  SessionInterviewGatewayInput,
  SessionSynthesisGatewayInput,
  ShadowingSynthesisGatewayInput,
} from './gateway'

const MAX_RESEARCH_PROSE_CHARS = 8000
const MAX_RESEARCH_SOURCES = 8

function extractWebSearchSources(
  steps: unknown,
  retrievedAt: string
): ResearchSource[] {
  if (!Array.isArray(steps)) return []
  const seen = new Map<string, ResearchSource>()
  for (const step of steps) {
    const content = (step as { content?: unknown })?.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const typed = part as { type?: string; output?: unknown }
      if (typed.type !== 'tool-result') continue
      if (!Array.isArray(typed.output)) continue
      for (const entry of typed.output) {
        if (!entry || typeof entry !== 'object') continue
        const { url, title } = entry as { url?: unknown; title?: unknown }
        if (typeof url !== 'string' || !url) continue
        if (seen.has(url)) continue
        seen.set(url, {
          url,
          title: typeof title === 'string' && title.length > 0 ? title : url,
          retrievedAt,
        })
      }
    }
  }
  // Cap the final list. Web search often emits 20+ dedupable sources
  // across a couple of queries; we only need the first handful as a
  // reader-trail. The tail just bloats the UI and the JSONB column.
  return Array.from(seen.values()).slice(0, MAX_RESEARCH_SOURCES)
}

function languageInstruction(language: 'en' | 'es'): string {
  return language === 'es'
    ? 'Write the email entirely in Spanish (formal business Spanish).'
    : 'Write the email in English.'
}

class LocalAIGatewayImpl implements AIGateway {
  async draftEmail(input: EmailDraftGatewayInput): Promise<string> {
    const feature = emailDraftFeature
    if (!feature.systemPrompt) {
      throw new Error(`[gateway-local] ${feature.slug}: systemPrompt missing`)
    }

    const userPrompt = renderEmailDraftTemplate({
      clientName: input.clientName,
      processName: input.processName,
      contacts: input.contacts,
      synthesisHighlights: input.synthesisHighlights,
      openQuestions: input.openQuestions,
      languageInstruction: languageInstruction(input.language),
    })

    const { text } = await generateText({
      model: input.model,
      system: feature.systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: feature.maxOutputTokens,
    })

    return text
  }

  async generateInterviewQuestion(
    input: SessionInterviewGatewayInput
  ): Promise<InterviewQuestion> {
    const feature = sessionInterviewFeature
    if (!feature.systemPrompt) {
      throw new Error(`[gateway-local] ${feature.slug}: systemPrompt missing`)
    }

    const built = await buildAIInput(feature.slug, { processId: input.processId })

    const userPrompt = renderSessionInterviewTemplate({
      clientSection: built.templateVars.clientSection ?? '',
      processSection: built.templateVars.processSection ?? '',
      processModelSection: built.templateVars.processModelSection ?? '',
      contactsSection: built.templateVars.contactsSection ?? '',
      previousAnswers: input.previousAnswers,
    })

    const { object } = await generateObject({
      model: input.model,
      system: feature.systemPrompt,
      prompt: userPrompt,
      schema: interviewQuestionSchema,
      maxOutputTokens: feature.maxOutputTokens,
    })

    return object as InterviewQuestion
  }

  async generateProcessHypothesis(
    input: ProcessHypothesisGatewayInput
  ): Promise<ProcessHypothesisGatewayResult> {
    const feature = processHypothesisFeature
    if (!feature.systemPrompt) {
      throw new Error(`[gateway-local] ${feature.slug}: systemPrompt missing`)
    }

    // Resolve L1 domain patterns through the layer pipeline. Client/process
    // facts come from the caller directly — no need to round-trip through L2/L3
    // for a just-created process where the caller already has the values.
    const built = await buildAIInput(feature.slug, { processId: input.processId })
    const allDomains = built.templateVars.allDomains ?? ''

    const userPrompt = renderProcessHypothesisTemplate({
      clientName: input.clientName,
      clientIndustry: input.clientIndustry,
      clientWebsite: input.clientWebsite,
      processName: input.processName,
      processDescription: input.processDescription,
      processDepartment: input.processDepartment,
      allDomains,
    })

    const { object } = await generateObject({
      model: input.model,
      system: feature.systemPrompt,
      prompt: userPrompt,
      schema: hypothesisSchema,
      maxOutputTokens: feature.maxOutputTokens,
    })

    const ai = object as HypothesisOutput
    let structured = null
    try {
      structured = composeStructuredHypothesis(ai)
    } catch (err) {
      console.warn(
        `[gateway-local] ${feature.slug}: structured composition failed; returning legacy fields only:`,
        err
      )
    }

    return {
      hypothesisText: ai.hypothesisText,
      matchedProcessType: ai.matchedProcessType,
      initialSteps: ai.initialSteps,
      structured,
    }
  }

  async generatePrepBrief(input: PrepBriefGatewayInput): Promise<PrepBrief> {
    const feature = prepBriefFeature
    if (!feature.systemPrompt) {
      throw new Error(`[gateway-local] ${feature.slug}: systemPrompt missing`)
    }

    const built = await buildAIInput(feature.slug, { sessionId: input.sessionId })

    const userPrompt = renderPrepBriefTemplate({
      clientSection: built.templateVars.clientSection ?? '',
      processSection: built.templateVars.processSection ?? '',
      processModelSection: built.templateVars.processModelSection ?? '',
      contactsSection: built.templateVars.contactsSection ?? '',
      priorSessionsSection: built.templateVars.priorSessionsSection ?? '',
      sessionInterviewAnswers: built.templateVars.sessionInterviewAnswers ?? '',
    })

    const { object } = await generateObject({
      model: input.model,
      system: feature.systemPrompt,
      prompt: userPrompt,
      schema: prepBriefSchema,
      maxOutputTokens: feature.maxOutputTokens,
    })

    return object as PrepBrief
  }

  async generateCaptureSuggestions(
    input: CaptureSuggestionsGatewayInput
  ): Promise<CaptureSuggestion[]> {
    const feature = captureSuggestionsFeature
    if (!feature.systemPrompt) {
      throw new Error(`[gateway-local] ${feature.slug}: systemPrompt missing`)
    }

    const built = await buildAIInput(feature.slug, { sessionId: input.sessionId })

    const userPrompt = renderCaptureSuggestionsTemplate({
      domainKnowledge: built.templateVars.domainKnowledge ?? '',
      processModelSection: built.templateVars.processModelSection ?? '',
      sessionEventsSection: built.templateVars.sessionEventsSection ?? '',
    })

    const { object } = await generateObject({
      model: input.model,
      system: feature.systemPrompt,
      prompt: userPrompt,
      schema: suggestionsSchema,
      maxOutputTokens: feature.maxOutputTokens,
    })

    const parsed = object as { suggestions: CaptureSuggestion[] }
    return parsed.suggestions ?? []
  }

  async researchClient(input: ResearchClientGatewayInput): Promise<ClientResearchPayload> {
    const feature = clientResearchFeature
    if (!feature.systemPrompt) {
      throw new Error(`[gateway-local] ${feature.slug}: systemPrompt missing`)
    }

    // Step 1 — web-search discovery via generateText.
    const discoveryPrompt = renderClientResearchDiscoveryTemplate({
      name: input.clientName,
      industry: input.clientIndustry,
      website: input.clientWebsite,
    })

    const discovery = await generateText({
      model: input.model,
      system: CLIENT_RESEARCH_DISCOVERY_PROMPT,
      prompt: discoveryPrompt,
      // max_uses caps the number of web_search tool invocations the
      // model can make in a single step. Without it, the model can
      // issue 5+ searches, each returning ~500-2000 token snippets
      // that all feed back into step 1b as input — easily blowing
      // past Anthropic's 30k input-tokens/min rate limit.
      tools: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI SDK v6 tool types
        web_search: input.anthropic.tools.webSearch_20250305({ maxUses: 2 }) as any,
      },
      stopWhen: stepCountIs(2),
      maxOutputTokens: feature.maxOutputTokens,
    })

    // Step 2 — extract + dedupe sources before extraction. All sources
    // share a single retrievedAt stamp; the final researchedAt matches
    // the snapshot so consumers can correlate the two.
    const retrievedAt = new Date().toISOString()
    const sources = extractWebSearchSources(discovery.steps, retrievedAt)
    const proseCapped = (discovery.text ?? '').slice(0, MAX_RESEARCH_PROSE_CHARS)

    const extractionPrompt = renderClientResearchExtractionTemplate({
      name: input.clientName,
      industry: input.clientIndustry,
      website: input.clientWebsite,
      researchProse: proseCapped,
      sources,
    })

    const { object } = await generateObject({
      model: input.model,
      system: feature.systemPrompt,
      prompt: extractionPrompt,
      schema: generatedClientResearchSchema,
      maxOutputTokens: feature.maxOutputTokens,
    })

    // The lean schema intentionally can't express int/min/max/nested objects
    // (Anthropic's structured-output compiler rejects anything complex), so
    // we reshape and validate here before handing to clientResearchSchema.

    // fitScore: round + clamp to [1,10].
    let fitScore: number | undefined
    if (typeof object.fitScore === 'number' && Number.isFinite(object.fitScore)) {
      const rounded = Math.round(object.fitScore)
      if (rounded >= 1 && rounded <= 10) fitScore = rounded
    }

    // productsAndServices: "<name> — <description>" → {name, description}.
    const productsAndServices = (object.productsAndServices ?? [])
      .map((raw) => {
        const [name, ...rest] = raw.split(/—|–|\s-\s/)
        const description = rest.join(' ').trim()
        const trimmedName = name?.trim() ?? ''
        if (!trimmedName || !description) return null
        return { name: trimmedName, description }
      })
      .filter((p): p is { name: string; description: string } => p !== null)

    // keyStakeholders: "<name> | <role> | <linkedinUrl>" → structured row.
    // linkedinUrl is optional; drop it if it isn't a plausible http(s) URL.
    const keyStakeholders = (object.keyStakeholders ?? [])
      .map((raw) => {
        const parts = raw.split('|').map((p) => p.trim()).filter(Boolean)
        const [name, role, linkedinUrl] = parts
        if (!name || !role) return null
        const linkedinOk = linkedinUrl && /^https?:\/\//.test(linkedinUrl)
        return linkedinOk ? { name, role, linkedinUrl } : { name, role }
      })
      .filter((s): s is { name: string; role: string; linkedinUrl?: string } => s !== null)

    return clientResearchSchema.parse({
      ...object,
      fitScore,
      productsAndServices,
      keyStakeholders,
      schemaVersion: 1,
      researchSources: sources,
      researchedAt: retrievedAt,
    })
  }

  async synthesizeSession(input: SessionSynthesisGatewayInput): Promise<SynthesisOutput> {
    const feature = sessionSynthesisFeature
    if (!feature.systemPrompt) {
      throw new Error(`[gateway-local] ${feature.slug}: systemPrompt missing`)
    }

    const built = await buildAIInput(feature.slug, { sessionId: input.sessionId })

    const userPrompt = renderSessionSynthesisTemplate({
      clientSection: built.templateVars.clientSection ?? '',
      processSection: built.templateVars.processSection ?? '',
      processModelSection: built.templateVars.processModelSection ?? '',
      contactsSection: built.templateVars.contactsSection ?? '',
      priorSessionsSection: built.templateVars.priorSessionsSection ?? '',
      sessionTranscript: built.templateVars.sessionTranscript ?? '',
      sessionNotes: built.templateVars.sessionNotes ?? '',
      sessionInterviewAnswers: built.templateVars.sessionInterviewAnswers ?? '',
    })

    const { object } = await generateObject({
      model: input.model,
      system: feature.systemPrompt,
      prompt: userPrompt,
      schema: synthesisOutputSchema,
      maxOutputTokens: feature.maxOutputTokens,
    })

    return object as SynthesisOutput
  }

  async synthesizeShadowing(input: ShadowingSynthesisGatewayInput): Promise<SynthesisOutput> {
    const feature = shadowingSynthesisFeature
    if (!feature.systemPrompt) {
      throw new Error(`[gateway-local] ${feature.slug}: systemPrompt missing`)
    }

    const built = await buildAIInput(feature.slug, { sessionId: input.sessionId })

    const userPrompt = renderShadowingSynthesisTemplate({
      clientSection: built.templateVars.clientSection ?? '',
      processSection: built.templateVars.processSection ?? '',
      processModelSection: built.templateVars.processModelSection ?? '',
      sessionEventsSection: built.templateVars.sessionEventsSection ?? '',
      debriefSection: built.templateVars.debriefSection ?? '',
      sessionTranscript: built.templateVars.sessionTranscript ?? '',
      sessionNotes: built.templateVars.sessionNotes ?? '',
      sessionInterviewAnswers: built.templateVars.sessionInterviewAnswers ?? '',
    })

    const { object } = await generateObject({
      model: input.model,
      system: feature.systemPrompt,
      prompt: userPrompt,
      schema: synthesisOutputSchema,
      maxOutputTokens: feature.maxOutputTokens,
    })

    return object as SynthesisOutput
  }
}

export const localAIGateway: AIGateway = new LocalAIGatewayImpl()

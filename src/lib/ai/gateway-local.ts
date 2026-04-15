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

import { generateObject, generateText } from 'ai'
import { emailDraftFeature } from '@/lib/ai/features/email-draft'
import { sessionInterviewFeature } from '@/lib/ai/features/session-interview'
import { processHypothesisFeature } from '@/lib/ai/features/process-hypothesis'
import { prepBriefFeature } from '@/lib/ai/features/prep-brief'
import { captureSuggestionsFeature } from '@/lib/ai/features/capture-suggestions'
import { renderEmailDraftTemplate } from '@/lib/ai/templates/email-draft'
import { renderSessionInterviewTemplate } from '@/lib/ai/templates/session-interview'
import { renderProcessHypothesisTemplate } from '@/lib/ai/templates/process-hypothesis'
import { renderPrepBriefTemplate } from '@/lib/ai/templates/prep-brief'
import { renderCaptureSuggestionsTemplate } from '@/lib/ai/templates/capture-suggestions'
import { interviewQuestionSchema } from '@/lib/ai/schemas/interview'
import { hypothesisSchema, type HypothesisOutput } from '@/lib/ai/schemas/hypothesis'
import { prepBriefSchema, type PrepBrief } from '@/lib/ai/schemas/prep-brief'
import { suggestionsSchema } from '@/lib/ai/schemas/suggestions'
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
  SessionInterviewGatewayInput,
} from './gateway'

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
}

export const localAIGateway: AIGateway = new LocalAIGatewayImpl()

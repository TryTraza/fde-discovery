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
import { renderEmailDraftTemplate } from '@/lib/ai/templates/email-draft'
import { renderSessionInterviewTemplate } from '@/lib/ai/templates/session-interview'
import { interviewQuestionSchema } from '@/lib/ai/schemas/interview'
import { buildAIInput } from '@/lib/ai/input-builder'
import type {
  AIGateway,
  EmailDraftGatewayInput,
  InterviewQuestion,
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
}

export const localAIGateway: AIGateway = new LocalAIGatewayImpl()

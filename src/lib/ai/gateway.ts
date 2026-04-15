/**
 * AIGateway — the single boundary between route handlers and AI execution.
 *
 * Every feature gets one method. Inputs are feature-shaped; outputs are the
 * domain contracts from src/lib/ai/contracts/. Once a feature is migrated
 * to the gateway, its route handler collapses to four lines:
 *
 *   1. authz
 *   2. const input = await build<Feature>Input(params)
 *   3. const output = await gateway.<method>(input)
 *   4. persist + return
 *
 * LocalAIGateway (gateway-local.ts) invokes Anthropic directly using the
 * feature config's systemPrompt + the rendered template. TrazaAIGateway
 * (gateway-traza.ts, Phase 2.9) ships the same input over HTTP to a
 * remote worker. Both implementations satisfy the same schema contracts,
 * which is what makes feature-by-feature cutover safe.
 */

import type { LanguageModel } from 'ai'

export interface EmailDraftGatewayInput {
  clientName: string
  processName: string
  contacts: Array<{ name: string; role?: string | null }>
  synthesisHighlights: string
  openQuestions: string[]
  language: 'en' | 'es'
  /**
   * Pre-resolved provider client and model. Injected by the route handler
   * because the gateway must stay unaware of Clerk / per-user keys.
   */
  model: LanguageModel
}

export interface AIGateway {
  draftEmail(input: EmailDraftGatewayInput): Promise<string>
}

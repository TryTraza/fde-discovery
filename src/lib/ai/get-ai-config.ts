import 'server-only'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { DEFAULT_MODELS, type AIFeature } from '@/lib/ai/models'

/**
 * Returns the per-feature Anthropic client bound to the caller's API key.
 *
 * As of Phase 2.5, model selection is purely code-driven: DEFAULT_MODELS
 * is the sole source of truth. publicMetadata.aiModels is no longer read;
 * it has been purged from every existing user (see
 * scripts/purge-clerk-ai-models.ts). Per-feature models now live in
 * src/lib/ai/features/<slug>.ts via the `model` tier ('fast' | 'standard').
 */
export async function getAIConfig(feature: AIFeature) {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) throw new Error('Unauthorized')

  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  const apiKey = (user.privateMetadata as Record<string, unknown>)?.anthropicApiKey as
    | string
    | undefined
  if (!apiKey) throw new Error('NO_API_KEY')

  const modelId = DEFAULT_MODELS[feature]
  const anthropic = createAnthropic({ apiKey })

  return { model: anthropic(modelId), modelId, anthropic }
}

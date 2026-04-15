import 'server-only'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { DEFAULT_MODELS, type AIFeature } from '@/lib/ai/models'

export async function getAIConfig(feature: AIFeature) {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) throw new Error('Unauthorized')

  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  const apiKey = (user.privateMetadata as Record<string, unknown>)?.anthropicApiKey as
    | string
    | undefined
  if (!apiKey) throw new Error('NO_API_KEY')

  const modelPrefs =
    ((user.publicMetadata as Record<string, unknown>)?.aiModels as
      | Record<string, string>
      | undefined) ?? {}
  const modelId = modelPrefs[feature] || DEFAULT_MODELS[feature]
  const anthropic = createAnthropic({ apiKey })

  return { model: anthropic(modelId), modelId, anthropic }
}

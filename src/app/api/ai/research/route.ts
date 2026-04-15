import 'server-only'
import { streamText, convertToModelMessages, stepCountIs, UIMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { requireAuthWithUser, handleAPIError } from '@/lib/auth/utils'
import { createResearchNote } from '@/lib/db/queries/research-notes'
import { getLayer } from '@/lib/ai/layers/registry'
import { PROMPTS } from '@/lib/ai/prompts/fixtures'
import { DEFAULT_MODELS } from '@/lib/ai/models'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // Auth: admin-only, then get user for API key
    const { user } = await requireAuthWithUser()
    const role = (user.publicMetadata as Record<string, unknown>)?.role ?? 'viewer'
    if (role !== 'admin') throw new Error('Forbidden: admin role required')

    // Pattern D: streaming requires direct provider access
    const apiKey = (user.privateMetadata as Record<string, unknown>)?.anthropicApiKey as
      | string
      | undefined
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key configured. Go to Settings.' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const anthropic = createAnthropic({ apiKey })
    const modelId = DEFAULT_MODELS.research

    const {
      messages,
      clientId,
      processId,
    }: {
      messages: UIMessage[]
      clientId?: string
      processId?: string
    } = await req.json()

    // Build context via layers (replaces manual context building)
    const vars: Record<string, string> = {}
    const layerPromises: Promise<void>[] = []

    if (clientId) {
      layerPromises.push(
        getLayer('l2-client')
          .resolve({ clientId }, { fields: 'full' })
          .then((r) => {
            Object.assign(vars, r.templateVars)
          })
          .catch(() => {})
      )
    }
    if (processId) {
      layerPromises.push(
        getLayer('l3-process')
          .resolve({ processId }, { includeModel: false, fields: 'summary' })
          .then((r) => {
            Object.assign(vars, r.templateVars)
          })
          .catch(() => {})
      )
    }
    await Promise.all(layerPromises)

    // Compile prompt from fixtures. Langfuse was retired in Phase 2.6.
    const fixture = PROMPTS.find((p) => p.name === 'research-chat')!
    const sysContent = fixture.prompt.find((m) => m.role === 'system')!.content
    const systemPrompt = sysContent.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')

    // Streaming call with onFinish stays in route
    const result = streamText({
      model: anthropic(modelId),
      messages: await convertToModelMessages(messages),
      tools: { web_search: anthropic.tools.webSearch_20250305() } as any,
      stopWhen: stepCountIs(5),
      system: systemPrompt,
      onFinish: async ({ text }) => {
        const lastUserMessage = messages.filter((m) => m.role === 'user').pop()
        if (lastUserMessage && clientId) {
          await createResearchNote({
            clientId,
            processId: processId ?? null,
            query:
              lastUserMessage.parts
                ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map((p) => p.text)
                .join('') || 'Research query',
            response: text,
            sources: [],
          }).catch(console.error)
        }
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    return handleAPIError(error)
  }
}

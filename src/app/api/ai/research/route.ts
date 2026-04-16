import 'server-only'
import { streamText, convertToModelMessages, stepCountIs, UIMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { requireAuthWithUser, handleAPIError } from '@/lib/auth/utils'
import { createResearchNote } from '@/lib/db/queries/research-notes'
import { getLayer } from '@/lib/ai/layers/registry'
import { researchChatFeature } from '@/lib/ai/features/research-chat'
import { renderResearchChatContext } from '@/lib/ai/templates/research-chat'
import { extractResearchNoteResult } from '@/lib/ai/research/extract'
import { DEFAULT_MODELS } from '@/lib/ai/models'

export const maxDuration = 30

function extractUserQuery(messages: UIMessage[]): string {
  const last = messages.filter((m) => m.role === 'user').pop()
  if (!last) return 'Research query'
  const text = last.parts
    ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
  return text || 'Research query'
}

export async function POST(req: Request) {
  try {
    // Auth: admin-only, then get user for API key.
    const { user } = await requireAuthWithUser()
    const role = (user.publicMetadata as Record<string, unknown>)?.role ?? 'viewer'
    if (role !== 'admin') throw new Error('Forbidden: admin role required')

    // Streaming requires direct provider access (no gateway method for SSE
    // yet — gateway streaming design lands with TrazaAIGateway in Bloque 3).
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
    const model = anthropic(modelId)

    const {
      messages,
      clientId,
      processId,
    }: {
      messages: UIMessage[]
      clientId?: string
      processId?: string
    } = await req.json()

    // Resolve context layers in parallel. Failures are silent — chat can
    // still operate without per-call context.
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

    // System prompt = static persona (feature config) + per-call context
    // (rendered template). Persona stays portable to a Traza worker.
    const persona = researchChatFeature.systemPrompt ?? ''
    const contextBlock = renderResearchChatContext({
      clientSection: vars.clientSection ?? '',
      processSection: vars.processSection ?? '',
    })
    const systemPrompt = contextBlock ? `${persona}\n\n${contextBlock}` : persona

    const userQuery = extractUserQuery(messages)

    const result = streamText({
      model,
      messages: await convertToModelMessages(messages),
      tools: { web_search: anthropic.tools.webSearch_20250305() } as any,
      stopWhen: stepCountIs(5),
      system: systemPrompt,
      onFinish: async ({ text }) => {
        if (!clientId) return
        // Cheap second pass that distills the streamed reply into a
        // ResearchNoteResult. Latency lives after the user's stream
        // already finished. Returns null on any failure — we still
        // persist the raw text so nothing is lost.
        const responseStructured = await extractResearchNoteResult({
          query: userQuery,
          reply: text,
          model,
        })
        await createResearchNote({
          clientId,
          processId: processId ?? null,
          query: userQuery,
          response: text,
          responseStructured,
          sources: [],
        }).catch(console.error)
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    return handleAPIError(error)
  }
}

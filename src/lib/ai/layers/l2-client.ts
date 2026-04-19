import { getClientById } from '@/lib/db/queries/clients'
import { getResearchByClientId } from '@/lib/db/queries/client-research'
import { getProcessById } from '@/lib/db/queries/processes'
import { getSessionById } from '@/lib/db/queries/sessions'
import type { ClientResearch } from '@/lib/db/schema'
import {
  EMPTY_LAYER_RESULT,
  type ContextLayer,
  type LayerParams,
  type LayerResult,
  type L2Options,
} from './types'

function formatResearch(research: ClientResearch | null): string {
  if (!research) return ''
  const lines: string[] = ['### AI Research']
  if (research.companyOverview) lines.push(research.companyOverview)
  if (research.fitScore !== null && research.fitScore !== undefined) {
    const rationale = research.fitScoreRationale ? ` — ${research.fitScoreRationale}` : ''
    lines.push(`- **Fit:** ${research.fitScore}/10${rationale}`)
  }
  if (research.sizeFinancials) lines.push(`- **Size & financials:** ${research.sizeFinancials}`)
  if (research.customersMarkets) lines.push(`- **Customers & markets:** ${research.customersMarkets}`)
  if (research.painPoints) lines.push(`- **Pain points:** ${research.painPoints}`)
  if (research.recentNews) lines.push(`- **Recent news:** ${research.recentNews}`)
  if (research.areasOfExpertise.length > 0) {
    lines.push(`- **Areas of expertise:** ${research.areasOfExpertise.join(', ')}`)
  }
  if (research.productsAndServices.length > 0) {
    lines.push('- **Products & services:**')
    for (const p of research.productsAndServices) {
      lines.push(`  - ${p.name}: ${p.description}`)
    }
  }
  if (research.keyStakeholders.length > 0) {
    lines.push('- **Key stakeholders:**')
    for (const s of research.keyStakeholders) {
      lines.push(`  - ${s.name} (${s.role})`)
    }
  }
  if (research.techStack.length > 0) {
    lines.push(`- **Tech stack:** ${research.techStack.join(', ')}`)
  }
  return lines.join('\n')
}

export const l2ClientLayer: ContextLayer<L2Options> = {
  name: 'l2-client',

  async resolve(params: LayerParams, options?: L2Options): Promise<LayerResult> {
    const fields = options?.fields ?? 'full'

    // Check rawData shortcut
    const rawName = params.rawData?.clientName as string | undefined
    const rawIndustry = params.rawData?.clientIndustry as string | undefined
    if (rawName && rawIndustry) {
      const vars: Record<string, string> = {
        clientName: rawName,
        clientIndustry: rawIndustry,
      }
      const rawWebsite = params.rawData?.clientWebsite as string | undefined
      if (rawWebsite) vars.clientWebsite = rawWebsite
      return { data: { client: params.rawData }, templateVars: vars }
    }

    // Resolve clientId from chain
    let clientId = params.clientId

    if (!clientId && params.processId) {
      const process = await getProcessById(params.processId)
      clientId = process?.clientId ?? undefined
    }

    if (!clientId && params.sessionId) {
      const session = await getSessionById(params.sessionId)
      if (session?.clientId) {
        clientId = session.clientId
      } else if (session?.processId) {
        const process = await getProcessById(session.processId)
        clientId = process?.clientId ?? undefined
      }
    }

    if (!clientId) return EMPTY_LAYER_RESULT

    const client = await getClientById(clientId)
    if (!client) return EMPTY_LAYER_RESULT

    const vars: Record<string, string> = {
      clientName: client.name,
      clientIndustry: client.industry,
      clientWebsite: client.website ?? '',
    }

    let research: ClientResearch | null = null

    if (fields === 'full') {
      research = await getResearchByClientId(clientId)
      const researchBlock = formatResearch(research)
      const lines = [
        `## Client: ${client.name}`,
        `- Industry: ${client.industry}`,
        client.website ? `- Website: ${client.website}` : null,
        client.hqLocation ? `- HQ: ${client.hqLocation}` : null,
        client.status ? `- Status: ${client.status}` : null,
        researchBlock ? `\n${researchBlock}` : null,
        client.notes ? `\n### Notes\n${client.notes}` : null,
      ].filter(Boolean)

      vars.clientSection = lines.join('\n')
      vars.clientStatus = client.status ?? ''
      vars.clientNotes = client.notes ?? ''
      vars.clientHqLocation = client.hqLocation ?? ''
    }

    return { data: { client, research }, templateVars: vars }
  },
}

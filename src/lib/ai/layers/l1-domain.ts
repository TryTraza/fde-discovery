import { getL1, getAllL1Domains, type L1Domain } from '@/lib/domain/l1'
import { getProcessById } from '@/lib/db/queries/processes'
import type { ContextLayer, LayerParams, LayerResult, L1Options } from './types'

function formatDomain(domain: L1Domain): string {
  const parts: string[] = []
  parts.push(`## Domain: ${domain.label} (${domain.type})`)

  if (domain.typicalSteps.length > 0) {
    parts.push('### Typical Steps')
    parts.push(
      domain.typicalSteps
        .map(
          (s) =>
            `- **${s.name}**: ${s.description}${s.typicalSystems.length > 0 ? ` (Systems: ${s.typicalSystems.join(', ')})` : ''}`
        )
        .join('\n')
    )
  }

  if (domain.commonEdgeCases.length > 0) {
    parts.push('### Common Edge Cases')
    parts.push(domain.commonEdgeCases.map((e) => `- ${e.description} (${e.frequency})`).join('\n'))
  }

  if (domain.commonSystems.length > 0) {
    parts.push(`### Common Systems: ${domain.commonSystems.join(', ')}`)
  }

  const variations = Object.entries(domain.industryVariations)
  if (variations.length > 0) {
    parts.push('### Industry Variations')
    parts.push(variations.map(([k, v]) => `- **${k}**: ${v}`).join('\n'))
  }

  return parts.join('\n\n')
}

export const l1DomainLayer: ContextLayer<L1Options> = {
  name: 'l1-domain',

  async resolve(params: LayerParams, options?: L1Options): Promise<LayerResult> {
    const mode = options?.mode ?? 'matched'

    if (mode === 'all') {
      const domains = getAllL1Domains()
      return {
        data: { domains },
        templateVars: {
          allDomains: domains.map(formatDomain).join('\n\n---\n\n'),
          domainKnowledge: '',
        },
      }
    }

    // mode === 'matched'
    let processType = params.rawData?.processType as string | undefined

    if (!processType && params.processId) {
      const process = await getProcessById(params.processId)
      processType = process?.processTypeL1 ?? undefined
    }

    if (!processType) {
      return {
        data: { domain: null },
        templateVars: { domainKnowledge: '', allDomains: '' },
      }
    }

    const domain = getL1(processType)
    return {
      data: { domain },
      templateVars: {
        domainKnowledge: formatDomain(domain),
        allDomains: '',
      },
    }
  },
}

import { renderTemplate } from './render'
import type { ResearchSource } from '@/lib/ai/contracts'

export interface ClientResearchDiscoveryTemplateInput {
  name: string
  industry: string | null
  website: string | null
}

export interface ClientResearchExtractionTemplateInput extends ClientResearchDiscoveryTemplateInput {
  researchProse: string
  sources: ResearchSource[]
}

export function renderClientResearchDiscoveryTemplate(
  input: ClientResearchDiscoveryTemplateInput
): string {
  return renderTemplate([
    {
      heading: 'Company',
      body: [
        `- Name: ${input.name}`,
        input.industry ? `- Industry: ${input.industry}` : null,
        input.website ? `- Website: ${input.website}` : null,
      ]
        .filter((l): l is string => l !== null)
        .join('\n'),
    },
  ])
}

export function renderClientResearchExtractionTemplate(
  input: ClientResearchExtractionTemplateInput
): string {
  return renderTemplate([
    {
      heading: 'Company',
      body: [
        `- Name: ${input.name}`,
        input.industry ? `- Industry: ${input.industry}` : null,
        input.website ? `- Website: ${input.website}` : null,
      ]
        .filter((l): l is string => l !== null)
        .join('\n'),
    },
    {
      heading: 'Research material',
      body: input.researchProse,
    },
    {
      when: input.sources.length > 0,
      heading: 'Discovered sources',
      body: input.sources.map((s) => `- ${s.title}: ${s.url}`).join('\n'),
    },
  ])
}

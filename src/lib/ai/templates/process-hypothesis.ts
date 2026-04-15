import { renderTemplate } from './render'

export interface ProcessHypothesisTemplateInput {
  clientName: string
  clientIndustry: string | null
  clientWebsite: string | null
  processName: string
  processDescription: string | null
  processDepartment: string | null
  /**
   * Layer-resolved domain patterns section (L1). Already formatted;
   * gateway passes through what buildAIInput produced.
   */
  allDomains: string
}

/**
 * User-message body for process-hypothesis. Pure context: domain
 * patterns, client facts, process facts. Persona + task instructions
 * live in the feature's systemPrompt.
 */
export function renderProcessHypothesisTemplate(
  input: ProcessHypothesisTemplateInput
): string {
  const clientLines = [
    `- Name: ${input.clientName}`,
    input.clientIndustry ? `- Industry: ${input.clientIndustry}` : null,
    input.clientWebsite ? `- Website: ${input.clientWebsite}` : null,
  ].filter((l): l is string => l !== null)

  const processLines = [
    `- Name: ${input.processName}`,
    input.processDescription ? `- Description: ${input.processDescription}` : null,
    input.processDepartment ? `- Department: ${input.processDepartment}` : null,
  ].filter((l): l is string => l !== null)

  return renderTemplate([
    {
      when: !!input.allDomains.trim(),
      heading: 'Domain patterns',
      body: input.allDomains,
    },
    { heading: 'Company', body: clientLines.join('\n') },
    { heading: 'Process', body: processLines.join('\n') },
  ])
}

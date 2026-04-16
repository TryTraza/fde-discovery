import { renderTemplate } from './render'

export interface RefreshCompanyProfileTemplateInput {
  name: string
  industry: string
  website: string | null
}

/**
 * User-message body for refresh-company-profile. Pure context:
 * name, industry, website. Persona + task live in systemPrompt.
 */
export function renderRefreshCompanyProfileTemplate(
  input: RefreshCompanyProfileTemplateInput
): string {
  return renderTemplate([
    {
      heading: 'Company',
      body: [
        `- Name: ${input.name}`,
        `- Industry: ${input.industry}`,
        input.website ? `- Website: ${input.website}` : null,
      ]
        .filter((l): l is string => l !== null)
        .join('\n'),
    },
  ])
}

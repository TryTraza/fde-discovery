import 'server-only'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { updateClient } from '@/lib/db/queries/clients'
import {
  companyProfileSchema,
  companySizeSchema,
  companyNewsSchema,
  keyStakeholderSchema,
  productOrServiceSchema,
  researchSourceSchema,
  type CompanyProfile,
} from '@/lib/ai/contracts'

const REFRESH_PROFILE_MAX_TOKENS = 2000

const SYSTEM_PROMPT =
  'You are a business research analyst. Produce a structured profile of the target company. Use only what is reliably known; omit uncertain fields rather than guessing. Always include at least one product or service.'

// The AI produces everything except schemaVersion and lastRefreshedAt, which
// the server composes. Keeps the model focused on content, not metadata.
const generatedProfileSchema = z.object({
  description: z.string().min(1),
  industry: z.string().min(1),
  size: companySizeSchema.optional(),
  areasOfExpertise: z.array(z.string()).default([]),
  productsAndServices: z.array(productOrServiceSchema),
  keyStakeholders: z.array(keyStakeholderSchema).optional(),
  techStack: z.array(z.string()).optional(),
  recentNews: z.array(companyNewsSchema).optional(),
  sources: z.array(researchSourceSchema).default([]),
})

function buildUserPrompt(args: { name: string; industry: string; website?: string | null }): string {
  const websiteLine = args.website ? `Website: ${args.website}` : ''
  return [
    `Company: ${args.name}`,
    `Industry: ${args.industry}`,
    websiteLine,
    '',
    'Produce a company profile covering description, industry (refine the input if useful), size (if known), areas of expertise, products and services, optional key stakeholders, optional tech stack, and optional recent news.',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function refreshCompanyProfile(args: {
  clientId: string
  name: string
  industry: string
  website?: string | null
}): Promise<CompanyProfile> {
  const { model } = await getAIConfig('research')

  const { object } = await generateObject({
    model,
    schema: generatedProfileSchema,
    maxOutputTokens: REFRESH_PROFILE_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(args),
  })

  const profile: CompanyProfile = companyProfileSchema.parse({
    schemaVersion: 1,
    ...object,
    lastRefreshedAt: new Date().toISOString(),
  })

  await updateClient(args.clientId, { profile })
  return profile
}

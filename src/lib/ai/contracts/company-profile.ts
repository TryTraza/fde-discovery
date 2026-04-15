import { z } from 'zod'
import { COMPANY_STAGE, CONTRACT_SCHEMA_VERSION } from './constants'

export const researchSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  retrievedAt: z.string().datetime().optional(),
})

export const companySizeSchema = z.object({
  // Note: no .int() / .nonnegative() — Anthropic structured outputs reject
  // `minimum`/`maximum` constraints on integers. Validation of shape
  // (non-negative integer) happens in UI/business logic, not in the schema.
  employees: z.number().optional(),
  revenueRange: z.string().optional(),
  stage: z
    .enum([COMPANY_STAGE.STARTUP, COMPANY_STAGE.GROWTH, COMPANY_STAGE.ENTERPRISE])
    .optional(),
})

export const productOrServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
})

export const keyStakeholderSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  linkedinUrl: z.string().url().optional(),
})

export const companyNewsSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  date: z.string().optional(),
  summary: z.string().min(1),
})

export const companyProfileSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  description: z.string().min(1),
  industry: z.string().min(1),
  size: companySizeSchema.optional(),
  areasOfExpertise: z.array(z.string()).default([]),
  productsAndServices: z.array(productOrServiceSchema),
  keyStakeholders: z.array(keyStakeholderSchema).optional(),
  techStack: z.array(z.string()).optional(),
  recentNews: z.array(companyNewsSchema).optional(),
  sources: z.array(researchSourceSchema).default([]),
  lastRefreshedAt: z.string().datetime(),
})

export type ResearchSource = z.infer<typeof researchSourceSchema>
export type CompanySize = z.infer<typeof companySizeSchema>
export type ProductOrService = z.infer<typeof productOrServiceSchema>
export type KeyStakeholder = z.infer<typeof keyStakeholderSchema>
export type CompanyNews = z.infer<typeof companyNewsSchema>
export type CompanyProfile = z.infer<typeof companyProfileSchema>

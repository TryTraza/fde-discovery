import { z } from 'zod'
import {
  CONFIDENCE_LEVEL,
  CONTRACT_SCHEMA_VERSION,
  RESEARCH_FINDING_CATEGORY,
} from './constants'

export const researchFindingSchema = z.object({
  category: z.enum([
    RESEARCH_FINDING_CATEGORY.COMPANY,
    RESEARCH_FINDING_CATEGORY.MARKET,
    RESEARCH_FINDING_CATEGORY.COMPETITOR,
    RESEARCH_FINDING_CATEGORY.TECHNICAL,
    RESEARCH_FINDING_CATEGORY.PEOPLE,
    RESEARCH_FINDING_CATEGORY.OTHER,
  ]),
  text: z.string().min(1),
  confidence: z.enum([
    CONFIDENCE_LEVEL.HIGH,
    CONFIDENCE_LEVEL.MEDIUM,
    CONFIDENCE_LEVEL.LOW,
  ]),
})

export const researchEntitySchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
})

export const researchNoteResultSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  summary: z.string().min(1),
  findings: z.array(researchFindingSchema),
  entitiesIdentified: z.array(researchEntitySchema).optional(),
  followUpQuestions: z.array(z.string()).optional(),
})

export type ResearchFinding = z.infer<typeof researchFindingSchema>
export type ResearchEntity = z.infer<typeof researchEntitySchema>
export type ResearchNoteResult = z.infer<typeof researchNoteResultSchema>

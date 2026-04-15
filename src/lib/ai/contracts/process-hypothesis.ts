import { z } from 'zod'
import { CONFIDENCE_LEVEL, CONTRACT_SCHEMA_VERSION, TRIGGER_FREQUENCY } from './constants'

const confidenceEnum = z.enum([
  CONFIDENCE_LEVEL.HIGH,
  CONFIDENCE_LEVEL.MEDIUM,
  CONFIDENCE_LEVEL.LOW,
])

export const hypothesisTriggerSchema = z.object({
  description: z.string().min(1),
  frequency: z
    .enum([
      TRIGGER_FREQUENCY.DAILY,
      TRIGGER_FREQUENCY.WEEKLY,
      TRIGGER_FREQUENCY.MONTHLY,
      TRIGGER_FREQUENCY.ON_DEMAND,
      TRIGGER_FREQUENCY.OTHER,
    ])
    .optional(),
})

export const hypothesisStakeholderSchema = z.object({
  role: z.string().min(1),
  responsibility: z.string().min(1),
})

export const hypothesisAssumptionSchema = z.object({
  text: z.string().min(1),
  confidence: confidenceEnum,
  validationQuestion: z.string().optional(),
})

export const hypothesisIoSchema = z.object({
  name: z.string().min(1),
  source: z.string().optional(),
  consumer: z.string().optional(),
  format: z.string().optional(),
})

export const hypothesisSystemSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  confidence: confidenceEnum,
})

export const processHypothesisSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  summary: z.string().min(1),
  triggers: z.array(hypothesisTriggerSchema),
  stakeholders: z.array(hypothesisStakeholderSchema),
  inputs: z.array(hypothesisIoSchema).default([]),
  outputs: z.array(hypothesisIoSchema).default([]),
  expectedSystems: z.array(hypothesisSystemSchema).default([]),
  assumptions: z.array(hypothesisAssumptionSchema),
  openQuestions: z.array(z.string()).default([]),
  generatedAt: z.string().datetime(),
})

export type HypothesisTrigger = z.infer<typeof hypothesisTriggerSchema>
export type HypothesisStakeholder = z.infer<typeof hypothesisStakeholderSchema>
export type HypothesisAssumption = z.infer<typeof hypothesisAssumptionSchema>
export type HypothesisIo = z.infer<typeof hypothesisIoSchema>
export type HypothesisSystem = z.infer<typeof hypothesisSystemSchema>
export type ProcessHypothesis = z.infer<typeof processHypothesisSchema>

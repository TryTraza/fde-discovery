import { z } from 'zod'
import {
  CONFIDENCE_LEVEL,
  CONTRACT_SCHEMA_VERSION,
  GRAPH_DIFF_OP,
  QUESTION_PRIORITY,
} from './constants'
import { edgeCaseSchema, graphEdgeSchema, graphNodeSchema } from './process-graph'

export const graphNodePatchSchema = z.object({
  op: z.enum([GRAPH_DIFF_OP.ADD, GRAPH_DIFF_OP.UPDATE, GRAPH_DIFF_OP.REMOVE]),
  node: graphNodeSchema.partial().extend({ id: z.string().min(1) }),
})

export const graphEdgePatchSchema = z.object({
  op: z.enum([GRAPH_DIFF_OP.ADD, GRAPH_DIFF_OP.UPDATE, GRAPH_DIFF_OP.REMOVE]),
  edge: graphEdgeSchema.partial().extend({ id: z.string().min(1) }),
})

export const processGraphDiffSchema = z.object({
  nodes: z.array(graphNodePatchSchema).default([]),
  edges: z.array(graphEdgePatchSchema).default([]),
  edgeCases: z.array(edgeCaseSchema).default([]),
})

export const synthesisQuestionSchema = z.object({
  text: z.string().min(1),
  priority: z.enum([
    QUESTION_PRIORITY.CRITICAL,
    QUESTION_PRIORITY.IMPORTANT,
    QUESTION_PRIORITY.NICE_TO_HAVE,
  ]),
})

export const synthesisConfidenceSchema = z.object({
  overall: z.enum([
    CONFIDENCE_LEVEL.HIGH,
    CONFIDENCE_LEVEL.MEDIUM,
    CONFIDENCE_LEVEL.LOW,
  ]),
  notes: z.string().optional(),
})

export const synthesisOutputSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  summary: z.string().min(1),
  graphPatch: processGraphDiffSchema,
  openQuestions: z.array(synthesisQuestionSchema).default([]),
  confidenceAssessment: synthesisConfidenceSchema,
})

export type ProcessGraphDiff = z.infer<typeof processGraphDiffSchema>
export type GraphNodePatch = z.infer<typeof graphNodePatchSchema>
export type GraphEdgePatch = z.infer<typeof graphEdgePatchSchema>
export type SynthesisQuestion = z.infer<typeof synthesisQuestionSchema>
export type SynthesisConfidence = z.infer<typeof synthesisConfidenceSchema>
export type SynthesisOutput = z.infer<typeof synthesisOutputSchema>

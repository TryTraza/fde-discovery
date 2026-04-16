import { z } from 'zod'
import {
  CONTRACT_SCHEMA_VERSION,
  EDGE_CASE_FREQUENCY,
  EDGE_CASE_STATUS,
  EDGE_TYPE,
  NODE_CONFIDENCE,
  NODE_TYPE,
} from './constants'

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    NODE_TYPE.STEP,
    NODE_TYPE.DECISION,
    NODE_TYPE.SYSTEM,
    NODE_TYPE.ARTIFACT,
    NODE_TYPE.TERMINAL,
  ]),
  label: z.string().min(1),
  description: z.string().optional(),
  confidence: z.enum([
    NODE_CONFIDENCE.CONFIRMED,
    NODE_CONFIDENCE.INFERRED,
    NODE_CONFIDENCE.ASSUMED,
    NODE_CONFIDENCE.OPEN_QUESTION,
  ]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  sourceSessionIds: z.array(z.string()).optional(),
})

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum([EDGE_TYPE.SEQUENCE, EDGE_TYPE.CONDITIONAL, EDGE_TYPE.DATA_FLOW]),
  label: z.string().optional(),
  condition: z.string().optional(),
  sourceSessionIds: z.array(z.string()).optional(),
})

export const edgeCaseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  affectedNodeIds: z.array(z.string()),
  affectedEdgeIds: z.array(z.string()).optional(),
  frequency: z.enum([
    EDGE_CASE_FREQUENCY.RARE,
    EDGE_CASE_FREQUENCY.OCCASIONAL,
    EDGE_CASE_FREQUENCY.FREQUENT,
    EDGE_CASE_FREQUENCY.UNKNOWN,
  ]),
  suggestedHandling: z.string().optional(),
  status: z.enum([EDGE_CASE_STATUS.OPEN, EDGE_CASE_STATUS.ADDRESSED]),
  sourceSessionId: z.string().optional(),
})

export const processGraphSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  edgeCases: z.array(edgeCaseSchema),
})

export type GraphNode = z.infer<typeof graphNodeSchema>
export type GraphEdge = z.infer<typeof graphEdgeSchema>
export type EdgeCase = z.infer<typeof edgeCaseSchema>
export type ProcessGraph = z.infer<typeof processGraphSchema>

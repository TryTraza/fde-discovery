export const CONTRACT_SCHEMA_VERSION = 1 as const

export const NODE_TYPE = {
  STEP: 'step',
  DECISION: 'decision',
  SYSTEM: 'system',
  ARTIFACT: 'artifact',
  TERMINAL: 'terminal',
} as const
export type NodeType = (typeof NODE_TYPE)[keyof typeof NODE_TYPE]

export const EDGE_TYPE = {
  SEQUENCE: 'sequence',
  CONDITIONAL: 'conditional',
  DATA_FLOW: 'data_flow',
} as const
export type EdgeType = (typeof EDGE_TYPE)[keyof typeof EDGE_TYPE]

export const NODE_CONFIDENCE = {
  CONFIRMED: 'confirmed',
  INFERRED: 'inferred',
  ASSUMED: 'assumed',
  OPEN_QUESTION: 'open_question',
} as const
export type NodeConfidence = (typeof NODE_CONFIDENCE)[keyof typeof NODE_CONFIDENCE]

export const EDGE_CASE_FREQUENCY = {
  RARE: 'rare',
  OCCASIONAL: 'occasional',
  FREQUENT: 'frequent',
  UNKNOWN: 'unknown',
} as const
export type EdgeCaseFrequency = (typeof EDGE_CASE_FREQUENCY)[keyof typeof EDGE_CASE_FREQUENCY]

export const EDGE_CASE_STATUS = {
  OPEN: 'open',
  ADDRESSED: 'addressed',
} as const
export type EdgeCaseStatus = (typeof EDGE_CASE_STATUS)[keyof typeof EDGE_CASE_STATUS]

export const CONFIDENCE_LEVEL = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const
export type ConfidenceLevel = (typeof CONFIDENCE_LEVEL)[keyof typeof CONFIDENCE_LEVEL]

export const TRIGGER_FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  ON_DEMAND: 'on_demand',
  OTHER: 'other',
} as const
export type TriggerFrequency = (typeof TRIGGER_FREQUENCY)[keyof typeof TRIGGER_FREQUENCY]

export const QUESTION_PRIORITY = {
  CRITICAL: 'critical',
  IMPORTANT: 'important',
  NICE_TO_HAVE: 'nice_to_have',
} as const
export type QuestionPriority = (typeof QUESTION_PRIORITY)[keyof typeof QUESTION_PRIORITY]

export const RESEARCH_FINDING_CATEGORY = {
  COMPANY: 'company',
  MARKET: 'market',
  COMPETITOR: 'competitor',
  TECHNICAL: 'technical',
  PEOPLE: 'people',
  OTHER: 'other',
} as const
export type ResearchFindingCategory =
  (typeof RESEARCH_FINDING_CATEGORY)[keyof typeof RESEARCH_FINDING_CATEGORY]

export const COMPANY_STAGE = {
  STARTUP: 'startup',
  GROWTH: 'growth',
  ENTERPRISE: 'enterprise',
} as const
export type CompanyStage = (typeof COMPANY_STAGE)[keyof typeof COMPANY_STAGE]

export const GRAPH_DIFF_OP = {
  ADD: 'add',
  UPDATE: 'update',
  REMOVE: 'remove',
} as const
export type GraphDiffOp = (typeof GRAPH_DIFF_OP)[keyof typeof GRAPH_DIFF_OP]

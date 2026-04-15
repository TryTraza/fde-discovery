export const AVAILABLE_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-haiku-4-5-20241022', label: 'Claude Haiku 4.5' },
] as const

export type AIFeature = 'research' | 'hypothesis' | 'suggestions' | 'synthesis' | 'interview'

export const DEFAULT_MODELS: Record<AIFeature, string> = {
  research: 'claude-sonnet-4-6',
  hypothesis: 'claude-sonnet-4-6',
  suggestions: 'claude-haiku-4-5-20241022',
  synthesis: 'claude-sonnet-4-6',
  interview: 'claude-sonnet-4-6',
}

export function getModelLabel(value: string): string {
  return AVAILABLE_MODELS.find((m) => m.value === value)?.label ?? value
}

export const AI_FEATURE_LABELS: Record<AIFeature, string> = {
  research: 'Research Agent',
  hypothesis: 'Hypothesis Generation',
  suggestions: 'Quick Suggestions',
  synthesis: 'Synthesis Report',
  interview: 'Interview Assistant',
}

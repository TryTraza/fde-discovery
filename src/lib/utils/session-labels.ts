import type { SessionType, SessionStatus } from '@/lib/db/schema'

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  discovery: 'Discovery',
  process_mapping: 'Process Mapping',
  shadowing: 'Shadowing',
  validation: 'Validation',
  demo: 'Demo',
}

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  synthesis_done: 'Synthesized',
}

/** Safe lookup — accepts any string, returns label or fallback. */
export function getSessionTypeLabel(type: string): string {
  return SESSION_TYPE_LABELS[type as SessionType] ?? type
}

/** Safe lookup — accepts any string, returns label or fallback. */
export function getSessionStatusLabel(status: string): string {
  return SESSION_STATUS_LABELS[status as SessionStatus] ?? status
}

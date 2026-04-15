import type { ProcessStatus } from '@/lib/db/schema'

const statusColors: Record<ProcessStatus, string> = {
  draft: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  mapping: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  validated: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  locked: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

interface ProcessStatusBadgeProps {
  status: string
}

export function ProcessStatusBadge({ status }: ProcessStatusBadgeProps) {
  const colors = statusColors[status as ProcessStatus] ?? statusColors.draft
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors}`}>{status}</span>
}

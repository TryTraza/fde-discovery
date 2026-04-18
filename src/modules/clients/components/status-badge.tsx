'use client'

import { Badge } from '@/components/ui/badge'
import type { ClientStatus } from '@/modules/clients/types'

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  prospecting: { label: 'Prospecting', variant: 'secondary' },
  active_poc:  { label: 'Active POC',  variant: 'default' },
  contracted:  { label: 'Contracted',  variant: 'outline' },
  expanding:   { label: 'Expanding',   variant: 'default' },
  inactive:    { label: 'Inactive',    variant: 'destructive' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as ClientStatus] ?? {
    label: status,
    variant: 'secondary' as const,
  }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

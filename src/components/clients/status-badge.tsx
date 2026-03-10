'use client';

import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  prospecting: { label: 'Prospecting', variant: 'secondary' },
  active_poc: { label: 'Active POC', variant: 'default' },
  demo_ready: { label: 'Demo Ready', variant: 'outline' },
  closed: { label: 'Closed', variant: 'destructive' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

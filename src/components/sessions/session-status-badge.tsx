'use client';

import { Badge } from '@/components/ui/badge';
import { SESSION_STATUS_LABELS } from '@/lib/utils/session-labels';
import type { SessionStatus } from '@/lib/db/schema';

const STATUS_VARIANT: Record<SessionStatus, 'outline' | 'default' | 'secondary' | 'destructive'> = {
  planned: 'outline',
  in_progress: 'default',
  completed: 'secondary',
  synthesis_done: 'secondary',
};

interface SessionStatusBadgeProps {
  status: string;
}

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const typed = status as SessionStatus;
  const label = SESSION_STATUS_LABELS[typed] ?? status;
  const variant = STATUS_VARIANT[typed] ?? 'outline';

  return <Badge variant={variant}>{label}</Badge>;
}

'use client'

import { getSessionTypeLabel } from '@/lib/utils/session-labels'
import { SessionStatusBadge } from './session-status-badge'
import { Badge } from '@/components/ui/badge'
import { CollapsibleCard } from '@/components/shared/collapsible-card'
import { CalendarDays, Clock, Users } from 'lucide-react'

interface SessionDetailCardProps {
  session: any
}

export function SessionDetailCard({ session }: SessionDetailCardProps) {
  return (
    <CollapsibleCard title="Details">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Type</span>
          <Badge variant="outline">{getSessionTypeLabel(session.type)}</Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <SessionStatusBadge status={session.status} />
        </div>

        {session.date && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Date</span>
            <span className="flex items-center gap-1.5 text-sm">
              <CalendarDays className="size-3.5 text-muted-foreground" />
              {session.date}
            </span>
          </div>
        )}

        {session.durationMinutes && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Duration</span>
            <span className="flex items-center gap-1.5 text-sm">
              <Clock className="size-3.5 text-muted-foreground" />
              {session.durationMinutes} min
            </span>
          </div>
        )}

        {session.contacts && session.contacts.length > 0 && (
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="size-3.5" />
              Contacts ({session.contacts.length})
            </span>
            <div className="flex flex-wrap gap-1">
              {session.contacts.map((contact: any) => (
                <Badge key={contact.id} variant="secondary">
                  {contact.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleCard>
  )
}

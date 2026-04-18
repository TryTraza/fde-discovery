'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

interface CollapsibleCardProps {
  title: React.ReactNode
  icon?: React.ElementType
  actions?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

export function CollapsibleCard({
  title,
  icon: Icon,
  actions,
  children,
  defaultOpen = true,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className={open ? 'pb-3' : ''}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:text-foreground/80">
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`}
              />
              <CardTitle className="text-base flex items-center gap-1.5">
                {Icon && <Icon className="size-4 text-muted-foreground" />}
                {title}
              </CardTitle>
            </CollapsibleTrigger>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

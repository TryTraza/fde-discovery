'use client'

import { useState } from 'react'
import { ChevronDown, Expand, Shrink } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CollapsibleCardProps {
  title: React.ReactNode
  icon?: React.ElementType
  actions?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  expandable?: boolean
}

export function CollapsibleCard({
  title,
  icon: Icon,
  actions,
  children,
  defaultOpen = true,
  expandable = false,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <Card className="py-3 gap-2">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CardHeader className={open ? 'pb-2' : ''}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:text-foreground/80">
                <ChevronDown
                  className={`size-4 text-muted-foreground/50 transition-transform ${open ? '' : '-rotate-90'}`}
                />
                <CardTitle className="text-base flex items-center gap-1.5">
                  {Icon && <Icon className="size-4 text-muted-foreground/50" />}
                  {title}
                </CardTitle>
              </CollapsibleTrigger>
              <div className="flex items-center gap-1">
                {actions && <div className="flex items-center gap-2">{actions}</div>}
                {expandable && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setExpanded(true)}
                  >
                    <Expand className="size-4" />
                    <span className="sr-only">Expand</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pb-1">{children}</CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {expandable && (
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                {Icon && <Icon className="size-4 text-muted-foreground/50" />}
                {title}
              </DialogTitle>
            </DialogHeader>
            <div>{children}</div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

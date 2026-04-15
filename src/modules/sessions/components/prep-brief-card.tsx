'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/shared/collapsible-card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import {
  Sparkles,
  RefreshCw,
  ChevronRight,
  MessageSquare,
  Target,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'
import type { PrepBrief } from '@/lib/ai/schemas/prep-brief'
import { sessionsService } from '@/modules/sessions/services/sessions-service'
import { ApiError, ApiKeyMissingError } from '@/lib/api-client'

interface PrepBriefCardProps {
  sessionId: string
  prepBrief: PrepBrief | null
  mutateSession: () => void
}

export function PrepBriefCard({ sessionId, prepBrief, mutateSession }: PrepBriefCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerate = async () => {
    setIsLoading(true)
    try {
      await sessionsService.generatePrepBrief(sessionId)
      mutateSession()
      toast.success('Prep brief generated')
    } catch (error) {
      if (error instanceof ApiKeyMissingError) {
        toast.error('Set your Anthropic API key in Settings to use AI features.')
      } else if (error instanceof ApiError) {
        const body = error.body as { error?: string } | null
        toast.error(body?.error ?? 'Failed to generate prep brief')
      } else {
        toast.error('Network error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <CollapsibleCard
      title="Prep Brief"
      actions={
        prepBrief ? (
          <Button variant="ghost" size="icon-sm" onClick={handleGenerate} disabled={isLoading}>
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        ) : undefined
      }
    >
      {!prepBrief ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Generate an AI prep brief with tailored questions, approaches, and focus areas for this
            session.
          </p>
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={isLoading}>
            <Sparkles className="mr-1.5 size-3.5" />
            {isLoading ? 'Generating...' : 'Generate Prep Brief'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {/* Summary */}
          <p className="text-muted-foreground">{prepBrief.summary}</p>

          {/* Questions to Ask */}
          <PrepSection
            icon={MessageSquare}
            title={`Questions to Ask (${prepBrief.questionsToAsk.length})`}
          >
            <ol className="space-y-3">
              {prepBrief.questionsToAsk.map((q, i) => (
                <li key={i} className="space-y-1">
                  <p className="font-medium">
                    {i + 1}. {q.question}
                  </p>
                  <p className="text-xs text-muted-foreground">{q.rationale}</p>
                  <p className="text-xs text-muted-foreground italic">Follow-up: {q.followUp}</p>
                </li>
              ))}
            </ol>
          </PrepSection>

          {/* Approaches */}
          <PrepSection icon={Lightbulb} title="Approaches">
            <ul className="space-y-2">
              {prepBrief.approaches.map((a, i) => (
                <li key={i}>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </li>
              ))}
            </ul>
          </PrepSection>

          {/* Areas to Probe */}
          <PrepSection icon={Target} title="Areas to Probe">
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              {prepBrief.areasToProbe.map((area, i) => (
                <li key={i}>{area}</li>
              ))}
            </ul>
          </PrepSection>

          {/* Watch For */}
          <PrepSection icon={AlertTriangle} title="Watch For">
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              {prepBrief.watchFor.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </PrepSection>
        </div>
      )}
    </CollapsibleCard>
  )
}

function PrepSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left font-medium hover:underline">
        <ChevronRight className={`size-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Icon className="size-3.5" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pl-5">{children}</CollapsibleContent>
    </Collapsible>
  )
}

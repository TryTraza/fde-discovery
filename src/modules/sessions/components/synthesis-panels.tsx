'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { SynthesisOutput } from '@/lib/ai/schemas/synthesis'
import { sessionsService } from '@/modules/sessions/services/sessions-service'
import { ApiError } from '@/lib/api-client'

interface SynthesisPanelsProps {
  sessionId: string
  synthesis: SynthesisOutput
  mutateSession: () => void
}

function changeTypeBadge(changeType: string) {
  switch (changeType) {
    case 'new':
      return (
        <Badge variant="default" className="bg-green-600 text-xs">
          New
        </Badge>
      )
    case 'modified':
      return (
        <Badge variant="default" className="bg-amber-500 text-xs">
          Modified
        </Badge>
      )
    case 'removed':
      return (
        <Badge variant="destructive" className="text-xs">
          Removed
        </Badge>
      )
    default:
      return null
  }
}

function priorityBadge(priority: string) {
  switch (priority) {
    case 'critical':
      return (
        <Badge variant="destructive" className="text-xs">
          Critical
        </Badge>
      )
    case 'important':
      return (
        <Badge variant="default" className="bg-amber-500 text-xs">
          Important
        </Badge>
      )
    case 'nice_to_have':
      return (
        <Badge variant="secondary" className="text-xs">
          Nice to have
        </Badge>
      )
    default:
      return null
  }
}

function confidenceBadge(confidence: string) {
  switch (confidence) {
    case 'confirmed':
      return (
        <Badge variant="outline" className="text-xs text-green-600 border-green-600">
          Confirmed
        </Badge>
      )
    case 'inferred':
      return (
        <Badge variant="outline" className="text-xs text-amber-500 border-amber-500">
          Inferred
        </Badge>
      )
    case 'missing':
      return (
        <Badge variant="outline" className="text-xs text-red-500 border-red-500">
          Missing
        </Badge>
      )
    default:
      return null
  }
}

export function SynthesisPanels({ sessionId, synthesis, mutateSession }: SynthesisPanelsProps) {
  const [applySteps, setApplySteps] = useState(true)
  const [applyEdgeCases, setApplyEdgeCases] = useState(true)
  const [applySystems, setApplySystems] = useState(true)
  const [applyQuestions, setApplyQuestions] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  const handleApply = async () => {
    setIsApplying(true)
    try {
      await sessionsService.applySynthesis(sessionId, {
        applySteps,
        applyEdgeCases,
        applySystems,
        applyQuestions,
      })
      setApplied(true)
      mutateSession()
      toast.success('Synthesis applied to process model')
    } catch (err: unknown) {
      const message =
        err instanceof ApiError && typeof (err.body as { error?: string })?.error === 'string'
          ? (err.body as { error: string }).error
          : err instanceof Error
            ? err.message
            : 'Failed to apply synthesis'
      toast.error(message)
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary + Confidence */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Synthesis Result</CardTitle>
            <Badge variant="outline" className="text-sm">
              Confidence: {synthesis.confidence}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{synthesis.summary}</p>
        </CardContent>
      </Card>

      {/* Steps Panel */}
      <CollapsibleSection
        title="Steps"
        count={synthesis.steps.length}
        checked={applySteps}
        onCheckedChange={setApplySteps}
        disabled={applied}
      >
        <div className="space-y-2">
          {synthesis.steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-2 rounded text-sm ${
                step.changeType === 'removed' ? 'line-through text-muted-foreground' : ''
              }`}
            >
              <span className="font-mono text-muted-foreground w-6 text-right shrink-0">
                {step.order}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{step.name}</span>
                  {changeTypeBadge(step.changeType)}
                  {confidenceBadge(step.confidence)}
                </div>
                <p className="text-muted-foreground mt-0.5">{step.description}</p>
                {step.changeReason && (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    Reason: {step.changeReason}
                  </p>
                )}
                {step.systems.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {step.systems.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Edge Cases Panel */}
      <CollapsibleSection
        title="Edge Cases"
        count={synthesis.edgeCases.length}
        checked={applyEdgeCases}
        onCheckedChange={setApplyEdgeCases}
        disabled={applied}
      >
        <div className="space-y-2">
          {synthesis.edgeCases.map((ec, i) => (
            <div key={i} className="p-2 rounded text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{ec.description}</span>
                {changeTypeBadge(ec.changeType)}
                <Badge variant="outline" className="text-xs">
                  {ec.frequency}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-0.5">{ec.suggestedHandling}</p>
            </div>
          ))}
          {synthesis.edgeCases.length === 0 && (
            <p className="text-sm text-muted-foreground">No edge cases identified.</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Systems Panel */}
      <CollapsibleSection
        title="Systems"
        count={synthesis.systems.length}
        checked={applySystems}
        onCheckedChange={setApplySystems}
        disabled={applied}
      >
        <div className="space-y-2">
          {synthesis.systems.map((sys, i) => (
            <div key={i} className="p-2 rounded text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{sys.name}</span>
                {changeTypeBadge(sys.changeType)}
                {sys.confirmed && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    Confirmed
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5">
                {sys.role} — {sys.details}
              </p>
              {sys.gaps && <p className="text-xs text-amber-600 mt-0.5">Gap: {sys.gaps}</p>}
              {sys.detailNotes && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Detail Notes</p>
                  <div className="text-xs bg-muted p-2 rounded font-mono whitespace-pre-wrap">
                    {sys.detailNotes}
                  </div>
                </div>
              )}
            </div>
          ))}
          {synthesis.systems.length === 0 && (
            <p className="text-sm text-muted-foreground">No systems identified.</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Open Questions Panel */}
      <CollapsibleSection
        title="Open Questions"
        count={synthesis.openQuestions.length}
        checked={applyQuestions}
        onCheckedChange={setApplyQuestions}
        disabled={applied}
      >
        <div className="space-y-2">
          {synthesis.openQuestions.map((q, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded text-sm">
              {priorityBadge(q.priority)}
              <span>{q.text}</span>
            </div>
          ))}
          {synthesis.openQuestions.length === 0 && (
            <p className="text-sm text-muted-foreground">No open questions.</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Apply Button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleApply} disabled={isApplying || applied}>
          {applied ? 'Changes Applied' : isApplying ? 'Applying...' : 'Apply Selected Changes'}
        </Button>
        {applied && <p className="text-sm text-muted-foreground">Process model updated.</p>}
      </div>
    </div>
  )
}

function CollapsibleSection({
  title,
  count,
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  title: string
  count: number
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:text-foreground transition-colors">
              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              <CardTitle className="text-base">
                {title} ({count})
              </CardTitle>
            </CollapsibleTrigger>
            {!disabled && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => onCheckedChange(v === true)}
                  id={`toggle-${title}`}
                />
                <label
                  htmlFor={`toggle-${title}`}
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Include
                </label>
              </div>
            )}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

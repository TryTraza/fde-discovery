'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { ReactFlow, Background, type NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { arrayMove } from '@dnd-kit/sortable'
import { Save, Undo2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseProcessSteps, type ProcessStepParsed } from '@/lib/validations/process'
import { layoutProcessSteps } from '@/lib/utils/flow-layout'
import { TerminalNode } from './flow-nodes/terminal-node'
import { StepNode } from './flow-nodes/step-node'
import { AnimatedEdge } from './flow-nodes/animated-edge'
import { FlowControls } from './flow-nodes/flow-controls'
import { SketchyDefs } from './flow-nodes/sketchy-defs'
import { StepDetailPanel } from './flow-nodes/step-detail-panel'
import { ConfidenceLegend } from './confidence-legend'
import { toast } from 'sonner'
import { processesService } from '@/modules/processes/services/processes-service'
import { ApiError } from '@/lib/api-client'

interface ProcessFlowProps {
  process: any
  clientId: string
  processId: string
  mutateProcess: () => void
}

const nodeTypes = {
  terminal: TerminalNode,
  processStep: StepNode,
}

const edgeTypes = {
  animated: AnimatedEdge,
}

function generateStepId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function ProcessFlow({ process, clientId, processId, mutateProcess }: ProcessFlowProps) {
  const serverSteps = parseProcessSteps(process.processModel?.steps)
  const [localSteps, setLocalSteps] = useState<ProcessStepParsed[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  const steps = localSteps ?? serverSteps
  const isDirty = localSteps !== null

  // Sync when server data changes and we're not dirty
  const prevServerRef = useRef(serverSteps)
  if (!isDirty && JSON.stringify(prevServerRef.current) !== JSON.stringify(serverSteps)) {
    prevServerRef.current = serverSteps
  }

  // Layout
  const { nodes, edges } = useMemo(() => layoutProcessSteps(steps), [steps])

  // Selected step
  const selectedStepIndex = steps.findIndex((s) => s.id === selectedStepId)
  const selectedStep = selectedStepIndex >= 0 ? steps[selectedStepIndex] : null

  const updateLocalSteps = useCallback(
    (updater: (prev: ProcessStepParsed[]) => ProcessStepParsed[]) => {
      setLocalSteps((prev) => updater(prev ?? serverSteps))
    },
    [serverSteps]
  )

  const handleUpdateStep = useCallback(
    (id: string, field: keyof ProcessStepParsed, value: unknown) => {
      updateLocalSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
    },
    [updateLocalSteps]
  )

  const handleDeleteStep = useCallback(
    (id: string) => {
      updateLocalSteps((prev) => prev.filter((s) => s.id !== id))
      if (selectedStepId === id) setSelectedStepId(null)
    },
    [updateLocalSteps, selectedStepId]
  )

  const handleAddStep = useCallback(() => {
    updateLocalSteps((prev) => [
      ...prev,
      {
        id: generateStepId(),
        name: '',
        description: '',
        order: prev.length + 1,
        confidence: 'inferred' as const,
        systems: [],
        edgeCases: [],
        notes: '',
      },
    ])
  }, [updateLocalSteps])

  const handleMoveUp = useCallback(
    (id: string) => {
      updateLocalSteps((prev) => {
        const idx = prev.findIndex((s) => s.id === id)
        if (idx <= 0) return prev
        return arrayMove(prev, idx, idx - 1)
      })
    },
    [updateLocalSteps]
  )

  const handleMoveDown = useCallback(
    (id: string) => {
      updateLocalSteps((prev) => {
        const idx = prev.findIndex((s) => s.id === id)
        if (idx < 0 || idx >= prev.length - 1) return prev
        return arrayMove(prev, idx, idx + 1)
      })
    },
    [updateLocalSteps]
  )

  const handleDiscard = useCallback(() => {
    setLocalSteps(null)
    setSelectedStepId(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!localSteps || localSteps.length === 0) return

    const emptyNames = localSteps.some((s) => !s.name.trim())
    if (emptyNames) {
      toast.error('All steps must have a name')
      return
    }

    setSaving(true)
    try {
      await processesService.updateSteps(
        clientId,
        processId,
        localSteps.map((s, i) => ({ ...s, order: i + 1 }))
      )
      setLocalSteps(null)
      mutateProcess()
      toast.success('Steps saved successfully')
    } catch (err: unknown) {
      const message =
        err instanceof ApiError && typeof (err.body as { error?: string })?.error === 'string'
          ? (err.body as { error: string }).error
          : err instanceof Error
            ? err.message
            : 'Failed to save steps'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }, [localSteps, clientId, processId, mutateProcess])

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.type === 'processStep') {
      setSelectedStepId((prev) => (prev === node.id ? null : node.id))
    }
  }, [])

  // Canvas height: taller for more steps, min 350px, max 600px
  const canvasHeight = Math.min(600, Math.max(350, steps.length * 110 + 150))

  return (
    <div className="space-y-3">
      {/* Header: legend + save/discard */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <ConfidenceLegend onAddStep={handleAddStep} />
        {isDirty && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
              <Undo2 className="size-3.5 mr-1" />
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="size-3.5 mr-1" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {/* ReactFlow canvas */}
      {steps.length === 0 && !isDirty ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No steps yet. Generate a hypothesis to create initial steps, or add steps manually.
        </p>
      ) : (
        <div
          className="relative rounded-xl border-[1.5px] border-border/60 overflow-hidden bg-[#fafaf8] dark:bg-[#1a1a1a]"
          style={{ height: canvasHeight }}
        >
          <SketchyDefs />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.35 }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesReconnectable={false}
            panOnScroll
            zoomOnScroll={false}
            minZoom={0.3}
            maxZoom={1.5}
          >
            <Background gap={24} size={0.6} color="hsl(var(--foreground) / 0.06)" />
            <FlowControls />
          </ReactFlow>
        </div>
      )}

      {/* Step detail sheet */}
      <StepDetailPanel
        open={selectedStep !== null}
        step={selectedStep}
        stepIndex={selectedStepIndex}
        totalSteps={steps.length}
        onUpdate={handleUpdateStep}
        onDelete={handleDeleteStep}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onClose={() => setSelectedStepId(null)}
      />
    </div>
  )
}

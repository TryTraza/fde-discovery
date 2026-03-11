'use client';

import { useState, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Save, Undo2, Loader2, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { parseProcessSteps, type ProcessStepParsed } from '@/lib/validations/process';
import { StepCard } from './step-card';
import { toast } from 'sonner';

interface ProcessFlowProps {
  process: any;
  clientId: string;
  processId: string;
  mutateProcess: () => void;
}

function generateStepId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ProcessFlow({ process, clientId, processId, mutateProcess }: ProcessFlowProps) {
  const serverSteps = parseProcessSteps(process.processModel?.steps);
  const [localSteps, setLocalSteps] = useState<ProcessStepParsed[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Use local state if dirty, otherwise server state
  const steps = localSteps ?? serverSteps;
  const isDirty = localSteps !== null;

  // Sync when server data changes and we're not dirty
  const prevServerRef = useRef(serverSteps);
  if (!isDirty && JSON.stringify(prevServerRef.current) !== JSON.stringify(serverSteps)) {
    prevServerRef.current = serverSteps;
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateLocalSteps = useCallback((updater: (prev: ProcessStepParsed[]) => ProcessStepParsed[]) => {
    setLocalSteps((prev) => updater(prev ?? serverSteps));
  }, [serverSteps]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    updateLocalSteps((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, [updateLocalSteps]);

  const handleUpdateStep = useCallback((id: string, field: keyof ProcessStepParsed, value: unknown) => {
    updateLocalSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }, [updateLocalSteps]);

  const handleDeleteStep = useCallback((id: string) => {
    updateLocalSteps((prev) => prev.filter((s) => s.id !== id));
  }, [updateLocalSteps]);

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
    ]);
  }, [updateLocalSteps]);

  const handleDiscard = useCallback(() => {
    setLocalSteps(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!localSteps || localSteps.length === 0) return;

    // Validate: all steps need a name
    const emptyNames = localSteps.some((s) => !s.name.trim());
    if (emptyNames) {
      toast.error('All steps must have a name');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/processes/${processId}/steps`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: localSteps.map((s, i) => ({ ...s, order: i + 1 })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to save (${res.status})`);
      }

      setLocalSteps(null);
      mutateProcess();
      toast.success('Steps saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save steps');
    } finally {
      setSaving(false);
    }
  }, [localSteps, clientId, processId, mutateProcess]);

  const [open, setOpen] = useState(true);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-1.5 cursor-pointer hover:text-foreground/80">
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`}
              />
              <CardTitle className="text-base">Process Steps</CardTitle>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {isDirty && (
                <>
                  <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
                    <Undo2 className="size-3.5 mr-1" />
                    Discard
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
                    Save
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleAddStep}>
                <Plus className="size-3.5 mr-1" />
                Add Step
              </Button>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No steps yet. Generate a hypothesis to create initial steps, or add steps manually.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {steps.map((step, index) => (
                      <StepCard
                        key={step.id}
                        step={step}
                        index={index}
                        onUpdate={handleUpdateStep}
                        onDelete={handleDeleteStep}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

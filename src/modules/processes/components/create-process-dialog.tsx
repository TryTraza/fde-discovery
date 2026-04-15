'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createProcessSchema } from '@/lib/validations/process';
import { processesService } from '@/modules/processes/services/processes-service';
import { ApiError } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CreateProcessDialogProps {
  clientId: string;
  onCreated: () => void;
  children: React.ReactNode;
}

export function CreateProcessDialog({
  clientId,
  onCreated,
  children,
}: CreateProcessDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentTag, setDepartmentTag] = useState('');
  const [knownSystems, setKnownSystems] = useState('');
  const [knownPainPoints, setKnownPainPoints] = useState('');

  const resetForm = () => {
    setName('');
    setDescription('');
    setDepartmentTag('');
    setKnownSystems('');
    setKnownPainPoints('');
    setFieldErrors({});
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});

    const formData = {
      name: name.trim(),
      description: description.trim() || undefined,
      departmentTag: departmentTag.trim() || undefined,
      knownSystems: knownSystems.trim()
        ? knownSystems.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      knownPainPoints: knownPainPoints.trim() || undefined,
    };

    const parsed = createProcessSchema.safeParse(formData);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      setIsSubmitting(false);
      return;
    }

    try {
      const newProcess = await processesService.create(clientId, parsed.data);
      setOpen(false);
      resetForm();
      onCreated();
      toast.success('Process created');
      router.push(`/clients/${clientId}/processes/${newProcess.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: string; details?: Record<string, string[]> } | null;
        if (body?.details) setFieldErrors(body.details);
        toast.error(typeof body?.error === 'string' ? body.error : 'Failed to create process');
      } else {
        toast.error('Network error. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogTrigger render={children as React.JSX.Element} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Process</DialogTitle>
          <DialogDescription>
            Add a business process to map. AI will generate an initial hypothesis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proc-name">Name *</Label>
            <Input
              id="proc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Purchasing, Invoice Processing"
              required
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="proc-dept">Department</Label>
            <Input
              id="proc-dept"
              value={departmentTag}
              onChange={(e) => setDepartmentTag(e.target.value)}
              placeholder="e.g. Operations, Finance"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proc-desc">Description</Label>
            <Textarea
              id="proc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the process..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proc-systems">Known Systems</Label>
            <Input
              id="proc-systems"
              value={knownSystems}
              onChange={(e) => setKnownSystems(e.target.value)}
              placeholder="SAP, Email, Excel"
            />
            <p className="text-xs text-muted-foreground">Comma-separated. Used for AI context only.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="proc-pain">Known Pain Points</Label>
            <Textarea
              id="proc-pain"
              value={knownPainPoints}
              onChange={(e) => setKnownPainPoints(e.target.value)}
              placeholder="What problems have you heard about this process?"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Process'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

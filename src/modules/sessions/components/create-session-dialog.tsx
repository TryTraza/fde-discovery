'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useContacts } from '@/modules/contacts/hooks/use-contacts';
import { getSessionTypeLabel } from '@/lib/utils/session-labels';
import { sessionsService } from '@/modules/sessions/services/sessions-service';
import { ApiError } from '@/lib/api-client';
import { SessionTypeSelector } from './session-type-selector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, X } from 'lucide-react';

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  processId: string;
  onCreated: () => void;
}

export function CreateSessionDialog({
  open,
  onOpenChange,
  clientId,
  processId,
  onCreated,
}: CreateSessionDialogProps) {
  const router = useRouter();
  const { contacts } = useContacts(clientId);

  const [step, setStep] = useState<'type' | 'details'>('type');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sessionType, setSessionType] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('type');
      setSessionType(null);
      setTitle('');
      setDate(new Date().toISOString().split('T')[0]);
      setSelectedContactIds([]);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleTypeSelect = (type: string) => {
    setSessionType(type);
    setTitle(getSessionTypeLabel(type));
    setStep('details');
  };

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionType || !title.trim() || !date) return;
    submitSession();
  };

  const submitSession = async (interviewAnswers?: { question: string; answer: string }[]) => {
    if (!sessionType || !title.trim() || !date) return;

    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        processId,
        type: sessionType,
        title: title.trim(),
        date,
        contactIds: selectedContactIds,
      };

      if (interviewAnswers && interviewAnswers.length > 0) {
        body.interviewAnswers = { questions: interviewAnswers };
      }

      const newSession = await sessionsService.create(body as Parameters<typeof sessionsService.create>[0]);
      onOpenChange(false);
      onCreated();
      toast.success('Session created');
      router.push(`/clients/${clientId}/processes/${processId}/sessions/${newSession.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: string } | null;
        toast.error(typeof body?.error === 'string' ? body.error : 'Failed to create session');
      } else {
        toast.error('Network error. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepDescription: Record<string, string> = {
    type: 'What kind of session are you planning?',
    details: 'Fill in the session details.',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'type'
              ? 'New Session'
              : `New ${getSessionTypeLabel(sessionType!)} Session`}
          </DialogTitle>
          <DialogDescription>
            {stepDescription[step]}
          </DialogDescription>
        </DialogHeader>

        {step === 'type' && (
          <SessionTypeSelector onSelect={handleTypeSelect} />
        )}

        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-title">Title *</Label>
              <Input
                id="session-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Session title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-date">Date *</Label>
              <Input
                id="session-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {contacts.length > 0 && (
              <div className="space-y-2">
                <Label>Contacts</Label>
                <div className="flex flex-wrap gap-1.5">
                  {contacts.map((contact: any) => {
                    const selected = selectedContactIds.includes(contact.id);
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => toggleContact(contact.id)}
                        className="inline-flex"
                      >
                        <Badge variant={selected ? 'default' : 'outline'}>
                          {contact.name}
                          {selected && <X className="ml-1 size-3" />}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Click to select contacts for this session.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('type')}
              >
                <ArrowLeft className="mr-1.5 size-3.5" />
                Back
              </Button>
              <Button type="submit" disabled={!title.trim() || !date || isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Session'}
              </Button>
            </DialogFooter>
          </form>
        )}

      </DialogContent>
    </Dialog>
  );
}

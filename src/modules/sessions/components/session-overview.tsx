'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRole } from '@/lib/hooks/use-role';
import { toast } from 'sonner';
import { useSession } from '@/modules/sessions/hooks/use-sessions';
import { getSessionTypeLabel } from '@/lib/utils/session-labels';
import { sessionsService } from '@/modules/sessions/services/sessions-service';
import { ApiError, ApiKeyMissingError } from '@/lib/api-client';
import type { SessionStatus } from '@/lib/db/schema';
import { SessionStatusBadge } from './session-status-badge';
import { EmailDraftCard } from '@/modules/research/components/email-draft-card';
import { TranscriptNotesEditor } from './transcript-notes-editor';
import { PrepBriefPanel } from './prep-brief-panel';
import { QuestionSidebar } from './question-sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Trash2,
  CalendarDays,
  Users,
  MessageSquare,
  ClipboardList,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { ShadowingCapturePanel } from './shadowing-capture-panel';
import { SynthesisPanels } from './synthesis-panels';
import { DebriefPanel } from '@/modules/debrief/components/debrief-panel';
import type { SynthesisOutput } from '@/lib/ai/schemas/synthesis';
import type { PrepBrief } from '@/lib/ai/schemas/prep-brief';
import type { DebriefAnswers } from '@/lib/db/types';

interface SessionOverviewProps {
  clientId: string;
  processId: string;
  sessionId: string;
}

const sections = [
  { id: 'preparation', label: 'Preparation', icon: ClipboardList },
  { id: 'capture', label: 'Session Capture', icon: PenLine },
  { id: 'results', label: 'Synthesis', icon: Sparkles },
] as const;

type SectionId = (typeof sections)[number]['id'];

export function SessionOverview({ clientId, processId, sessionId }: SessionOverviewProps) {
  const { session, isLoading, error, mutateSession } = useSession(sessionId);
  const { isAdmin } = useRole();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionId>('preparation');
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const autoGenTriggered = useRef(false);

  // questionsAsked state + auto-save
  const [questionsAsked, setQuestionsAsked] = useState<boolean[]>([]);
  const qaTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const qaInitialized = useRef(false);

  const prepBrief = session?.prepBrief as PrepBrief | null;

  // Initialize questionsAsked from session data
  useEffect(() => {
    if (!session || qaInitialized.current) return;
    if (session.questionsAsked) {
      setQuestionsAsked(session.questionsAsked as boolean[]);
      qaInitialized.current = true;
    } else if (prepBrief?.questionsToAsk) {
      setQuestionsAsked(new Array(prepBrief.questionsToAsk.length).fill(false));
      qaInitialized.current = true;
    }
  }, [session, prepBrief]);

  const scheduleQASave = useCallback(
    (newQA: boolean[]) => {
      if (qaTimeoutRef.current) clearTimeout(qaTimeoutRef.current);
      qaTimeoutRef.current = setTimeout(async () => {
        try {
          await sessionsService.update(sessionId, {
            questionsAsked: newQA,
          } as Parameters<typeof sessionsService.update>[1]);
        } catch {
          // silent — non-critical save
        }
      }, 2000);
    },
    [sessionId]
  );

  const toggleQuestion = useCallback(
    (index: number) => {
      setQuestionsAsked((prev) => {
        const next = [...prev];
        next[index] = !next[index];
        scheduleQASave(next);
        return next;
      });
    },
    [scheduleQASave]
  );

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (qaTimeoutRef.current) clearTimeout(qaTimeoutRef.current);
    };
  }, []);

  // Auto-generate prep brief if interview answers exist but no prep brief yet
  useEffect(() => {
    if (!session || autoGenTriggered.current) return;
    if (session.interviewAnswers && !session.prepBrief) {
      autoGenTriggered.current = true;
      sessionsService
        .generatePrepBrief(sessionId)
        .then(() => mutateSession())
        .catch(() => {});
    }
  }, [session, sessionId, mutateSession]);

  const onDelete = async () => {
    setDeleting(true);
    try {
      await sessionsService.delete(sessionId);
      toast.success('Session deleted');
      router.push(`/clients/${clientId}/processes/${processId}/sessions`);
    } catch (error) {
      const message =
        error instanceof ApiError && typeof (error.body as { error?: string })?.error === 'string'
          ? (error.body as { error: string }).error
          : 'Failed to delete session';
      toast.error(message);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!session?.transcriptText && !session?.notes) {
      setShowWarning(true);
      return;
    }
    await doComplete();
  };

  const handleRunSynthesis = async () => {
    setIsSynthesizing(true);
    try {
      await sessionsService.synthesize(sessionId);
      mutateSession();
      toast.success('Synthesis complete');
    } catch (error) {
      if (error instanceof ApiKeyMissingError) {
        toast.error('Set your Anthropic API key in Settings to use AI features.');
      } else {
        toast.error('Failed to run synthesis');
      }
    } finally {
      setIsSynthesizing(false);
    }
  };

  const doComplete = async () => {
    setShowWarning(false);
    setIsCompleting(true);
    try {
      await sessionsService.update(sessionId, { status: 'completed' });
      mutateSession();
      toast.success('Session marked as completed');
    } catch {
      toast.error('Failed to update session status');
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          {error?.status === 404 ? 'Session not found.' : 'Failed to load session.'}
        </p>
        <Link
          href={`/clients/${clientId}/processes/${processId}/sessions`}
          className={buttonVariants({ variant: 'outline' })}
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Back to sessions
        </Link>
      </div>
    );
  }

  const status = session.status as SessionStatus;
  const canComplete = status === 'planned' || status === 'in_progress';
  const canSynthesize = status === 'completed';
  const interviewAnswers = (session.interviewAnswers as any)?.questions as
    | { question: string; answer: string }[]
    | undefined;

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/clients/${clientId}/processes/${processId}/sessions`}
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-2xl font-bold">{session.title}</h1>
          <SessionStatusBadge status={session.status} />
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">{getSessionTypeLabel(session.type)}</Badge>
          {session.date && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {session.date}
            </span>
          )}
          {session.contacts && session.contacts.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              {session.contacts.map((c: any) => c.name).join(', ')}
            </span>
          )}
        </div>

      </div>

      {/* Section Nav — underline tabs */}
      <div className="flex gap-6 border-b">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeSection === id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels — use CSS hidden to keep capture state alive across tab switches */}
      <div className={activeSection === 'preparation' ? '' : 'hidden'}>
        <PrepBriefPanel
          sessionId={sessionId}
          processId={processId}
          prepBrief={prepBrief}
          mutateSession={() => mutateSession()}
          interviewAnswers={interviewAnswers}
          questionsAsked={questionsAsked}
          onToggleQuestion={toggleQuestion}
          sessionType={session.type}
        />
      </div>

      <div className={activeSection === 'capture' ? '' : 'hidden'}>
        {session.type === 'shadowing' ? (
          <ShadowingCapturePanel
            sessionId={sessionId}
            clientId={clientId}
            processId={processId}
            sessionStatus={status}
            initialTranscript={session.transcriptText}
            initialNotes={session.notes}
            mutateSession={mutateSession}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start min-w-0">
            <div className="lg:col-span-3 space-y-6 min-w-0">
              <TranscriptNotesEditor
                sessionId={sessionId}
                initialTranscript={session.transcriptText}
                initialNotes={session.notes}
                sessionStatus={session.status}
                mutateSession={() => mutateSession()}
              />

              {canComplete && (
                <div className="flex justify-center pt-2 border-t">
                  <Button onClick={handleMarkCompleted} disabled={isCompleting}>
                    {isCompleting ? 'Updating...' : 'Mark as Completed'}
                  </Button>
                </div>
              )}
            </div>
            {prepBrief && (
              <div className="lg:col-span-2 min-w-0">
                <QuestionSidebar
                  questions={prepBrief.questionsToAsk}
                  questionsAsked={questionsAsked}
                  onToggleQuestion={toggleQuestion}
                  watchFor={prepBrief.watchFor}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={activeSection === 'results' ? '' : 'hidden'}>
        <div className="space-y-6">
          {/* Shadowing sessions: show debrief panel before synthesis */}
          {session.type === 'shadowing' && canSynthesize && !session.debriefAnswers && (
            <DebriefPanel
              sessionId={sessionId}
              processId={processId}
              onComplete={() => mutateSession()}
            />
          )}

          {/* Shadowing debrief summary badge */}
          {session.type === 'shadowing' && session.debriefAnswers && (
            <DebriefSummaryBadge answers={session.debriefAnswers as DebriefAnswers} />
          )}

          {/* Synthesis button: for non-shadowing, or shadowing with debrief done */}
          {canSynthesize && (session.type !== 'shadowing' || session.debriefAnswers) && (
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
              <MessageSquare className="size-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Ready for synthesis</p>
                <p className="text-xs text-muted-foreground">
                  Run synthesis to extract insights from the transcript and notes.
                </p>
              </div>
              <Button onClick={handleRunSynthesis} disabled={isSynthesizing} size="sm">
                {isSynthesizing ? 'Running...' : 'Run Synthesis'}
              </Button>
            </div>
          )}

          {status === 'synthesis_done' && session.synthesisOutput && (
            <>
              <SynthesisPanels
                sessionId={sessionId}
                synthesis={session.synthesisOutput as SynthesisOutput}
                mutateSession={() => mutateSession()}
              />
              {isAdmin && <EmailDraftCard sessionId={sessionId} />}
            </>
          )}

          {status !== 'completed' && status !== 'synthesis_done' && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">
                Complete the session capture first, then run synthesis to extract insights.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Warning dialog */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete without data?</DialogTitle>
            <DialogDescription>
              Both transcript and notes are empty. Are you sure you want to mark this session as completed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarning(false)}>Cancel</Button>
            <Button onClick={doComplete} disabled={isCompleting}>
              {isCompleting ? 'Completing...' : 'Complete Anyway'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete session?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{session.title}</strong>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DebriefSummaryBadge({ answers }: { answers: DebriefAnswers }) {
  const items = answers.items ?? [];
  const answered = items.filter(i => i.resolution === 'asked_answered').length;
  const described = items.filter(i => i.resolution === 'described').length;
  const open = items.filter(i => i.resolution === 'open_question').length;
  const skipped = items.filter(i => i.resolution === 'skipped').length;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
        Debrief complete
      </Badge>
      <span>{answered} answered, {described} described, {open} open, {skipped} skipped</span>
    </div>
  );
}

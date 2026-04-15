'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { sessionsService } from '@/modules/sessions/services/sessions-service';

interface TranscriptNotesEditorProps {
  sessionId: string;
  initialTranscript: string | null;
  initialNotes: string | null;
  sessionStatus: string;
  mutateSession: () => void;
}

export function TranscriptNotesEditor({
  sessionId,
  initialTranscript,
  initialNotes,
  sessionStatus,
  mutateSession,
}: TranscriptNotesEditorProps) {
  const [localTranscript, setLocalTranscript] = useState(initialTranscript ?? '');
  const [localNotes, setLocalNotes] = useState(initialNotes ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestTranscriptRef = useRef(localTranscript);
  const latestNotesRef = useRef(localNotes);
  const statusRef = useRef(sessionStatus);
  const isMountedRef = useRef(true);
  const lastSavedRef = useRef({
    transcript: initialTranscript ?? '',
    notes: initialNotes ?? '',
  });

  useEffect(() => { latestTranscriptRef.current = localTranscript; }, [localTranscript]);
  useEffect(() => { latestNotesRef.current = localNotes; }, [localNotes]);
  useEffect(() => { statusRef.current = sessionStatus; }, [sessionStatus]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Sync with server only when data changed externally
  useEffect(() => {
    const serverTranscript = initialTranscript ?? '';
    const serverNotes = initialNotes ?? '';
    if (serverTranscript !== lastSavedRef.current.transcript) {
      setLocalTranscript(serverTranscript);
      lastSavedRef.current.transcript = serverTranscript;
    }
    if (serverNotes !== lastSavedRef.current.notes) {
      setLocalNotes(serverNotes);
      lastSavedRef.current.notes = serverNotes;
    }
  }, [initialTranscript, initialNotes]);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const transcript = latestTranscriptRef.current || null;
        const notes = latestNotesRef.current || null;

        const patchBody: Record<string, unknown> = {
          transcriptText: transcript,
          notes: notes,
        };

        // Auto-transition planned → in_progress
        if (statusRef.current === 'planned') {
          patchBody.status = 'in_progress';
        }

        await sessionsService.update(sessionId, patchBody);
        if (!isMountedRef.current) return;

        lastSavedRef.current = {
          transcript: transcript ?? '',
          notes: notes ?? '',
        };

        setSaveStatus('saved');
        mutateSession();
      } catch {
        if (!isMountedRef.current) return;
        setSaveStatus('error');
      }
    }, 2000);
  }, [sessionId, mutateSession]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Transcript</Label>
          <textarea
            className="w-full min-h-[300px] mt-1 p-3 border rounded-md bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            value={localTranscript}
            onChange={(e) => { setLocalTranscript(e.target.value); scheduleSave(); }}
            placeholder="Paste or type your session transcript here..."
          />
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <textarea
            className="w-full min-h-[200px] mt-1 p-3 border rounded-md bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            value={localNotes}
            onChange={(e) => { setLocalNotes(e.target.value); scheduleSave(); }}
            placeholder="Your personal notes about this session..."
          />
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-center h-4">
        {saveStatus === 'saving' && 'Saving...'}
        {saveStatus === 'saved' && 'Saved'}
        {saveStatus === 'error' && (
          <button onClick={scheduleSave} className="text-destructive underline">
            Error saving — click to retry
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { EventLog } from '@/lib/db/schema';
import type { DebriefItem } from '@/lib/db/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

interface DebriefPanelProps {
  sessionId: string;
  processId: string;
  onComplete: () => void;
}

type Resolution = DebriefItem['resolution'];
type Priority = NonNullable<DebriefItem['priority']>;

interface AnswerState {
  resolution: Resolution;
  answer?: string;
  description?: string;
  priority?: Priority;
}

export function DebriefPanel({ sessionId, processId, onComplete }: DebriefPanelProps) {
  const [debriefEvents, setDebriefEvents] = useState<EventLog[]>([]);
  const [allEvents, setAllEvents] = useState<EventLog[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, AnswerState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  // Data loss prevention
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (answers.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [answers.size]);

  // Fetch events on mount
  useEffect(() => {
    async function load() {
      try {
        const [debriefRes, allRes] = await Promise.all([
          fetch(`/api/sessions/${sessionId}/debrief`),
          fetch(`/api/sessions/${sessionId}/events`),
        ]);

        if (!debriefRes.ok || !allRes.ok) {
          throw new Error('Failed to load events');
        }

        const debriefData: EventLog[] = await debriefRes.json();
        const allData: EventLog[] = await allRes.json();

        setAllEvents(allData);

        if (debriefData.length === 0) {
          // Auto-skip: no debrief items
          const postRes = await fetch(`/api/sessions/${sessionId}/debrief`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [] }),
          });
          if (!postRes.ok) {
            const errData = await postRes.json();
            throw new Error(errData.error ?? 'Failed to save empty debrief');
          }
          onComplete();
          return;
        }

        setDebriefEvents(debriefData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load debrief events');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId, onComplete]);

  const updateAnswer = useCallback((eventId: string, updates: Partial<AnswerState>) => {
    setAnswers(prev => {
      const next = new Map(prev);
      const current = next.get(eventId) ?? { resolution: 'skipped' as Resolution };
      next.set(eventId, { ...current, ...updates });
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const items = debriefEvents.map(event => {
        const answer = answers.get(event.id);
        const type = event.type === 'QUESTION' ? 'question' : 'implicit';
        return {
          eventLogId: event.id,
          type,
          resolution: answer?.resolution ?? 'skipped',
          ...(answer?.answer && { answer: answer.answer }),
          ...(answer?.description && { description: answer.description }),
          ...(answer?.priority && { priority: answer.priority }),
        };
      });

      const res = await fetch(`/api/sessions/${sessionId}/debrief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error ?? 'Failed to save debrief. Please try again.');
        return;
      }

      toast.success('Debrief saved successfully');
      onComplete();
    } catch {
      setError('Failed to save debrief. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading debrief items...</span>
        </CardContent>
      </Card>
    );
  }

  if (error && debriefEvents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (debriefEvents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No items to review.</p>
        </CardContent>
      </Card>
    );
  }

  // Review screen
  if (showReview) {
    const answered = Array.from(answers.values()).filter(a => a.resolution === 'asked_answered').length;
    const described = Array.from(answers.values()).filter(a => a.resolution === 'described').length;
    const openQ = Array.from(answers.values()).filter(a => a.resolution === 'open_question').length;
    const skipped = debriefEvents.length - answered - described - openQ;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Review Debrief
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            {answered > 0 && <Badge variant="outline" className="bg-emerald-50 text-emerald-700">{answered} answered</Badge>}
            {described > 0 && <Badge variant="outline" className="bg-blue-50 text-blue-700">{described} described</Badge>}
            {openQ > 0 && <Badge variant="outline" className="bg-amber-50 text-amber-700">{openQ} open questions</Badge>}
            {skipped > 0 && <Badge variant="outline">{skipped} skipped</Badge>}
          </div>

          <div className="divide-y">
            {debriefEvents.map((event, i) => {
              const answer = answers.get(event.id);
              return (
                <button
                  key={event.id}
                  className="w-full text-left py-3 px-2 hover:bg-muted/50 rounded transition-colors"
                  onClick={() => { setCurrentIndex(i); setShowReview(false); }}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{event.type}</Badge>
                    <span className="text-sm flex-1 truncate">{event.label || event.detail}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {(answer?.resolution ?? 'skipped').replace('_', ' ')}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setShowReview(false)}>
              <ArrowLeft className="size-4 mr-1.5" />
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Debrief'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sequential card view
  const event = debriefEvents[currentIndex];
  const answer = answers.get(event.id);
  const isQuestion = event.type === 'QUESTION';

  // Find previous event for context
  const eventTimestamp = new Date(event.timestamp).getTime();
  const prevEvent = allEvents
    .filter(e => new Date(e.timestamp).getTime() < eventTimestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  const isLast = currentIndex === debriefEvents.length - 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={isQuestion ? 'default' : 'secondary'}>
              {event.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            Event {currentIndex + 1} of {debriefEvents.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Event text */}
        <div className="space-y-1">
          {event.label && <p className="font-medium">{event.label}</p>}
          {event.detail && <p className="text-sm text-muted-foreground">{event.detail}</p>}
        </div>

        {/* Context */}
        {prevEvent && (
          <p className="text-xs text-muted-foreground italic">
            Logged after: {prevEvent.type} — {prevEvent.label || prevEvent.detail || 'event'}
          </p>
        )}

        {/* Resolution options */}
        <div className="space-y-3 pt-2">
          <Label className="text-sm font-medium">Resolution</Label>
          <RadioGroup
            value={answer?.resolution ?? ''}
            onValueChange={(value: string) => {
              updateAnswer(event.id, {
                resolution: value as Resolution,
                // Clear fields not relevant to new resolution
                ...(value !== 'asked_answered' && { answer: undefined }),
                ...(value !== 'described' && { description: undefined }),
                ...(value !== 'open_question' && { priority: undefined }),
              });
            }}
          >
            {isQuestion ? (
              <>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="asked_answered" id={`${event.id}-aa`} />
                  <Label htmlFor={`${event.id}-aa`}>Asked &amp; answered</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="open_question" id={`${event.id}-oq`} />
                  <Label htmlFor={`${event.id}-oq`}>Still open → open question</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skipped" id={`${event.id}-sk`} />
                  <Label htmlFor={`${event.id}-sk`}>Skip</Label>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="described" id={`${event.id}-desc`} />
                  <Label htmlFor={`${event.id}-desc`}>I can describe it</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="open_question" id={`${event.id}-oq`} />
                  <Label htmlFor={`${event.id}-oq`}>Keep as open question</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skipped" id={`${event.id}-sk`} />
                  <Label htmlFor={`${event.id}-sk`}>Skip</Label>
                </div>
              </>
            )}
          </RadioGroup>

          {/* Conditional inputs */}
          {answer?.resolution === 'asked_answered' && (
            <Textarea
              placeholder="What was the answer?"
              value={answer.answer ?? ''}
              onChange={(e) => updateAnswer(event.id, { answer: e.target.value })}
              rows={3}
            />
          )}

          {answer?.resolution === 'described' && (
            <Textarea
              placeholder="Describe what was happening..."
              value={answer.description ?? ''}
              onChange={(e) => updateAnswer(event.id, { description: e.target.value })}
              rows={3}
            />
          )}

          {answer?.resolution === 'open_question' && (
            <Select
              value={answer.priority ?? ''}
              onValueChange={(value: string | null) => value && updateAnswer(event.id, { priority: value as Priority })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="important">Important</SelectItem>
                <SelectItem value="nice_to_have">Nice to have</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex(i => i - 1)}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="size-4 mr-1.5" />
            Back
          </Button>

          {isLast ? (
            <Button onClick={() => setShowReview(true)} disabled={!answer?.resolution}>
              Review &amp; Save
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentIndex(i => i + 1)}
              disabled={!answer?.resolution}
            >
              Next
              <ArrowRight className="size-4 ml-1.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

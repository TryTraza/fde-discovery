'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

interface InterviewStepProps {
  processId: string;
  sessionType: string;
  onComplete: (answers: { question: string; answer: string }[]) => void;
  onSkip: () => void;
}

export function InterviewStep({
  processId,
  sessionType,
  onComplete,
  onSkip,
}: InterviewStepProps) {
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentContext, setCurrentContext] = useState<string | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApiKeyError, setIsApiKeyError] = useState(false);
  const [started, setStarted] = useState(false);

  const fetchQuestion = useCallback(async (index: number, prevAnswers: { question: string; answer: string }[]) => {
    setIsLoading(true);
    setError(null);
    setIsApiKeyError(false);
    try {
      const res = await fetch('/api/sessions/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId,
          sessionType,
          previousAnswers: prevAnswers,
          questionIndex: index,
        }),
      });

      if (!res.ok) {
        if (res.status === 422) {
          setError('No API key configured. Add your Anthropic API key in Settings to use AI features.');
          setIsApiKeyError(true);
          return;
        }
        if (res.status === 403) {
          setError('You need admin permissions to use AI features. Contact your administrator.');
          return;
        }
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? 'Failed to generate question');
        return;
      }

      const data = await res.json();
      if (data.done) {
        onComplete(prevAnswers);
        return;
      }

      setCurrentQuestion(data.question);
      setCurrentContext(data.context);
      setCurrentAnswer('');
    } catch {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [processId, sessionType, onComplete]);

  const handleStart = () => {
    setStarted(true);
    fetchQuestion(0, []);
  };

  const handleNextQuestion = () => {
    if (!currentQuestion || !currentAnswer.trim()) return;

    const newAnswers = [...answers, { question: currentQuestion, answer: currentAnswer.trim() }];
    setAnswers(newAnswers);
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);

    if (nextIndex >= 3) {
      onComplete(newAnswers);
    } else {
      fetchQuestion(nextIndex, newAnswers);
    }
  };

  if (!started) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Answer 3 quick questions about your goals for this session. AI will use your answers to generate a tailored prep brief with refined questions and approaches.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleStart}>Start Interview</Button>
          <Button variant="outline" onClick={onSkip}>Skip</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Question {questionIndex + 1} of 3</p>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <div className="flex gap-2">
          {isApiKeyError ? (
            <>
              <Link href="/settings" className={buttonVariants({ variant: 'default', size: 'sm' })}>
                Go to Settings
              </Link>
              <Button variant="outline" size="sm" onClick={onSkip}>
                Skip Interview
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => fetchQuestion(questionIndex, answers)}>
                Retry
              </Button>
              <Button variant="outline" size="sm" onClick={onSkip}>
                Skip Interview
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Question {questionIndex + 1} of 3</p>
      <p className="text-sm font-medium">{currentQuestion}</p>
      {currentContext && (
        <p className="text-xs text-muted-foreground">{currentContext}</p>
      )}
      <Textarea
        value={currentAnswer}
        onChange={(e) => setCurrentAnswer(e.target.value)}
        placeholder="Your answer..."
        rows={3}
      />
      <div className="flex gap-2">
        <Button
          onClick={handleNextQuestion}
          disabled={!currentAnswer.trim()}
        >
          {questionIndex >= 2 ? 'Finish' : 'Next Question'}
        </Button>
        <Button variant="outline" onClick={() => onComplete(answers)}>
          Skip Remaining
        </Button>
      </div>
    </div>
  );
}

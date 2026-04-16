'use client'

import { Badge } from '@/components/ui/badge'
import type { ProcessHypothesis } from '@/lib/ai/contracts'

interface HypothesisPanelProps {
  hypothesis: ProcessHypothesis | null | undefined
}

export function HypothesisPanel({ hypothesis }: HypothesisPanelProps) {
  if (!hypothesis) return null

  return (
    <div className="space-y-4 text-sm">
      {hypothesis.triggers.length > 0 && (
        <Section label="Triggers">
          <ul className="space-y-1.5">
            {hypothesis.triggers.map((t, i) => (
              <li key={`${t.description}-${i}`} className="flex items-start gap-2">
                <span>{t.description}</span>
                {t.frequency && (
                  <Badge variant="outline" className="mt-0.5 text-xs">
                    {t.frequency}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {hypothesis.stakeholders.length > 0 && (
        <Section label="Stakeholders">
          <ul className="space-y-1">
            {hypothesis.stakeholders.map((s, i) => (
              <li key={`${s.role}-${i}`}>
                <span className="font-medium">{s.role}</span>
                <span className="text-muted-foreground"> — {s.responsibility}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {hypothesis.expectedSystems.length > 0 && (
        <Section label="Expected systems">
          <div className="flex flex-wrap gap-1.5">
            {hypothesis.expectedSystems.map((sys, i) => (
              <Badge key={`${sys.name}-${i}`} variant="secondary" className="gap-1">
                {sys.name}
                <span className="text-muted-foreground">· {sys.confidence}</span>
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {hypothesis.assumptions.length > 0 && (
        <Section label="Assumptions">
          <ul className="space-y-2">
            {hypothesis.assumptions.map((a, i) => (
              <li key={`${a.text}-${i}`}>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {a.confidence}
                  </Badge>
                  <span>{a.text}</span>
                </div>
                {a.validationQuestion && (
                  <p className="ml-14 mt-0.5 text-xs text-muted-foreground italic">
                    Validate: {a.validationQuestion}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {hypothesis.openQuestions.length > 0 && (
        <Section label="Open questions">
          <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
            {hypothesis.openQuestions.map((q, i) => (
              <li key={`${q}-${i}`}>{q}</li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-xs text-muted-foreground">
        Generated {new Date(hypothesis.generatedAt).toLocaleString()}
      </p>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide">{label}</h4>
      {children}
    </section>
  )
}

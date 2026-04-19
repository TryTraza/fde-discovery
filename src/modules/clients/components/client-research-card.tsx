'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Bot, ChevronDown, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { CollapsibleCard } from '@/components/shared/collapsible-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientResearch } from '@/modules/clients/hooks/use-client-research'
import type { ClientResearch } from '@/modules/clients/types'

interface ClientResearchCardProps {
  clientId: string
}

export function ClientResearchCard({ clientId }: ClientResearchCardProps) {
  const { research, isLoading, isResearching, generate } = useClientResearch(clientId)

  const title = research?.researchedAt
    ? `AI Research · last run ${formatDistanceToNow(new Date(research.researchedAt), { addSuffix: true })}`
    : 'AI Research'

  const buttonLabel = isResearching
    ? 'Researching…'
    : research
      ? 'Re-research'
      : 'Research'

  return (
    <CollapsibleCard
      title={title}
      icon={Bot}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => generate()}
          disabled={isResearching}
        >
          {isResearching ? (
            <Loader2 className="mr-1 size-3.5 animate-spin text-muted-foreground/50" />
          ) : (
            <RefreshCw className="mr-1 size-3.5 text-muted-foreground/50" />
          )}
          {buttonLabel}
        </Button>
      }
    >
      {isLoading ? (
        <ResearchSkeleton />
      ) : isResearching && !research ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Researching… this can take ~1 minute.
          </p>
          <ResearchSkeleton />
        </div>
      ) : !research ? (
        <p className="text-sm text-muted-foreground">
          No research yet. Click &ldquo;Research&rdquo; to start.
        </p>
      ) : (
        <ResearchBody research={research} />
      )}
    </CollapsibleCard>
  )
}

function ResearchSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  )
}

function FitScoreBadge({ score }: { score: number }) {
  const variant: 'default' | 'secondary' | 'outline' =
    score >= 8 ? 'default' : score >= 5 ? 'secondary' : 'outline'
  return <Badge variant={variant}>Fit: {score}/10</Badge>
}

function ResearchBody({ research }: { research: ClientResearch }) {
  const hasFacts =
    !!research.sizeFinancials ||
    !!research.customersMarkets ||
    !!research.painPoints ||
    !!research.recentNews
  const hasLongTail =
    research.areasOfExpertise.length > 0 ||
    research.productsAndServices.length > 0 ||
    research.keyStakeholders.length > 0 ||
    research.techStack.length > 0 ||
    research.researchSources.length > 0

  return (
    <div className="space-y-5 text-sm">
      {/* ─ Header: fit score + overview ─────────────────────────────── */}
      {typeof research.fitScore === 'number' ? (
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
          <FitScoreBadge score={research.fitScore} />
          {research.fitScoreRationale ? (
            <span className="flex-1 text-muted-foreground">
              {research.fitScoreRationale}
            </span>
          ) : null}
        </div>
      ) : null}

      {research.companyOverview ? (
        <p className="leading-relaxed text-foreground">{research.companyOverview}</p>
      ) : null}

      {/* ─ Facts grid: 2-column definition list of one-liners ────────── */}
      {hasFacts ? (
        <>
          <Separator />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
            <Fact label="Size & financials" value={research.sizeFinancials} />
            <Fact label="Customers & markets" value={research.customersMarkets} />
            <Fact label="Pain points" value={research.painPoints} />
            <Fact label="Recent news" value={research.recentNews} />
          </dl>
        </>
      ) : null}

      {/* ─ Long-tail: lists, badges, sources ─────────────────────────── */}
      {hasLongTail ? (
        <>
          <Separator />
          <div className="space-y-4">
            {research.areasOfExpertise.length > 0 ? (
              <BadgeCloud label="Areas of expertise" values={research.areasOfExpertise} />
            ) : null}

            {research.techStack.length > 0 ? (
              <BadgeCloud label="Tech stack" values={research.techStack} />
            ) : null}

            {research.productsAndServices.length > 0 ? (
              <div>
                <SectionLabel>Products &amp; services</SectionLabel>
                <ul className="space-y-1 text-foreground">
                  {research.productsAndServices.map((p) => (
                    <li key={p.name} className="leading-snug">
                      <span className="font-medium">{p.name}</span>
                      {p.description ? (
                        <span className="text-muted-foreground"> — {p.description}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {research.keyStakeholders.length > 0 ? (
              <div>
                <SectionLabel>Key stakeholders</SectionLabel>
                <ul className="space-y-1 text-foreground">
                  {research.keyStakeholders.map((s) => (
                    <li key={`${s.name}-${s.role}`} className="leading-snug">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground"> — {s.role}</span>
                      {s.linkedinUrl ? (
                        <>
                          {' '}
                          <a
                            href={s.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                          >
                            LinkedIn
                            <ExternalLink className="size-3" />
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {research.researchSources.length > 0 ? (
              <SourcesDisclosure sources={research.researchSources} />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:pt-px">
        {label}
      </dt>
      <dd className="text-foreground leading-snug">{value}</dd>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  )
}

function BadgeCloud({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <Badge key={v} variant="outline">
            {v}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function SourcesDisclosure({ sources }: { sources: ClientResearch['researchSources'] }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            />
            Sources ({sources.length})
          </button>
        }
      />
      <CollapsibleContent className="mt-2">
        <ul className="space-y-1">
          {sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                {s.title}
                <ExternalLink className="size-3" />
              </a>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

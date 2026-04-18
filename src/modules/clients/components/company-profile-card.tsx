'use client'

import { Building2, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CollapsibleCard } from '@/components/shared/collapsible-card'
import { useCompanyProfileMutations } from '@/modules/clients/hooks/use-company-profile'
import type { CompanyProfile } from '@/modules/clients/types'

interface CompanyProfileCardProps {
  clientId: string
  profile: CompanyProfile | null | undefined
}

export function CompanyProfileCard({ clientId, profile }: CompanyProfileCardProps) {
  const { refreshProfile, isRefreshing } = useCompanyProfileMutations(clientId)

  return (
    <CollapsibleCard
      title="Company profile"
      icon={Building2}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={refreshProfile}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-1 size-3.5 text-muted-foreground/50 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing…' : profile ? 'Refresh' : 'Generate'}
        </Button>
      }
    >
      {isRefreshing && !profile ? (
        <ProfileSkeleton />
      ) : !profile ? (
        <p className="text-sm text-muted-foreground">
          No profile yet. Click &quot;Generate&quot; to produce one.
        </p>
      ) : (
        <ProfileBody profile={profile} />
      )}
    </CollapsibleCard>
  )
}

function ProfileBody({ profile }: { profile: CompanyProfile }) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <SectionLabel>Description</SectionLabel>
        <p className="text-muted-foreground">{profile.description}</p>
      </section>

      <section className="flex flex-wrap gap-2">
        <Badge variant="secondary">{profile.industry}</Badge>
        {profile.size?.stage && <Badge variant="outline">{profile.size.stage}</Badge>}
        {profile.size?.employees !== undefined && (
          <Badge variant="outline">{profile.size.employees} employees</Badge>
        )}
      </section>

      {profile.areasOfExpertise.length > 0 && (
        <section>
          <SectionLabel>Areas of expertise</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {profile.areasOfExpertise.map((area) => (
              <Badge key={area} variant="secondary">
                {area}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel>Products and services</SectionLabel>
        <ul className="space-y-1.5">
          {profile.productsAndServices.map((item) => (
            <li key={item.name}>
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground"> — {item.description}</span>
            </li>
          ))}
        </ul>
      </section>

      {profile.techStack && profile.techStack.length > 0 && (
        <section>
          <SectionLabel>Tech stack</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {profile.techStack.map((tech) => (
              <Badge key={tech} variant="outline">
                {tech}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {profile.keyStakeholders && profile.keyStakeholders.length > 0 && (
        <section>
          <SectionLabel>Key stakeholders</SectionLabel>
          <ul className="space-y-1">
            {profile.keyStakeholders.map((person) => (
              <li key={person.name}>
                <span className="font-medium">{person.name}</span>
                <span className="text-muted-foreground"> — {person.role}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.recentNews && profile.recentNews.length > 0 && (
        <section>
          <SectionLabel>Recent news</SectionLabel>
          <ul className="space-y-2">
            {profile.recentNews.map((item) => (
              <li key={item.url}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {item.title}
                </a>
                <p className="text-muted-foreground">{item.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.sources.length > 0 && (
        <section>
          <SectionLabel>Sources</SectionLabel>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {profile.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Last refreshed {new Date(profile.lastRefreshedAt).toLocaleString()}
      </p>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide">{children}</h4>
}

function ProfileSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

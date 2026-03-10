'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatusBadge } from './status-badge';
import { MapPin, Globe, Calendar } from 'lucide-react';

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    industry: string;
    status: string;
    hqLocation?: string | null;
    website?: string | null;
    createdAt: string;
  };
}

export function ClientCard({ client }: ClientCardProps) {
  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="h-full transition-colors hover:bg-muted/50 cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{client.name}</CardTitle>
            <StatusBadge status={client.status} />
          </div>
          <CardDescription>{client.industry}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {client.hqLocation && (
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              <span>{client.hqLocation}</span>
            </div>
          )}
          {client.website && (
            <div className="flex items-center gap-1.5">
              <Globe className="size-3.5" />
              <span className="truncate">{client.website}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <span>{new Date(client.createdAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

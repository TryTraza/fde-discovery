'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function useResolvedName(segments: string[]): string | null {
  // Resolve /clients/[uuid] → client name
  const isClientDetail = segments.length === 2 && segments[0] === 'clients' && UUID_RE.test(segments[1]);
  const { data } = useSWR(isClientDetail ? `/api/clients/${segments[1]}` : null);
  if (isClientDetail && data?.name) return data.name;
  return null;
}

export function BreadcrumbNav() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const resolvedName = useResolvedName(segments);

  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.flatMap((segment, i) => {
          const isLast = i === segments.length - 1;
          const href = '/' + segments.slice(0, i + 1).join('/');
          const isUuid = UUID_RE.test(segment);
          const label = isUuid && resolvedName ? resolvedName : segment.replace(/-/g, ' ');

          const items: React.ReactNode[] = [];
          if (i > 0) {
            items.push(<BreadcrumbSeparator key={`sep-${href}`} />);
          }
          items.push(
            <BreadcrumbItem key={href}>
              {isLast ? (
                <BreadcrumbPage className="capitalize">{label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={href} className="capitalize">
                  {label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
          return items;
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

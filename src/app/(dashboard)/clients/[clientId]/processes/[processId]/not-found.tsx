import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';

export default function ProcessNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-lg font-semibold">Process Not Found</h2>
      <p className="text-sm text-muted-foreground">
        The process you're looking for doesn't exist or has been deleted.
      </p>
      <Link href="/clients" className={buttonVariants({ variant: 'outline' })}>
        Back to Clients
      </Link>
    </div>
  );
}

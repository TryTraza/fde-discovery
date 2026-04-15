import { buttonVariants } from '@/components/ui/button-variants'
import Link from 'next/link'

export default function ClientNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-lg font-semibold">Client Not Found</h2>
      <p className="text-sm text-muted-foreground">
        The client you're looking for doesn't exist or has been deleted.
      </p>
      <Link href="/clients" className={buttonVariants({ variant: 'outline' })}>
        Back to Clients
      </Link>
    </div>
  )
}

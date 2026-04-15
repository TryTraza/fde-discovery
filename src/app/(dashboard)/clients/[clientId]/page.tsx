import { ClientOverview } from '@/components/clients/client-overview'

export default async function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return <ClientOverview clientId={clientId} />
}

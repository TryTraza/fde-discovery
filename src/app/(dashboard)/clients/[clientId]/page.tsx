import { ClientOverview } from '@/modules/clients/components/client-overview'

export default async function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return <ClientOverview clientId={clientId} />
}

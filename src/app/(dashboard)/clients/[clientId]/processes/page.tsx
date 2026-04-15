import { ProcessesList } from '@/modules/processes/components/processes-list'

export default async function ProcessesPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return <ProcessesList clientId={clientId} />
}

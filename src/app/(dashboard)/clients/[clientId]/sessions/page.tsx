import { SessionsListPage } from '@/modules/sessions/components/sessions-list-page'

export default async function ClientSessionsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  return <SessionsListPage clientId={clientId} />
}

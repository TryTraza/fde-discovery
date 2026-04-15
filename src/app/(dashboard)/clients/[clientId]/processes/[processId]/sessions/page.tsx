import { SessionsListPage } from '@/modules/sessions/components/sessions-list-page'

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ clientId: string; processId: string }>
}) {
  const { clientId, processId } = await params
  return <SessionsListPage clientId={clientId} processId={processId} />
}

import { SessionOverview } from '@/modules/sessions/components/session-overview'

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; processId: string; sessionId: string }>
}) {
  const { clientId, processId, sessionId } = await params
  return <SessionOverview clientId={clientId} processId={processId} sessionId={sessionId} />
}

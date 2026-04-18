import { SessionOverview } from '@/modules/sessions/components/session-overview'

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; sessionId: string }>
}) {
  const { clientId, sessionId } = await params
  return <SessionOverview clientId={clientId} sessionId={sessionId} />
}

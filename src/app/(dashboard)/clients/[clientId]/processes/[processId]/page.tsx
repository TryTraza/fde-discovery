import { ProcessOverview } from '@/components/processes/process-overview';

export default async function ProcessDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; processId: string }>;
}) {
  const { clientId, processId } = await params;
  return <ProcessOverview clientId={clientId} processId={processId} />;
}

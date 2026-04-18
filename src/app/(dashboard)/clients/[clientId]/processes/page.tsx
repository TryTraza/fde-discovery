import ProcessesContent from './processes-content'

export default async function ProcessesPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return <ProcessesContent clientId={clientId} />
}

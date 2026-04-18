import { ClientList } from '@/modules/clients/components/client-list'

export default function ClientsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Clients</h1>
      <ClientList />
    </div>
  )
}

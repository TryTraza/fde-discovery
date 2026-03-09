import { ApiKeyBanner } from '@/components/shared/api-key-banner';

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <ApiKeyBanner />
      <div>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="mt-2 text-muted-foreground">
          Client management will be built in Phase 2.
        </p>
      </div>
    </div>
  );
}

import { SyncPanel } from "@/components/sync-panel";
import { getDashboardMetrics, getSyncState } from "@/lib/queries";

export default async function Home() {
  const [metrics, syncState] = await Promise.all([
    getDashboardMetrics(),
    getSyncState(),
  ]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <SyncPanel syncState={syncState} metrics={metrics} />
      </div>
    </section>
  );
}

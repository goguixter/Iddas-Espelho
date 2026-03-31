import { SyncPanel } from "@/components/sync-panel";
import {
  getDashboardMetrics,
  getSyncState,
} from "@/lib/queries";

export default async function Home() {
  const [metrics, syncState] = await Promise.all([
    getDashboardMetrics(),
    getSyncState(),
  ]);

  return (
    <section>
      <div className="mb-6 flex items-start justify-between gap-6">
        <div className="space-y-2">
          <span className="inline-flex rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
            Espelho IDDAS
          </span>
          <h1 className="max-w-3xl text-2xl font-semibold tracking-[-0.04em] text-[var(--color-ink)] xl:text-3xl">
            Dashboard local de sincronização e espelhamento.
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
            O sistema consulta a API do IDDAS, detalha orçamentos, espelha pessoas,
            importa solicitações e vincula vendas pelo identificador do orçamento.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Orçamentos"
          value={metrics.orcamentos.toString()}
          hint="Itens espelhados localmente"
        />
        <MetricCard
          label="Pessoas"
          value={metrics.pessoas.toString()}
          hint="Clientes e passageiros únicos"
        />
        <MetricCard
          label="Solicitações"
          value={metrics.solicitacoes.toString()}
          hint="Solicitações importadas no espelho"
        />
        <MetricCard
          label="Vendas"
          value={metrics.vendas.toString()}
          hint="Vendas já localizadas e vinculadas"
        />
      </div>

      <div className="mt-5">
        <SyncPanel syncState={syncState} />
      </div>
    </section>
  );
}

function MetricCard({
  hint,
  label,
  value,
}: {
  hint: string;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[22px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <p className="text-sm font-medium text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{value}</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-faint)]">
        {hint}
      </p>
    </article>
  );
}

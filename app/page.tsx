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
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <div className="rounded-[28px] border border-white/50 bg-[var(--color-surface)] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="mb-8 flex items-start justify-between gap-6">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
                Espelho IDDAS
              </span>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
                Orquestração local de orçamentos, pessoas e vendas com sync
                manual e monitoramento em tempo real.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
                O sistema consulta a API do IDDAS, detalha cada orçamento,
                espelha cliente e passageiros pelo endpoint de pessoa e tenta
                vincular a venda pelo identificador do orçamento.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
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
              label="Vendas"
              value={metrics.vendas.toString()}
              hint="Vendas já localizadas e vinculadas"
            />
          </div>
        </div>

        <SyncPanel syncState={syncState} />
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
    <article className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <p className="text-sm font-medium text-[var(--color-muted)]">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{value}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--color-faint)]">
        {hint}
      </p>
    </article>
  );
}

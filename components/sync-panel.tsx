"use client";

import { CalendarDays, RefreshCw, RotateCcw, Square } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  formatIsoDateToDisplay,
  getIddasCotacaoRange,
} from "@/lib/iddas/date-range";
import {
  translateSyncStatus,
  type SyncDashboardState,
  type SyncScope,
  type SyncStateRecord,
} from "@/lib/sync/types";

type DashboardMetrics = {
  orcamentos: number;
  pessoas: number;
  solicitacoes: number;
  vendas: number;
};

export function SyncPanel({
  metrics,
  syncState,
}: {
  metrics: DashboardMetrics;
  syncState: SyncDashboardState;
}) {
  const [state, setState] = useState<SyncDashboardState>(syncState);
  const [pendingScope, setPendingScope] = useState<SyncScope | null>(null);
  const [cancellingScope, setCancellingScope] = useState<SyncScope | null>(null);
  const [resettingScope, setResettingScope] = useState<SyncScope | null>(null);
  const defaultRange = getIddasCotacaoRange(30);
  const [periodoInicio, setPeriodoInicio] = useState(
    defaultRange.periodo_cotacao_inicio,
  );
  const [periodoFinal, setPeriodoFinal] = useState(
    defaultRange.periodo_cotacao_final,
  );

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function refreshState() {
      try {
        const response = await fetch("/api/sync", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const nextState = (await response.json()) as SyncDashboardState;
        if (cancelled) {
          return;
        }

        setState(nextState);
        const hasRunningScope = Object.values(nextState).some(
          (scopeState) => scopeState.status === "running",
        );

        if (hasRunningScope) {
          timer = window.setTimeout(refreshState, 1000);
        }
      } catch {
        return;
      }
    }

    void refreshState();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [
    state.orcamentos.status,
    state.solicitacoes.status,
    state.pessoas.status,
    state.vendas.status,
  ]);

  async function handleSync(
    scope: Extract<SyncScope, "orcamentos" | "solicitacoes" | "pessoas" | "vendas">,
  ) {
    setPendingScope(scope);

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          scope === "orcamentos"
            ? {
                scope,
                periodo_cotacao_final: periodoFinal,
                periodo_cotacao_inicio: periodoInicio,
              }
            : { scope },
        ),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Falha ao sincronizar.");
      }

      setState((await response.json()) as SyncDashboardState);
    } catch (err) {
      setState((current) => ({
        ...current,
        [scope]: {
          ...current[scope],
          error: err instanceof Error ? err.message : "Falha ao sincronizar.",
        },
      }));
    } finally {
      setPendingScope(null);
    }
  }

  async function handleCancel(
    scope: Extract<SyncScope, "orcamentos" | "solicitacoes" | "pessoas" | "vendas">,
  ) {
    setCancellingScope(scope);

    try {
      const response = await fetch("/api/sync", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scope }),
      });
      if (!response.ok) {
        return;
      }

      const nextScopeState = (await response.json()) as SyncStateRecord;
      setState((current) => ({ ...current, [scope]: nextScopeState }));
    } catch {
      return;
    } finally {
      setCancellingScope(null);
    }
  }

  async function handleReset(
    scope: Extract<SyncScope, "orcamentos" | "solicitacoes" | "pessoas" | "vendas">,
  ) {
    setResettingScope(scope);

    try {
      const response = await fetch("/api/sync", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scope }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Falha ao resetar.");
      }

      const nextScopeState = (await response.json()) as SyncStateRecord;
      setState((current) => ({ ...current, [scope]: nextScopeState }));
    } catch (err) {
      setState((current) => ({
        ...current,
        [scope]: {
          ...current[scope],
          error: err instanceof Error ? err.message : "Falha ao resetar.",
        },
      }));
    } finally {
      setResettingScope(null);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
            Espelho IDDAS
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.04em] text-[var(--color-ink)] xl:text-2xl">
            Dashboard de sincronização
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--color-muted)]">
            Visão consolidada do espelho local, filas derivadas e vínculos entre
            orçamentos, pessoas, solicitações e vendas.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <CompactDateField label="Início" value={periodoInicio} onChange={setPeriodoInicio} />
          <CompactDateField label="Fim" value={periodoFinal} onChange={setPeriodoFinal} />
        </div>
      </div>

      <div className="grid h-full min-h-0 flex-1 auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SyncScopeCard
          state={state.orcamentos}
          title="Orçamentos"
          total={metrics.orcamentos}
          totalLabel="espelhados"
          primaryLabel="Orçamentos processados"
          primaryCreatedLabel="Orçamentos novos"
          pending={pendingScope === "orcamentos"}
          cancelling={cancellingScope === "orcamentos"}
          resetting={resettingScope === "orcamentos"}
          onCancel={() => void handleCancel("orcamentos")}
          onReset={() => void handleReset("orcamentos")}
          onSync={() => void handleSync("orcamentos")}
        />

        <SyncScopeCard
          state={state.solicitacoes}
          title="Solicitações"
          total={metrics.solicitacoes}
          totalLabel="importadas"
          primaryLabel="Solicitações processadas"
          primaryCreatedLabel="Solicitações novas"
          pending={pendingScope === "solicitacoes"}
          cancelling={cancellingScope === "solicitacoes"}
          resetting={resettingScope === "solicitacoes"}
          onCancel={() => void handleCancel("solicitacoes")}
          onReset={() => void handleReset("solicitacoes")}
          onSync={() => void handleSync("solicitacoes")}
        />

        <SyncScopeCard
          state={state.pessoas}
          title="Pessoas"
          total={metrics.pessoas}
          totalLabel="consolidadas"
          primaryLabel="Pessoas processadas"
          primaryCreatedLabel="Pessoas novas"
          pending={pendingScope === "pessoas"}
          cancelling={cancellingScope === "pessoas"}
          resetting={resettingScope === "pessoas"}
          onCancel={() => void handleCancel("pessoas")}
          onReset={() => void handleReset("pessoas")}
          onSync={() => void handleSync("pessoas")}
        />

        <SyncScopeCard
          state={state.vendas}
          title="Vendas"
          total={metrics.vendas}
          totalLabel="vinculadas"
          primaryLabel="Vendas processadas"
          primaryCreatedLabel="Vendas novas"
          pending={pendingScope === "vendas"}
          cancelling={cancellingScope === "vendas"}
          resetting={resettingScope === "vendas"}
          onCancel={() => void handleCancel("vendas")}
          onReset={() => void handleReset("vendas")}
          onSync={() => void handleSync("vendas")}
        />
      </div>
    </section>
  );
}

function SyncScopeCard({
  state,
  title,
  total,
  totalLabel,
  primaryLabel,
  primaryCreatedLabel,
  relatedLabel,
  relatedCreatedLabel,
  secondaryLabel,
  secondaryCreatedLabel,
  pending,
  cancelling,
  resetting,
  onCancel,
  onReset,
  onSync,
}: {
  state: SyncStateRecord;
  title: string;
  total: number;
  totalLabel: string;
  primaryLabel: string;
  primaryCreatedLabel: string;
  relatedLabel?: string;
  relatedCreatedLabel?: string;
  secondaryLabel?: string;
  secondaryCreatedLabel?: string;
  pending: boolean;
  cancelling: boolean;
  resetting: boolean;
  onCancel: () => void;
  onReset: () => void;
  onSync: () => void;
}) {
  const running = state.status === "running";

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[22px] border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
            {title}
          </p>
          <div className="mt-1.5 flex items-end gap-2">
            <p className="text-2xl font-semibold tracking-[-0.05em] text-[var(--color-ink)]">
              {total}
            </p>
            <p className="pb-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--color-faint)]">
              {totalLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            {translateSyncStatus(state.status)}
          </span>
        </div>
      </div>

      <div className="mt-3 grid shrink-0 gap-2 md:grid-cols-2">
        <MetricTile label={primaryLabel} value={String(state.items_synced)} />
        <MetricTile label={primaryCreatedLabel} value={String(state.items_created)} />
        <MetricTile label="Detalhados" value={String(state.details_synced)} />
        <MetricTile label="Ignorados" value={String(state.items_skipped)} />
        <MetricTile label="Pendentes" value={String(state.queue_pending)} />
        <MetricTile label="Reconciliados" value={String(state.reconciled_synced)} />
        {relatedLabel ? (
          <MetricTile label={relatedLabel} value={String(state.related_synced)} />
        ) : null}
        {relatedCreatedLabel ? (
          <MetricTile label={relatedCreatedLabel} value={String(state.related_created)} />
        ) : null}
        {secondaryLabel ? (
          <MetricTile label={secondaryLabel} value={String(state.secondary_synced)} />
        ) : null}
        {secondaryCreatedLabel ? (
          <MetricTile
            label={secondaryCreatedLabel}
            value={String(state.secondary_created)}
          />
        ) : null}
      </div>

      <div className="mt-3 min-h-0 flex-1 rounded-[18px] border border-[var(--color-line)] bg-[var(--color-panel)] p-2.5">
        <div className="space-y-1.5 text-[13px]">
          <SyncLine label="Etapa atual" value={state.current_stage} />
          <SyncLine
            label="Página atual"
            value={state.current_page ? String(state.current_page) : null}
          />
          <SyncLine label="Próxima página" value={String(state.next_page)} />
          <SyncLine label="Item atual" value={state.current_item_id} />
          <SyncLine
            label="Última execução"
            value={formatLastExecution(state.last_synced_at)}
          />
        </div>
      </div>

      {state.error ? <p className="mt-3 text-[12px] text-rose-600">{state.error}</p> : null}

      <div className="mt-3 shrink-0 space-y-2">
        <button
          type="button"
          onClick={onSync}
          disabled={pending || running}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3 py-2 text-[12px] font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending || running ? "animate-spin" : ""}`} />
          {running ? "Sincronizando" : "Sincronizar agora"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={!running || cancelling}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            {cancelling ? "Parando" : "Parar Sync"}
          </button>

          <button
            type="button"
            onClick={onReset}
            disabled={running || resetting}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--color-ink)] transition hover:bg-white/3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} />
            {resetting ? "Resetando" : "Resetar Sync"}
          </button>
        </div>
      </div>
    </section>
  );
}

function SyncLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-[var(--color-muted)]">{label}</span>
      <span className="text-[12px] font-medium text-[var(--color-ink)]">
        {value ?? "Ainda não executado"}
      </span>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-faint)]">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
        {value}
      </p>
    </div>
  );
}

function formatLastExecution(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function CompactDateField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const inputId = useId();
  const dateRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (dateRef.current?.showPicker) {
      dateRef.current.showPicker();
      return;
    }

    dateRef.current?.click();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        className="flex min-w-[172px] items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-left text-[11px] font-medium text-[var(--color-ink)]"
      >
        <span className="truncate">
          <span className="mr-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-faint)]">
            {label}
          </span>
          <span>{formatIsoDateToDisplay(value)}</span>
        </span>
        <CalendarDays className="h-3.5 w-3.5 text-[var(--color-muted)]" />
      </button>
      <input
        id={inputId}
        ref={dateRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute inset-0 opacity-0"
        tabIndex={-1}
      />
    </div>
  );
}

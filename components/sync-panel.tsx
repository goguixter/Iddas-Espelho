"use client";

import { CalendarDays, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
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

export function SyncPanel({ syncState }: { syncState: SyncDashboardState }) {
  const [state, setState] = useState<SyncDashboardState>(syncState);
  const [pendingScope, setPendingScope] = useState<SyncScope | null>(null);
  const [cancellingScope, setCancellingScope] = useState<SyncScope | null>(null);
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
  }, [state.orcamentos.status, state.solicitacoes.status]);

  async function handleSync(scope: Extract<SyncScope, "orcamentos" | "solicitacoes">) {
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

  async function handleCancel(scope: Extract<SyncScope, "orcamentos" | "solicitacoes">) {
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

  return (
    <section>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          Status do sync
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.04em]">
          Jobs por entidade
        </h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SyncScopeCard
          state={state.orcamentos}
          title="Orçamentos"
          description="Situações, orçamentos, pessoas e vendas"
          primaryLabel="Orçamentos processados"
          primaryCreatedLabel="Orçamentos novos"
          relatedLabel="Pessoas processadas"
          relatedCreatedLabel="Pessoas novas"
          secondaryLabel="Vendas processadas"
          secondaryCreatedLabel="Vendas novas"
          pending={pendingScope === "orcamentos"}
          cancelling={cancellingScope === "orcamentos"}
          onCancel={() => void handleCancel("orcamentos")}
          onSync={() => void handleSync("orcamentos")}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <DateField
              label="Data inicial"
              value={periodoInicio}
              onChange={setPeriodoInicio}
            />
            <DateField
              label="Data final"
              value={periodoFinal}
              onChange={setPeriodoFinal}
            />
          </div>
        </SyncScopeCard>

        <SyncScopeCard
          state={state.solicitacoes}
          title="Solicitações"
          description="Fila de solicitações e preparação de vínculo"
          primaryLabel="Solicitações processadas"
          primaryCreatedLabel="Solicitações novas"
          pending={pendingScope === "solicitacoes"}
          cancelling={cancellingScope === "solicitacoes"}
          onCancel={() => void handleCancel("solicitacoes")}
          onSync={() => void handleSync("solicitacoes")}
        />
      </div>
    </section>
  );
}

function SyncScopeCard({
  state,
  title,
  description,
  primaryLabel,
  primaryCreatedLabel,
  relatedLabel,
  relatedCreatedLabel,
  secondaryLabel,
  secondaryCreatedLabel,
  pending,
  cancelling,
  onCancel,
  onSync,
  children,
}: {
  state: SyncStateRecord;
  title: string;
  description: string;
  primaryLabel: string;
  primaryCreatedLabel: string;
  relatedLabel?: string;
  relatedCreatedLabel?: string;
  secondaryLabel?: string;
  secondaryCreatedLabel?: string;
  pending: boolean;
  cancelling: boolean;
  onCancel: () => void;
  onSync: () => void;
  children?: ReactNode;
}) {
  const running = state.status === "running";

  return (
    <section className="rounded-[22px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{description}</p>
        </div>
        <span className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
          {translateSyncStatus(state.status)}
        </span>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}

      <div className="mt-4 space-y-2 text-sm">
        <SyncLine label="Etapa atual" value={state.current_stage} />
        <SyncLine
          label="Página atual"
          value={state.current_page ? String(state.current_page) : null}
        />
        <SyncLine label="Próxima página" value={String(state.next_page)} />
        <SyncLine label="Item atual" value={state.current_item_id} />
        <SyncLine label="Última execução" value={state.last_synced_at} />
        <SyncLine label={primaryLabel} value={String(state.items_synced)} />
        <SyncLine label={primaryCreatedLabel} value={String(state.items_created)} />
        {relatedLabel ? (
          <SyncLine label={relatedLabel} value={String(state.related_synced)} />
        ) : null}
        {relatedCreatedLabel ? (
          <SyncLine
            label={relatedCreatedLabel}
            value={String(state.related_created)}
          />
        ) : null}
        {secondaryLabel ? (
          <SyncLine label={secondaryLabel} value={String(state.secondary_synced)} />
        ) : null}
        {secondaryCreatedLabel ? (
          <SyncLine
            label={secondaryCreatedLabel}
            value={String(state.secondary_created)}
          />
        ) : null}
      </div>

      {state.error ? <p className="mt-4 text-sm text-rose-600">{state.error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSync}
          disabled={pending || running}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${pending || running ? "animate-spin" : ""}`} />
          {running ? "Sincronizando" : "Sincronizar agora"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={!running || cancelling}
          className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cancelling ? "Parando" : "Parar sync"}
        </button>
      </div>
    </section>
  );
}

function SyncLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-medium text-[var(--color-ink)]">
        {value ?? "Ainda não executado"}
      </span>
    </div>
  );
}

function DateField({
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
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]"
      >
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={openPicker}
          className="flex w-full items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-left text-sm font-medium text-[var(--color-ink)]"
        >
          <span>{formatIsoDateToDisplay(value)}</span>
          <CalendarDays className="h-4 w-4 text-[var(--color-muted)]" />
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
    </div>
  );
}

"use client";

import { CalendarDays, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  formatIsoDateToDisplay,
  getIddasCotacaoRange,
} from "@/lib/iddas/date-range";
import {
  translateSyncStatus,
  type SyncStateRecord,
} from "@/lib/sync/types";

export function SyncPanel({ syncState }: { syncState: SyncStateRecord }) {
  const [state, setState] = useState<SyncStateRecord>(syncState);
  const [pending, setPending] = useState(false);
  const defaultRange = getIddasCotacaoRange(30);
  const [periodoInicio, setPeriodoInicio] = useState(defaultRange.periodo_cotacao_inicio);
  const [periodoFinal, setPeriodoFinal] = useState(defaultRange.periodo_cotacao_final);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function refreshState() {
      try {
        const response = await fetch("/api/sync", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const nextState = (await response.json()) as SyncStateRecord;
        if (!cancelled) {
          setState(nextState);

          if (nextState.status === "running") {
            timer = window.setTimeout(refreshState, 1000);
          }
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
  }, [state.status]);

  async function handleSync() {
    setPending(true);

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodo_cotacao_final: periodoFinal,
          periodo_cotacao_inicio: periodoInicio,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Falha ao sincronizar.");
      }

      setState((await response.json()) as SyncStateRecord);
    } catch (err) {
      setState((current) => ({
        ...current,
        error: err instanceof Error ? err.message : "Falha ao sincronizar.",
      }));
    } finally {
      setPending(false);
    }
  }

  async function handleCancel() {
    try {
      const response = await fetch("/api/sync", { method: "DELETE" });
      if (!response.ok) {
        return;
      }

      setState((await response.json()) as SyncStateRecord);
    } catch {
      return;
    }
  }

  const running = state.status === "running";

  return (
    <aside className="rounded-[28px] border border-white/50 bg-[var(--color-surface)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
        Status do sync
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
        Espelho incremental
      </h2>
      <div className="mt-6 space-y-4 rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
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
        <SyncLine label="Status" value={translateSyncStatus(state.status)} />
        <SyncLine label="Etapa atual" value={state.current_stage} />
        <SyncLine
          label="Página atual"
          value={state.current_page ? String(state.current_page) : null}
        />
        <SyncLine
          label="Próxima página"
          value={String(state.next_orcamento_page)}
        />
        <SyncLine label="Item atual" value={state.current_item_id} />
        <SyncLine label="Última execução" value={state.last_synced_at} />
        <SyncLine
          label="Orçamentos processados"
          value={String(state.orcamentos_synced)}
        />
        <SyncLine
          label="Orçamentos novos"
          value={String(state.orcamentos_created)}
        />
        <SyncLine
          label="Pessoas processadas"
          value={String(state.people_synced)}
        />
        <SyncLine
          label="Pessoas novas"
          value={String(state.people_created)}
        />
        <SyncLine
          label="Vendas vinculadas"
          value={String(state.vendas_synced)}
        />
        <SyncLine
          label="Vendas novas"
          value={String(state.vendas_created)}
        />
      </div>

      {state.error ? <p className="mt-4 text-sm text-rose-600">{state.error}</p> : null}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleSync}
          disabled={pending || running}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${pending || running ? "animate-spin" : ""}`} />
          {running ? "Sincronizando" : "Sincronizar agora"}
        </button>

        <button
          type="button"
          onClick={handleCancel}
          disabled={!running}
          className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Parar sync
        </button>
      </div>
    </aside>
  );
}

function SyncLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
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

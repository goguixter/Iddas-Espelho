"use client";

import { FormEvent, useEffect, useState } from "react";

type ImportStatus = {
  currentExists: boolean;
  currentSizeBytes: number;
  pendingExists: boolean;
  pendingSizeBytes: number;
};

export function SqliteImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    const response = await fetch("/api/admin/sqlite-import", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as ImportStatus;
    setStatus(payload);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Selecione o arquivo .sqlite gerado no backup.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/admin/sqlite-import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      } & ImportStatus;

      if (!response.ok) {
        setError(payload.error ?? "Falha ao enviar a base.");
        return;
      }

      setMessage(payload.message ?? "Base enviada com sucesso.");
      setStatus({
        currentExists: payload.currentExists,
        currentSizeBytes: payload.currentSizeBytes,
        pendingExists: payload.pendingExists,
        pendingSizeBytes: payload.pendingSizeBytes,
      });
      setFile(null);
    } catch {
      setError("Falha ao enviar a base.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="max-w-3xl rounded-[32px] border border-white/10 bg-[rgba(15,23,42,0.82)] p-8 shadow-[0_32px_120px_rgba(15,23,42,0.45)] backdrop-blur">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Importar base SQLite</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        Envie o arquivo de backup `.sqlite`. O sistema vai gravar a base no volume do Railway e
        aplicar a troca na próxima reinicialização do serviço.
      </p>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--color-muted)]">
        <p>Base atual no volume: {formatPresence(status?.currentExists, status?.currentSizeBytes)}</p>
        <p className="mt-2">
          Importação pendente: {formatPresence(status?.pendingExists, status?.pendingSizeBytes)}
        </p>
      </div>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2 text-sm text-[var(--color-muted)]">
          Arquivo `.sqlite`
          <input
            type="file"
            accept=".sqlite,.db,application/vnd.sqlite3,application/x-sqlite3"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
            disabled={submitting}
          />
        </label>

        {error ? (
          <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!file || submitting}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Enviando..." : "Enviar base"}
        </button>
      </form>

      <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-50">
        Depois do upload, reinicie o serviço `Iddas-Espelho` no Railway para aplicar a base
        importada.
      </div>
    </section>
  );
}

function formatPresence(exists: boolean | undefined, sizeBytes: number | undefined) {
  if (!exists) {
    return "não";
  }

  return `sim (${formatBytes(sizeBytes ?? 0)})`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

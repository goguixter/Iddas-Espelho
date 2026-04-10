const STATUS_STYLES: Record<string, string> = {
  canceled: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  closed: "border-zinc-400/30 bg-zinc-400/10 text-zinc-200",
  created: "border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted)]",
  deleted: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  processing: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  refused: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  running: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  sent: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  signed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
};

const STATUS_LABELS: Record<string, string> = {
  canceled: "Cancelado",
  closed: "Fechado",
  created: "Criado aguardando envio",
  deleted: "Documento excluído",
  failed: "Falhou",
  processing: "Processando",
  refused: "Recusado",
  running: "Em assinatura",
  sent: "Enviado",
  signed: "Assinado",
};

export function DocumentSignatureStatusBadge({
  label = "Status",
  status,
}: {
  label?: string;
  status: string | null | undefined;
}) {
  const normalized = ((status ?? "").trim().toLowerCase() || "created");
  const value = STATUS_LABELS[normalized] ?? toLabel(normalized);
  const style =
    STATUS_STYLES[normalized] ??
    "border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted)]";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1">
      <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-faint)]">
        {label}
      </span>
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${style}`}
      >
        {value}
      </span>
    </div>
  );
}

function toLabel(value: string) {
  return value.replace(/[_-]+/g, " ");
}

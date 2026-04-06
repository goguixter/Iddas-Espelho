"use client";

import { Clock3, X } from "lucide-react";
import { useState } from "react";
import type { DocumentSignatureTimelineItem } from "@/lib/documents/types";

const EVENT_LABELS: Record<string, string> = {
  add_signer: "Signatário adicionado",
  auto_close: "Fechamento automático",
  cancel: "Documento cancelado",
  close: "Documento fechado",
  custom: "Evento customizado",
  deadline: "Prazo atingido",
  document_created: "Contrato gerado",
  document_closed: "Documento concluído",
  refusal: "Assinatura recusada",
  sign: "Documento assinado",
  signature_started: "Assinatura iniciada",
  update_auto_close: "Auto close atualizado",
  update_deadline: "Prazo atualizado",
  update_locale: "Idioma atualizado",
  upload: "Documento enviado",
};

const ROLE_LABELS: Record<string, string> = {
  contractee: "Contratada",
  contractor: "Contratante",
  system: "Sistema",
};

export function DocumentSignatureTimelineModal({
  title = "Timeline",
  timeline,
}: {
  title?: string;
  timeline: DocumentSignatureTimelineItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        <Clock3 className="h-4 w-4" />
        Ver timeline
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.4)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
                  Assinatura
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
                  {title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 max-h-[65vh] overflow-auto pr-1">
              {timeline.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-6 text-sm text-[var(--color-muted)]">
                  Nenhum evento de assinatura foi recebido ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {timeline.map((item, index) => (
                    <article
                      key={`${item.eventName}-${item.occurredAt ?? "sem-data"}-${item.actorName ?? index}`}
                      className="rounded-[20px] border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-ink)]">
                            {EVENT_LABELS[item.eventName] ?? item.eventName.replace(/[_-]+/g, " ")}
                          </p>
                          {item.actorName || item.actorRole ? (
                            <p className="mt-1 text-sm text-[var(--color-muted)]">
                              {[item.actorName, formatRoleLabel(item.actorRole)]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-faint)]">
                          {item.occurredAt ? formatTimelineDateTime(item.occurredAt) : "Sem data"}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatTimelineDateTime(input: string) {
  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return input;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatRoleLabel(role: string | null) {
  if (!role) {
    return null;
  }

  return ROLE_LABELS[role] ?? role;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { DocumentSignatureStatusBadge } from "@/components/document-signature-status-badge";
import { DocumentSignatureTimelineModal } from "@/components/document-signature-timeline-modal";
import { buildDocumentSignatureSummary } from "@/lib/clicksign/presentation";
import { formatDateShort } from "@/lib/documents/formatters";
import type { DocumentHistoryRecord } from "@/lib/documents/types";

export function DocumentHistoryList({ documents }: { documents: DocumentHistoryRecord[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentHistoryRecord | null>(null);

  async function handleDelete(id: number) {
    setDeletingId(id);

    try {
      const response = await fetch(`/api/documentos/${id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error("Não foi possível excluir o documento.");
      }

      router.refresh();
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-6 text-sm text-[var(--color-muted)]">
        Nenhum documento foi gerado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((document) => (
        (() => {
          const summary = buildDocumentSignatureSummary(
            document.created_at,
            document.signatureSignersJson,
            document.signatureRawResponseJson,
            document.signatureStatus,
          );
          const signedNames = summary.signers.filter((item) => item.signed).map((item) => item.name);

          return (
            <article
              key={document.id}
              className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4 transition hover:border-[var(--color-accent)]/35"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-faint)]">
                      {document.template_key}
                    </p>
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-[var(--color-ink)]">
                    {document.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <DocumentSignatureStatusBadge
                      label="Status do documento"
                      status={summary.status}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--color-muted)]">
                    <p>Orçamento {document.entity_id}</p>
                    <p>Gerado em {formatDateShort(document.created_at)}</p>
                    {document.signatureSignedAt ? (
                      <p>Assinado em {formatDateShort(document.signatureSignedAt)}</p>
                    ) : null}
                  </div>
                  <div className="mt-3 text-sm text-[var(--color-muted)]">
                    {signedNames.length > 0 ? (
                      <p>
                        Assinaram: <span className="text-[var(--color-ink)]">{signedNames.join(", ")}</span>
                      </p>
                    ) : (
                      <p>Nenhuma assinatura concluída até o momento.</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start">
                  <DocumentSignatureTimelineModal
                    title={`Timeline de ${document.title}`}
                    timeline={summary.timeline}
                  />
                  <button
                    type="button"
                    onClick={() => setPendingDelete(document)}
                    disabled={deletingId === document.id}
                    className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-rose-500/8 text-rose-200 transition hover:bg-rose-500/14 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                  <Link
                    href={`/documentos/${document.id}`}
                    className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-[var(--color-accent)]/8 text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/14 hover:text-[var(--color-accent)]"
                  >
                    <ExternalLink className="h-4.5 w-4.5" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })()
      ))}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.4)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-300">
              Excluir documento
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
              Confirmar exclusão
            </h3>
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              O documento <span className="font-medium text-[var(--color-ink)]">{pendingDelete.title}</span> será removido do histórico.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(pendingDelete.id)}
                disabled={deletingId === pendingDelete.id}
                className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === pendingDelete.id ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

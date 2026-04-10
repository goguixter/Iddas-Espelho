"use client";

import { useRouter } from "next/navigation";
import { FileSignature, LoaderCircle, OctagonX, Trash2 } from "lucide-react";
import { useState } from "react";

function resolveErrorMessage(
  payload: { details?: string[]; error?: string; statusCode?: number } | null,
  fallback: string,
) {
  const detail = payload?.details?.find((value) => typeof value === "string" && value.trim());
  const message = detail ?? payload?.error ?? fallback;

  if (payload?.statusCode && !message.includes(String(payload.statusCode))) {
    return `${payload.statusCode}: ${message}`;
  }

  return message;
}

export function DocumentSignatureActions({
  canCancel = false,
  canDeleteDocument = false,
  canSend = true,
  compact = false,
  documentId,
  initialError,
}: {
  canCancel?: boolean;
  canDeleteDocument?: boolean;
  canSend?: boolean;
  compact?: boolean;
  documentId: number;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<"cancel" | "delete" | "send" | null>(null);
  const [error, setError] = useState(initialError ?? "");

  async function handleAction(
    action: "cancel" | "delete" | "send",
    fallbackMessage: string,
    method: "DELETE" | "PATCH" | "POST",
  ) {
    setLoadingAction(action);
    setError("");

    try {
      const response = await fetch(`/api/documentos/${documentId}/clicksign`, {
        method,
      });
      const payload = (await response.json()) as {
        details?: string[];
        error?: string;
        status?: string;
        statusCode?: number;
      };

      if (!response.ok) {
        throw new Error(resolveErrorMessage(payload, fallbackMessage));
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : fallbackMessage);
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {canSend ? (
          <button
            type="button"
            onClick={() =>
              handleAction("send", "Não foi possível enviar para assinatura.", "POST")
            }
            disabled={loadingAction !== null}
            title="Enviar para assinatura"
            className={
              compact
                ? "inline-flex h-10 w-10 items-center justify-center rounded-2xl text-[var(--color-accent)] transition hover:text-[var(--color-accent)]/80 disabled:cursor-not-allowed disabled:opacity-60"
                : "inline-flex items-center gap-2 rounded-2xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {loadingAction === "send" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <FileSignature className="h-4 w-4" />
            )}
            {compact ? <span className="sr-only">Enviar para assinatura</span> : "Enviar para assinatura"}
          </button>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            onClick={() =>
              handleAction("cancel", "Não foi possível cancelar o documento.", "PATCH")
            }
            disabled={loadingAction !== null}
            title="Cancelar documento"
            className={
              compact
                ? "inline-flex h-10 w-10 items-center justify-center rounded-2xl text-amber-200 transition hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                : "inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {loadingAction === "cancel" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <OctagonX className="h-4 w-4" />
            )}
            {compact ? <span className="sr-only">Cancelar documento</span> : "Cancelar documento"}
          </button>
        ) : null}

        {canDeleteDocument ? (
          <button
            type="button"
            onClick={() =>
              handleAction("delete", "Não foi possível excluir o documento.", "DELETE")
            }
            disabled={loadingAction !== null}
            title="Excluir documento draft"
            className={
              compact
                ? "inline-flex h-10 w-10 items-center justify-center rounded-2xl text-rose-200 transition hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                : "inline-flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {loadingAction === "delete" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {compact ? <span className="sr-only">Excluir documento draft</span> : "Excluir documento draft"}
          </button>
        ) : null}
      </div>
      {error ? <p className="max-w-sm text-xs leading-5 text-rose-300">{error}</p> : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FileSignature, LoaderCircle } from "lucide-react";
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
  documentId,
  initialError,
}: {
  documentId: number;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ?? "");

  async function handleSend() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/documentos/${documentId}/clicksign`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        details?: string[];
        error?: string;
        status?: string;
        statusCode?: number;
      };

      if (!response.ok) {
        throw new Error(resolveErrorMessage(payload, "Não foi possível enviar para assinatura."));
      }

      router.refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Falha ao enviar para assinatura.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={handleSend}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
        Enviar para assinatura
      </button>
      {error ? <p className="max-w-sm text-xs leading-5 text-rose-300">{error}</p> : null}
    </div>
  );
}

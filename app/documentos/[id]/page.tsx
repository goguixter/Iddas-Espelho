import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Printer } from "lucide-react";
import {
  canCancelDocumentSignature,
  canDeleteDraftDocumentSignature,
  canSendDocumentToClicksign,
} from "@/lib/clicksign/actions";
import { DocumentSignatureStatusBadge } from "@/components/document-signature-status-badge";
import { DocumentSignatureActions } from "@/components/document-signature-actions";
import { DocumentSignatureTimelineModal } from "@/components/document-signature-timeline-modal";
import { buildDocumentSignatureViewModel } from "@/lib/clicksign/presentation";
import { getDocumentEntityLabel } from "@/lib/documents/presentation";
import {
  getDocumentRecord,
  getLatestDocumentSignatureRequest,
} from "@/lib/documents/repository";

export default async function DocumentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = getDocumentRecord(Number(id));
  const signatureRequest = record ? getLatestDocumentSignatureRequest(record.id) : null;

  if (!record) {
    notFound();
  }

  const signatureView = buildDocumentSignatureViewModel({
    documentCreatedAt: record.created_at,
    request: signatureRequest
      ? {
          lastError: signatureRequest.last_error,
          providerDocumentId: signatureRequest.provider_document_id,
          providerEnvelopeId: signatureRequest.provider_envelope_id,
          rawResponseJson: signatureRequest.raw_response_json,
          sentAt: signatureRequest.sent_at,
          signersJson: signatureRequest.signers_json,
          status: signatureRequest.status,
        }
      : null,
  });

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/documentos?tab=historico"
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar aos documentos
          </Link>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          Documento
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
          {record.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Template {record.template_key} v{record.template_version} • {getDocumentEntityLabel(record)}
        </p>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {signatureView.signedNames.length > 0
            ? `Assinaram: ${signatureView.signedNames.join(", ")}`
            : "Nenhuma assinatura concluída até o momento."}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <DocumentSignatureActions
            canCancel={canCancelDocumentSignature(signatureView.actionState)}
            canDeleteDocument={canDeleteDraftDocumentSignature(signatureView.actionState)}
            canSend={canSendDocumentToClicksign(signatureView.actionState)}
            documentId={record.id}
            initialError={signatureView.error}
          />
          <DocumentSignatureTimelineModal
            title={`Timeline de ${record.title}`}
            timeline={signatureView.summary.timeline}
          />
          <Link
            href={`/api/documentos/${record.id}/html`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir HTML
          </Link>
          <Link
            href={`/api/documentos/${record.id}/html?print=1`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-105"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </Link>
          <div className="min-w-0 flex-1" />
          <DocumentSignatureStatusBadge
            label="Status do documento"
            status={signatureView.summary.status}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)]">
        <iframe
          title={record.title}
          src={`/api/documentos/${record.id}/html`}
          className="h-full w-full border-0 bg-white"
        />
      </div>
    </section>
  );
}

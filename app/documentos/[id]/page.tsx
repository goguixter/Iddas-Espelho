import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Printer } from "lucide-react";
import { getDocumentRecord } from "@/lib/documents/repository";

export default async function DocumentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = getDocumentRecord(Number(id));

  if (!record) {
    notFound();
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
            Documento
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
            {record.title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Template {record.template_key} v{record.template_version} • Orçamento{" "}
            {record.entity_id}
          </p>
          <Link
            href="/documentos?tab=historico"
            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar aos documentos
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/api/documentos/${record.id}/html`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir HTML
          </Link>
          <Link
            href={`/api/documentos/${record.id}/html`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-105"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </Link>
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

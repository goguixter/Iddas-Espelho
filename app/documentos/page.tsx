import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { DocumentGenerator } from "@/components/document-generator";
import { DocumentTemplateManager } from "@/components/document-template-manager";
import { buildContractTemplatePreview } from "@/lib/documents/contract-template";
import {
  listDocumentTemplates,
  getRecentOrcamentoDocumentOptions,
  getRecentPessoaDocumentOptions,
  listDocumentRecords,
} from "@/lib/documents/repository";

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ orcamentoId?: string; tab?: string }>;
}) {
  const { orcamentoId = "", tab = "template" } = await searchParams;
  const activeTab = ["template", "orcamento", "manual", "historico"].includes(tab)
    ? (tab as "template" | "orcamento" | "manual" | "historico")
    : "template";
  const copy = getDocumentsTabCopy(activeTab);
  const preview = buildContractTemplatePreview();
  const [documents, recentOrcamentos, recentPessoas, templates] = await Promise.all([
    activeTab === "historico" ? listDocumentRecords() : Promise.resolve([]),
    activeTab === "orcamento" ? getRecentOrcamentoDocumentOptions() : Promise.resolve([]),
    activeTab === "manual" ? getRecentPessoaDocumentOptions() : Promise.resolve([]),
    activeTab === "template" ? listDocumentTemplates() : Promise.resolve([]),
  ]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {copy.description}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-right">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-faint)]">
            Gerados
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">
            {activeTab === "historico" ? documents.length : 1}
          </p>
        </div>
      </div>

      <div className="mb-5 inline-flex rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-1">
        <TabLink active={activeTab === "template"} href="/documentos?tab=template">
          Template
        </TabLink>
        <TabLink active={activeTab === "orcamento"} href={`/documentos?tab=orcamento${orcamentoId ? `&orcamentoId=${encodeURIComponent(orcamentoId)}` : ""}`}>
          Criar por orçamento
        </TabLink>
        <TabLink active={activeTab === "manual"} href="/documentos?tab=manual">
          Criar manual
        </TabLink>
        <TabLink active={activeTab === "historico"} href="/documentos?tab=historico">
          Histórico
        </TabLink>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pr-1">
        {activeTab === "template" ? (
          <DocumentTemplateManager
            initialPreviewHtml={preview.html}
            templates={templates}
          />
        ) : activeTab === "orcamento" ? (
          <DocumentGenerator
            forcedMode="orcamento"
            initialOrcamentoId={orcamentoId}
            recentOrcamentos={recentOrcamentos}
            recentPessoas={[]}
          />
        ) : activeTab === "manual" ? (
          <DocumentGenerator
            forcedMode="manual"
            recentOrcamentos={[]}
            recentPessoas={recentPessoas}
          />
        ) : (
          <section className="flex min-h-full flex-col rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
                  Histórico
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
                  Documentos gerados
                </h2>
              </div>
              <FileText className="h-5 w-5 text-[var(--color-accent)]" />
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-auto">
              {documents.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-6 text-sm text-[var(--color-muted)]">
                  Nenhum documento foi gerado ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((document) => (
                    <article
                      key={document.id}
                      className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-faint)]">
                            {document.template_key}
                          </p>
                          <h3 className="mt-1 text-base font-semibold text-[var(--color-ink)]">
                            {document.title}
                          </h3>
                          <p className="mt-2 text-sm text-[var(--color-muted)]">
                            Orçamento {document.entity_id} • {formatDateTime(document.created_at)}
                          </p>
                        </div>
                        <Link
                          href={`/documentos/${document.id}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

function TabLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-4 py-2 text-sm transition ${
        active
          ? "bg-[var(--color-accent)] font-semibold text-slate-950"
          : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </Link>
  );
}

function formatDateTime(input: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(input));
}

function getDocumentsTabCopy(
  tab: "template" | "orcamento" | "manual" | "historico",
) {
  switch (tab) {
    case "orcamento":
      return {
        description:
          "Selecione um orçamento para preencher o contrato automaticamente e revisar a prévia antes de gerar.",
        eyebrow: "Criar por orçamento",
        title: "Contrato com dados do orçamento",
      };
    case "manual":
      return {
        description:
          "Monte o contrato manualmente usando pessoas da base e campos livres para contratante e passageiros.",
        eyebrow: "Criar manual",
        title: "Contrato com preenchimento manual",
      };
    case "historico":
      return {
        description:
          "Consulte os documentos já gerados, abra a versão persistida e imprima ou exporte em PDF.",
        eyebrow: "Histórico",
        title: "Documentos gerados",
      };
    case "template":
    default:
      return {
        description:
          "Gerencie os modelos disponíveis, visualize a estrutura final do contrato e ative ou desative templates.",
        eyebrow: "Template",
        title: "Modelos de documentos",
      };
  }
}

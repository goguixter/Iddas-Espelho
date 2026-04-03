import type { ReactNode } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { DocumentGenerator } from "@/components/document-generator";
import { DocumentHistoryList } from "@/components/document-history-list";
import { DocumentTemplateManager } from "@/components/document-template-manager";
import { buildContractTemplatePreview } from "@/lib/documents/contract-template";
import {
  countDocumentRecords,
  getRecentPessoaDocumentOptions,
  listDocumentTemplates,
  listDocumentRecords,
} from "@/lib/documents/repository";

const DOCUMENT_TABS = ["template", "orcamento", "manual", "historico"] as const;
type DocumentTab = (typeof DOCUMENT_TABS)[number];

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ orcamentoId?: string; tab?: string }>;
}) {
  const { orcamentoId = "", tab = "template" } = await searchParams;
  const activeTab = DOCUMENT_TABS.includes(tab as DocumentTab)
    ? (tab as DocumentTab)
    : "template";
  const copy = getDocumentsTabCopy(activeTab);
  const preview = buildContractTemplatePreview();
  const [documentCount, documents, recentPessoas, templates] = await Promise.all([
    countDocumentRecords(),
    activeTab === "historico" ? listDocumentRecords() : Promise.resolve([]),
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
            {documentCount}
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

      <div className="table-scroll min-h-0 flex-1 overflow-auto pr-1">
        {activeTab === "template" ? (
          <DocumentTemplateManager
            initialPreviewHtml={preview.html}
            templates={templates}
          />
        ) : activeTab === "orcamento" ? (
          <DocumentGenerator
            forcedMode="orcamento"
            initialOrcamentoId={orcamentoId}
            recentPessoas={[]}
          />
        ) : activeTab === "manual" ? (
          <DocumentGenerator
            forcedMode="manual"
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

            <div className="table-scroll mt-5 min-h-0 flex-1 overflow-auto pr-1">
              <DocumentHistoryList documents={documents} />
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

function getDocumentsTabCopy(tab: DocumentTab) {
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

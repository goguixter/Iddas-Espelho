import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { SearchableRecordTable } from "@/components/searchable-record-table";
import type { RecordTableColumn, RecordTableRow } from "@/components/record-table";
import { buildListHref } from "@/lib/list-navigation";

type Tab = {
  color: string | null;
  count: number;
  key: string;
  label: string;
};

export function OrcamentosKanbanPage({
  activeSituacao,
  columns,
  currentPage,
  currentQuery,
  items,
  tabs,
  total,
}: {
  activeSituacao: string;
  columns: RecordTableColumn[];
  currentPage: number;
  currentQuery: string;
  items: RecordTableRow[];
  tabs: Tab[];
  total: number;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          Orçamentos
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          Kanban por situação
        </h1>
      </div>

      <div className="flex items-end gap-0.5 border-b border-[var(--color-line)] px-0 pt-2">
        {tabs.map((tab) => {
          const active = tab.key === activeSituacao;
          const href = buildListHref({
            basePath: "/orcamentos",
            extraParams: { situacao: tab.key },
            query: currentQuery,
          });

          return (
            <Link
              key={tab.key}
              href={href}
              className={`relative -mb-px inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-t-lg rounded-b-none border px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition ${
                active
                  ? "border-[var(--color-line)] border-b-[var(--color-surface)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_-10px_24px_rgba(15,23,42,0.22)]"
                  : "border-transparent bg-[var(--color-panel)] text-[var(--color-faint)] hover:border-[var(--color-line)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: normalizeColor(tab.color) ?? "var(--color-faint)" }}
              />
              <span className="min-w-0 truncate">{compactTabLabel(tab.label)}</span>
              <span className="shrink-0 rounded-full border border-[var(--color-line)] px-1 py-0 text-[9px]">
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden border-x border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 xl:px-4">
        <SearchableRecordTable
          columns={columns}
          currentQuery={currentQuery}
          emptyLabel="Nenhum orçamento disponível nesta situação."
          hrefBase="/orcamentos"
          placeholder="Buscar por id, tag, cliente, telefone ou e-mail"
          rows={items}
        />
      </div>

      <div className="shrink-0 rounded-b-[24px] border-x border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 xl:px-4">
        <Pagination
          basePath="/orcamentos"
          currentPage={currentPage}
          extraParams={{ situacao: activeSituacao }}
          query={currentQuery}
          totalItems={total}
          perPage={100}
        />
      </div>
    </section>
  );
}

function normalizeColor(value: string | null) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim()
    : null;
}

function compactTabLabel(label: string) {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized === "novas solicitacoes") {
    return "Novos leads";
  }

  const compacted = label
    .replace(/^orcamento\s+/i, "")
    .replace(/^orçamento\s+/i, "")
    .replace(/^novas\s+/i, "")
    .replace(/^cotacao\s+/i, "")
    .replace(/^cotação\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^vendedor enviou$/i.test(compacted)) {
    return "Enviado";
  }

  return compacted;
}

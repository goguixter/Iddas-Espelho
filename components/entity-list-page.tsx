import { Pagination } from "@/components/pagination";
import { SearchableRecordTable } from "@/components/searchable-record-table";
import type {
  RecordTableColumn,
  RecordTableRow,
} from "@/components/record-table";

type PagedResult = {
  items: RecordTableRow[];
  page: number;
  perPage: number;
  total: number;
};

export function EntityListPage({
  basePath,
  columns,
  currentPage,
  currentQuery,
  emptyLabel,
  eyebrow,
  placeholder,
  result,
  title,
}: {
  basePath: string;
  columns: RecordTableColumn[];
  currentPage: number;
  currentQuery: string;
  emptyLabel: string;
  eyebrow: string;
  placeholder: string;
  result: PagedResult;
  title: string;
}) {
  return (
    <section className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          {title}
        </h1>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <SearchableRecordTable
          columns={columns}
          currentQuery={currentQuery}
          emptyLabel={emptyLabel}
          hrefBase={basePath}
          placeholder={placeholder}
          rows={result.items}
        />
      </div>

      <div className="shrink-0">
        <Pagination
          basePath={basePath}
          currentPage={currentPage}
          query={currentQuery}
          totalItems={result.total}
          perPage={result.perPage}
        />
      </div>
    </section>
  );
}

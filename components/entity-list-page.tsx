import { SearchablePaginatedTable } from "@/components/searchable-paginated-table";
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
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          {title}
        </h1>
      </div>
      <SearchablePaginatedTable
        basePath={basePath}
        columns={columns}
        currentPage={currentPage}
        currentQuery={currentQuery}
        emptyLabel={emptyLabel}
        footerClassName="shrink-0 rounded-b-[24px] border-x border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 xl:px-4"
        items={result.items}
        perPage={result.perPage}
        placeholder={placeholder}
        tableClassName="mt-4 min-h-0 flex-1 overflow-hidden rounded-t-[24px] border border-b-0 border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 xl:px-4"
        total={result.total}
      />
    </section>
  );
}

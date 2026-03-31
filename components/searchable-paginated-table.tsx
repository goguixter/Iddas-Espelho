import { Pagination } from "@/components/pagination";
import { SearchableRecordTable } from "@/components/searchable-record-table";
import type {
  RecordTableColumn,
  RecordTableRow,
} from "@/components/record-table";

export function SearchablePaginatedTable({
  basePath,
  columns,
  currentPage,
  currentQuery,
  emptyLabel,
  extraParams,
  footerClassName,
  items,
  onRowClick,
  perPage,
  placeholder,
  tableClassName,
  total,
}: {
  basePath: string;
  columns: RecordTableColumn[];
  currentPage: number;
  currentQuery: string;
  emptyLabel: string;
  extraParams?: Record<string, string | undefined>;
  footerClassName: string;
  items: RecordTableRow[];
  onRowClick?: (row: RecordTableRow) => void;
  perPage: number;
  placeholder: string;
  tableClassName: string;
  total: number;
}) {
  return (
    <>
      <div className={tableClassName}>
        <SearchableRecordTable
          columns={columns}
          currentQuery={currentQuery}
          emptyLabel={emptyLabel}
          hrefBase={basePath}
          onRowClick={onRowClick}
          placeholder={placeholder}
          rows={items}
        />
      </div>

      <div className={footerClassName}>
        <Pagination
          basePath={basePath}
          currentPage={currentPage}
          extraParams={extraParams}
          query={currentQuery}
          totalItems={total}
          perPage={perPage}
        />
      </div>
    </>
  );
}

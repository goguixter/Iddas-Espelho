"use client";

import Link from "next/link";

export type RecordTableColumn = {
  key: string;
  label: string;
};

export type RecordTableRow = Record<string, string | number | null>;

export function RecordTable({
  columns,
  hrefBase,
  rows,
  emptyLabel,
}: {
  columns: RecordTableColumn[];
  hrefBase?: string;
  rows: RecordTableRow[];
  emptyLabel: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--color-line)]">
      <div className="table-scroll min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-[var(--color-panel)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]"
                >
                  {column.label}
                </th>
              ))}
              <th className="border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                Visualizar
              </th>
            </tr>
          </thead>
          <tbody className="bg-[var(--color-surface)]">
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={`${row.id ?? index}`}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="border-b border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink)] last:border-b-0"
                    >
                      {formatCell(row[column.key])}
                    </td>
                  ))}
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-right last:border-b-0">
                    {hrefBase ? (
                      <Link
                        href={`${hrefBase}/${row.id}`}
                        className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                      >
                        Visualizar
                      </Link>
                    ) : (
                      <span className="text-sm text-[var(--color-faint)]">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-4 py-10 text-center text-sm text-[var(--color-muted)]"
                  colSpan={columns.length + 1}
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

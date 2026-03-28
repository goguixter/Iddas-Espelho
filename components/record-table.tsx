"use client";

import { ExternalLink } from "lucide-react";
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
                Abrir
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
                      {renderCell(column.key, row[column.key], row)}
                    </td>
                  ))}
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-right last:border-b-0">
                    {hrefBase ? (
                      <Link
                        href={`${hrefBase}/${row.id}`}
                        aria-label={`Abrir ${row.id ?? "registro"}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                      >
                        <ExternalLink className="h-4 w-4" />
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

function renderCell(
  key: string,
  value: string | number | null | undefined,
  row: RecordTableRow,
) {
  if (key === "identificador" || key === "orcamento_identificador") {
    const orcamentoId =
      key === "identificador"
        ? row.id
        : row.orcamento_id;

    return (
      <span className="inline-flex">
        {orcamentoId ? (
          <Link
            href={`/orcamentos/${String(orcamentoId)}`}
            className="inline-flex rounded-full border border-[var(--color-accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)] transition hover:bg-[var(--color-accent-soft)]"
          >
            {formatCell(value)}
          </Link>
        ) : (
          <span className="inline-flex rounded-full border border-[var(--color-accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
            {formatCell(value)}
          </span>
        )}
      </span>
    );
  }

  if (key === "situacao_nome") {
    return (
      <span
        className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]"
        style={{
          backgroundColor: formatHexColor(row.situacao_cor) ?? "var(--color-panel)",
          color: getReadableTextColor(formatHexColor(row.situacao_cor)),
        }}
      >
        {formatCell(value)}
      </span>
    );
  }

  return formatCell(value);
}

function formatCell(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function formatHexColor(value: string | number | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : null;
}

function getReadableTextColor(background: string | null) {
  if (!background) {
    return "var(--color-ink)";
  }

  const hex = background.slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance > 160 ? "#0f172a" : "#ffffff";
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

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
  onRowClick,
}: {
  columns: RecordTableColumn[];
  hrefBase?: string;
  rows: RecordTableRow[];
  emptyLabel: string;
  onRowClick?: (row: RecordTableRow) => void;
}) {
  const router = useRouter();
  const clickable = Boolean(hrefBase || onRowClick);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--color-line)]">
      <div className="table-scroll min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-[var(--color-panel)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[var(--color-surface)]">
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr
                  key={`${row.id ?? index}`}
                  className={clickable ? "cursor-pointer transition hover:bg-white/3" : undefined}
                  onClick={() => {
                    if (onRowClick) {
                      onRowClick(row);
                      return;
                    }

                    if (hrefBase && row.id) {
                      router.push(`${hrefBase}/${row.id}`);
                    }
                  }}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="border-b border-[var(--color-line)] px-4 py-1.5 text-[12px] text-[var(--color-ink)]"
                    >
                      {renderCell(column.key, row[column.key], row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-4 py-8 text-center text-[13px] text-[var(--color-muted)]"
                  colSpan={columns.length}
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
  if (
    key === "identificador" ||
    key === "orcamento_identificador" ||
    key === "linked_orcamento_identificador"
  ) {
    const orcamentoId =
      key === "identificador"
        ? row.id
        : key === "linked_orcamento_identificador"
          ? row.linked_orcamento_id
          : row.orcamento_id;
    const identifierColor = formatHexColor(row.situacao_cor) ?? "var(--color-accent)";

    return (
      <span className="inline-flex">
        {orcamentoId ? (
          <Link
            href={`/orcamentos/${String(orcamentoId)}`}
            className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition"
            onClick={(event) => event.stopPropagation()}
            style={{ borderColor: identifierColor, color: identifierColor }}
          >
            {formatCell(value)}
          </Link>
        ) : (
          <span
            className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ borderColor: identifierColor, color: identifierColor }}
          >
            {formatCell(value)}
          </span>
        )}
      </span>
    );
  }

  if (key === "situacao_nome") {
    return (
      <span
        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
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

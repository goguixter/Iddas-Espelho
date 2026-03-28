import Link from "next/link";
import { buildListHref } from "@/lib/list-navigation";

export function Pagination({
  basePath,
  currentPage,
  extraParams,
  query,
  totalItems,
  perPage,
}: {
  basePath: string;
  currentPage: number;
  extraParams?: Record<string, string | undefined>;
  query?: string;
  totalItems: number;
  perPage: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const previousHref = buildListHref({
    basePath,
    extraParams,
    page: Math.max(1, currentPage - 1),
    query,
  });
  const nextHref = buildListHref({
    basePath,
    extraParams,
    page: Math.min(totalPages, currentPage + 1),
    query,
  });

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[13px] text-[var(--color-muted)]">
        Página {currentPage} de {totalPages}
      </p>
      <div className="flex gap-2">
        <Link
          href={previousHref}
          className={`rounded-2xl px-4 py-2 text-[13px] font-medium transition ${
            currentPage === 1
              ? "pointer-events-none border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-faint)]"
              : "border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_12px_32px_rgba(15,23,42,0.22)] hover:border-[var(--color-accent)] hover:shadow-[0_12px_32px_rgba(251,191,36,0.18)]"
          }`}
        >
          Anterior
        </Link>
        <Link
          href={nextHref}
          className={`rounded-2xl px-4 py-2 text-[13px] font-medium transition ${
            currentPage >= totalPages
              ? "pointer-events-none border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-faint)]"
              : "border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_12px_32px_rgba(15,23,42,0.22)] hover:border-[var(--color-accent)] hover:shadow-[0_12px_32px_rgba(251,191,36,0.18)]"
          }`}
        >
          Próxima
        </Link>
      </div>
    </div>
  );
}

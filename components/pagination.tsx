import Link from "next/link";

export function Pagination({
  basePath,
  currentPage,
  query,
  totalItems,
  perPage,
}: {
  basePath: string;
  currentPage: number;
  query?: string;
  totalItems: number;
  perPage: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const previousHref = buildPageHref(basePath, Math.max(1, currentPage - 1), query);
  const nextHref = buildPageHref(basePath, Math.min(totalPages, currentPage + 1), query);

  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <p className="text-sm text-[var(--color-muted)]">
        Página {currentPage} de {totalPages}
      </p>
      <div className="flex gap-2">
        <Link
          href={previousHref}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            currentPage === 1
              ? "pointer-events-none bg-[var(--color-panel)] text-[var(--color-faint)]"
              : "bg-[var(--color-accent)] text-slate-950"
          }`}
        >
          Anterior
        </Link>
        <Link
          href={nextHref}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            currentPage >= totalPages
              ? "pointer-events-none bg-[var(--color-panel)] text-[var(--color-faint)]"
              : "bg-[var(--color-accent)] text-slate-950"
          }`}
        >
          Próxima
        </Link>
      </div>
    </div>
  );
}

function buildPageHref(basePath: string, page: number, query?: string) {
  const params = new URLSearchParams({ page: String(page) });

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  return `${basePath}?${params.toString()}`;
}

import Link from "next/link";

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
  const previousHref = buildPageHref(
    basePath,
    Math.max(1, currentPage - 1),
    query,
    extraParams,
  );
  const nextHref = buildPageHref(
    basePath,
    Math.min(totalPages, currentPage + 1),
    query,
    extraParams,
  );

  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <p className="text-sm text-[var(--color-muted)]">
        Página {currentPage} de {totalPages}
      </p>
      <div className="flex gap-2">
        <Link
          href={previousHref}
          className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
            currentPage === 1
              ? "pointer-events-none border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-faint)]"
              : "border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_12px_32px_rgba(15,23,42,0.22)] hover:border-[var(--color-accent)] hover:shadow-[0_12px_32px_rgba(251,191,36,0.18)]"
          }`}
        >
          Anterior
        </Link>
        <Link
          href={nextHref}
          className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
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

function buildPageHref(
  basePath: string,
  page: number,
  query?: string,
  extraParams?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams({ page: String(page) });

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value?.trim()) {
        params.set(key, value.trim());
      }
    }
  }

  return `${basePath}?${params.toString()}`;
}

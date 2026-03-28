import Link from "next/link";

export type RelationItem = {
  description?: string | null;
  href: string;
  label: string;
};

export function EntityRelations({
  emptyLabel,
  items,
  title,
}: {
  emptyLabel: string;
  items: RelationItem[];
  title: string;
}) {
  return (
    <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
        {title}
      </h2>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className="block rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 transition hover:border-[var(--color-accent)]"
            >
              <p className="font-medium text-[var(--color-ink)]">{item.label}</p>
              {item.description ? (
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {item.description}
                </p>
              ) : null}
            </Link>
          ))
        ) : (
          <p className="text-sm text-[var(--color-muted)]">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}

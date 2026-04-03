import Link from "next/link";

export function EntityDetailHeader({
  backHref,
  eyebrow,
  subtitle,
  title,
}: {
  backHref: string;
  eyebrow: string;
  subtitle: string;
  title: string;
}) {
  return (
    <header className="rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
        {title}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{subtitle}</p>
      <Link
        href={backHref}
        className="mt-4 inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm font-medium text-[var(--color-ink)]"
      >
        Voltar
      </Link>
    </header>
  );
}

export function EntityDetailCard({
  items,
  title,
}: {
  items: Array<{ label: string; value: string | null }>;
  title: string;
}) {
  return (
    <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
        {title}
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-[var(--color-surface)] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
              {item.label}
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink)]">{item.value ?? "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EntityJsonPanel({
  raw,
}: {
  raw: unknown;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[24px] border border-[var(--color-line)] bg-slate-950">
      <div className="border-b border-white/10 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
        JSON bruto espelhado
      </div>
      <pre className="table-scroll max-h-[65vh] max-w-full overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-slate-100">
        {JSON.stringify(raw, null, 2)}
      </pre>
    </section>
  );
}

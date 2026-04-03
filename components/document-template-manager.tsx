"use client";

import { useState } from "react";
import { FileText, Power, PowerOff } from "lucide-react";
import type { DocumentTemplateRecord } from "@/lib/documents/types";

export function DocumentTemplateManager({
  initialPreviewHtml,
  templates,
}: {
  initialPreviewHtml: string;
  templates: DocumentTemplateRecord[];
}) {
  const [items, setItems] = useState(templates);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function toggleTemplate(key: string, nextState: boolean) {
    setLoadingKey(key);
    try {
      const response = await fetch("/api/documentos/templates", {
        body: JSON.stringify({ isActive: nextState, key }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error();
      }

      setItems((current) =>
        current.map((item) =>
          item.key === key ? { ...item, is_active: nextState ? 1 : 0 } : item,
        ),
      );
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <section className="grid h-full min-h-0 gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="table-scroll min-h-0 overflow-auto pr-1">
        <div className="space-y-4">
        {items.map((template) => (
          <article
            key={template.key}
            className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
                  Template
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
                  {template.title}
                </h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${
                  template.is_active
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-[var(--color-panel)] text-[var(--color-faint)]"
                }`}
              >
                {template.is_active ? "Ativo" : "Inativo"}
              </span>
            </div>

            <p className="mt-3 text-sm text-[var(--color-muted)]">{template.description}</p>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-faint)]">
                  Versão
                </p>
                <p className="mt-1 text-sm text-[var(--color-ink)]">v{template.version}</p>
              </div>

              <button
                type="button"
                disabled={loadingKey === template.key}
                onClick={() => toggleTemplate(template.key, !template.is_active)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {template.is_active ? (
                  <PowerOff className="h-4 w-4 text-rose-300" />
                ) : (
                  <Power className="h-4 w-4 text-emerald-300" />
                )}
                {template.is_active ? "Desativar" : "Ativar"}
              </button>
            </div>
          </article>
        ))}
        </div>
      </div>

      <section className="flex min-h-0 flex-col rounded-[24px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center gap-2 text-[var(--color-ink)]">
          <FileText className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">
            Pré-visualização do modelo
          </h3>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[22px] border border-[var(--color-line)] bg-[var(--color-panel)]">
          <iframe
            title="Prévia do template"
            srcDoc={initialPreviewHtml}
            className="h-full w-full bg-white"
            style={{ zoom: 0.68 }}
          />
        </div>
      </section>
    </section>
  );
}

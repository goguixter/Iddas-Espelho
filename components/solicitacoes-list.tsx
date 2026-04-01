"use client";

import Link from "next/link";
import { CalendarDays, Search, X } from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/pagination";
import { formatIsoDateToDisplay } from "@/lib/iddas/date-range";

type SolicitacaoRow = {
  data_ida: string | null;
  data_solicitacao: string | null;
  destino: string | null;
  id: string;
  linked_orcamento_id?: string | null;
  linked_orcamento_identificador?: string | null;
  match_reason?: string | null;
  match_status?: string | null;
  nome: string | null;
  origem: string | null;
  situacao_cor?: string | null;
  situacao_nome?: string | null;
};

type PagedResult = {
  items: SolicitacaoRow[];
  page: number;
  perPage: number;
  total: number;
};

type SolicitacaoDetail = {
  adultos: string | null;
  criancas: string | null;
  data_ida: string | null;
  data_solicitacao: string | null;
  data_volta: string | null;
  destino: string | null;
  email: string | null;
  id: string;
  linked_orcamento_id: string | null;
  linked_orcamento_identificador: string | null;
  match_reason: string | null;
  match_status: string | null;
  nome: string | null;
  observacao: string | null;
  origem: string | null;
  possui_flexibilidade: string | null;
  raw: unknown;
  situacao_cor: string | null;
  situacao_nome: string | null;
  telefone: string | null;
  updated_at: string;
};

export function SolicitacoesList({
  currentDate,
  currentPage,
  currentQuery,
  emptyLabel,
  placeholder,
  result,
}: {
  currentDate: string;
  currentPage: number;
  currentQuery: string;
  emptyLabel: string;
  placeholder: string;
  result: PagedResult;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(currentQuery ?? "");
  const [date, setDate] = useState(currentDate ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SolicitacaoDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const deferredDate = useDeferredValue(date);

  useEffect(() => {
    const normalizedCurrentQuery = (currentQuery ?? "").trim();
    const normalizedDeferredQuery = deferredQuery.trim();
    const normalizedCurrentDate = (currentDate ?? "").trim();
    const normalizedDeferredDate = deferredDate.trim();

    if (
      normalizedCurrentQuery === normalizedDeferredQuery &&
      normalizedCurrentDate === normalizedDeferredDate
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());

    if (normalizedDeferredQuery) {
      nextParams.set("q", normalizedDeferredQuery);
    } else {
      nextParams.delete("q");
    }

    if (normalizedDeferredDate) {
      nextParams.set("data", normalizedDeferredDate);
    } else {
      nextParams.delete("data");
    }

    nextParams.delete("page");

    const nextUrl = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentDate,
    currentQuery,
    deferredDate,
    deferredQuery,
    pathname,
    router,
    searchParams,
  ]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let cancelled = false;

    void fetch(`/api/solicitacoes/${selectedId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Falha ao carregar a solicitação.");
        }

        return (await response.json()) as SolicitacaoDetail;
      })
      .then((payload) => {
        if (!cancelled) {
          setDetail(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetail(null);
        setSelectedId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  return (
    <>
      <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-t-[24px] border border-b-0 border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 xl:px-4">
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="grid shrink-0 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-faint)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] py-2.5 pr-4 pl-10 text-[13px] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent)]"
              />
            </label>
            <DateField value={date} onChange={setDate} />
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-[24px] border border-[var(--color-line)] p-3">
            <div className="space-y-3">
              {result.items.length > 0 ? (
                result.items.map((row) => (
                  <article
                    key={row.id}
                    className="grid cursor-pointer gap-4 rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-4 transition hover:border-[var(--color-accent)] hover:bg-white/3 xl:grid-cols-[180px_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_46px]"
                    onClick={() => {
                      setLoading(true);
                      setDetail(null);
                      setSelectedId(row.id);
                    }}
                  >
                    <div className="flex flex-col justify-between gap-3">
                      <div className="flex flex-col items-start gap-2">
                        {row.linked_orcamento_identificador ? (
                          row.linked_orcamento_id ? (
                            <Link
                              href={`/orcamentos/${row.linked_orcamento_id}`}
                              className="inline-flex rounded-full border border-[var(--color-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {row.linked_orcamento_identificador}
                            </Link>
                          ) : (
                            <span className="inline-flex rounded-full border border-[var(--color-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
                              {row.linked_orcamento_identificador}
                            </span>
                          )
                        ) : (
                          <span className="inline-flex rounded-full border border-[var(--color-line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-faint)]">
                            Sem tag
                          </span>
                        )}
                        {row.situacao_nome ? (
                          <span
                            className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                            style={{
                              backgroundColor:
                                formatHexColor(row.situacao_cor) ?? "var(--color-panel)",
                              color: getReadableTextColor(formatHexColor(row.situacao_cor)),
                            }}
                          >
                            {row.situacao_nome}
                          </span>
                        ) : null}
                        {row.match_status === "manual_review" ? (
                          <span className="inline-flex rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                            Revisão manual
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[13px] text-[var(--color-ink)]">
                        {formatDateTimeToDisplay(row.data_solicitacao)}
                      </p>
                    </div>

                    <div className="space-y-2 text-[13px] text-[var(--color-ink)]">
                      <p className="line-clamp-2 text-lg font-semibold leading-7">
                        {row.nome ?? "—"}
                      </p>
                      <p className="line-clamp-1 text-[var(--color-muted)]">
                        {row.id}
                      </p>
                    </div>

                    <div className="space-y-2 text-[13px] text-[var(--color-ink)]">
                      <p className="line-clamp-2 leading-7">
                        {row.origem ?? "—"}
                      </p>
                      <p className="line-clamp-2 text-[var(--color-muted)]">
                        {row.destino ?? "—"}
                      </p>
                    </div>

                    <div className="space-y-2 text-[13px] text-[var(--color-ink)]">
                      <p className="line-clamp-1 leading-7">
                        Ida: {formatDateTimeToDisplay(row.data_ida)}
                      </p>
                      <p className="line-clamp-1 text-[var(--color-muted)]">
                        Solicitação: {formatDateTimeToDisplay(row.data_solicitacao)}
                      </p>
                    </div>

                    <div className="flex items-center justify-end text-[var(--color-faint)]">
                      <span className="text-xl leading-none">↗</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-[13px] text-[var(--color-muted)]">
                  {emptyLabel}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 rounded-b-[24px] border-x border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 xl:px-4">
        <Pagination
          basePath="/solicitacoes"
          currentPage={currentPage}
          extraParams={{ data: currentDate || undefined }}
          query={currentQuery}
          totalItems={result.total}
          perPage={result.perPage}
        />
      </div>

      {selectedId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
          onClick={() => {
            setDetail(null);
            setSelectedId(null);
          }}
        >
          <div
            className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_24px_80px_rgba(15,23,42,0.4)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-6 py-5">
              <div>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
                  {detail?.nome ?? "Informações da solicitação"}
                </h2>
                {detail ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">
                      <span className="text-[var(--color-faint)]">ID</span>
                      <span>{detail.id}</span>
                    </span>
                    {detail.linked_orcamento_identificador ? (
                      detail.linked_orcamento_id ? (
                        <Link
                          href={`/orcamentos/${detail.linked_orcamento_id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]"
                        >
                          <span className="text-[var(--color-faint)]">Tag</span>
                          <span>{detail.linked_orcamento_identificador}</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
                          <span className="text-[var(--color-faint)]">Tag</span>
                          <span>{detail.linked_orcamento_identificador}</span>
                        </span>
                      )
                    ) : null}
                    {detail.situacao_nome ? (
                      <span
                        className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          backgroundColor:
                            formatHexColor(detail.situacao_cor) ?? "var(--color-panel)",
                          color: getReadableTextColor(formatHexColor(detail.situacao_cor)),
                        }}
                      >
                        {detail.situacao_nome}
                      </span>
                    ) : null}
                    {detail.match_status === "manual_review" ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                        <span className="text-amber-200/80">Validação</span>
                        <span>Manual</span>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setSelectedId(null);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-88px)] overflow-auto px-6 py-5">
              {loading || !detail ? (
                <div className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
                  Carregando solicitação...
                </div>
              ) : (
                <div className="space-y-4">
                  <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
                          Solicitado por
                        </p>
                        <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">
                          {detail.nome ?? "—"}
                        </p>
                        <p className="mt-2 text-sm text-[var(--color-muted)]">
                          {detail.telefone ?? "—"}
                        </p>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">
                          {detail.email ?? "—"}
                        </p>
                      </div>
                      <DetailTile label="Origem" value={detail.origem} />
                      <DetailTile label="Destino" value={detail.destino} />
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
                        Rota e passageiros
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[var(--color-ink)]">
                        {detail.origem ?? "—"} → {detail.destino ?? "—"}
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <DetailTile label="Ida" value={detail.data_ida} />
                        <DetailTile label="Volta" value={detail.data_volta} />
                        <DetailTile label="Adultos" value={detail.adultos} />
                        <DetailTile label="Crianças" value={detail.criancas} />
                        <DetailTile
                          label="Flexibilidade"
                          value={
                            detail.possui_flexibilidade === "S"
                              ? "Sim"
                              : detail.possui_flexibilidade === "N"
                                ? "Não"
                                : detail.possui_flexibilidade
                          }
                        />
                        <DetailTile
                          label="Data solicitação"
                          value={detail.data_solicitacao}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-faint)]">
                      Observação
                    </h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--color-ink)]">
                      {detail.observacao ?? "—"}
                    </p>
                  </section>

                  {detail.match_status === "manual_review" ? (
                    <section className="rounded-[24px] border border-amber-500/40 bg-amber-500/10 p-5">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
                        Validação manual
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-amber-100">
                        {formatMatchReason(detail.match_reason)}
                      </p>
                    </section>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  const dateRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (dateRef.current?.showPicker) {
      dateRef.current.showPicker();
      return;
    }

    dateRef.current?.click();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        className="flex w-full items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2.5 text-left text-[13px] font-medium text-[var(--color-ink)]"
      >
        <span>{value ? formatIsoDateToDisplay(value) : "Filtrar por data"}</span>
        <CalendarDays className="h-4 w-4 text-[var(--color-muted)]" />
      </button>
      <input
        id={inputId}
        ref={dateRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute inset-0 opacity-0"
        tabIndex={-1}
      />
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl bg-[var(--color-surface)] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
        {label}
      </p>
      <p className="mt-2 text-sm text-[var(--color-ink)]">{value ?? "—"}</p>
    </div>
  );
}

function formatHexColor(value: string | null | undefined) {
  if (!value) {
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

function formatMatchReason(reason: string | null | undefined) {
  if (reason === "created_at_conflict") {
    return "Mais de um orçamento foi encontrado dentro da janela de 5 segundos da criação desta solicitação.";
  }

  if (reason === "created_at_mismatch") {
    return "O vínculo atual diverge do orçamento encontrado dentro da janela de 5 segundos da criação.";
  }

  if (reason === "created_at_5s") {
    return "Vínculo confirmado automaticamente pela proximidade de até 5 segundos entre solicitação e orçamento.";
  }

  return "Esta solicitação precisa de confirmação manual antes de considerar o vínculo como definitivo.";
}

function formatDateTimeToDisplay(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = value.slice(0, 10);
  return formatIsoDateToDisplay(date);
}

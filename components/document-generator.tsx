"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  LoaderCircle,
  MapPinned,
  RefreshCcw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { normalizeDocumentNumber } from "@/lib/documents/formatters";
import type {
  RecentFornecedorDocumentOption,
  PessoaDocumentSource,
  RecentOrcamentoDocumentOption,
  RecentPessoaDocumentOption,
} from "@/lib/documents/types";

type FormState = {
  bairro: string;
  cep: string;
  cidade: string;
  condicoesTarifarias: string;
  estado: string;
  fornecedor: string;
  localizadorReserva: string;
  logradouro: string;
  mode: "manual" | "orcamento";
  numero: string;
  orcamentoId: string;
  pessoaContratanteId: string;
  servicoContratado: string;
};

const EMPTY_AUTOFILL_FIELDS = {
  bairro: "",
  cep: "",
  cidade: "",
  estado: "",
  localizadorReserva: "",
  logradouro: "",
  numero: "",
} as const;

function createInitialFormState(
  forcedMode: "manual" | "orcamento" | undefined,
  initialOrcamentoId: string,
): FormState {
  return {
    bairro: "",
    cep: "",
    cidade: "",
    condicoesTarifarias: "",
    estado: "",
    fornecedor: "",
    localizadorReserva: "",
    logradouro: "",
    mode: forcedMode ?? (initialOrcamentoId ? "orcamento" : "manual"),
    numero: "",
    orcamentoId: initialOrcamentoId,
    pessoaContratanteId: "",
    servicoContratado: "Intermediação na compra de passagens aéreas",
  };
}

function createEmptyManualFormState(): FormState {
  return createInitialFormState("manual", "");
}

function createEmptyOrcamentoFormState(): FormState {
  return createInitialFormState("orcamento", "");
}

function createDocumentPayload(form: FormState, passageiros: PessoaDocumentSource[]) {
  return {
    ...form,
    passageirosPessoaIds: passageiros.map((item) => item.id),
  };
}

function hasCompleteAddress(form: FormState) {
  return [
    form.logradouro,
    form.numero,
    form.bairro,
    form.cep,
    form.cidade,
    form.estado,
  ].every((value) => value.trim());
}

function canGeneratePreview(form: FormState) {
  if (!hasCompleteAddress(form)) {
    return false;
  }

  if (form.mode === "orcamento") {
    return Boolean(form.orcamentoId.trim());
  }

  return Boolean(form.pessoaContratanteId.trim());
}

function extractString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function extractOrcamentoLocalizador(raw: Record<string, unknown> | null | undefined) {
  const voos = raw?.voos;

  if (!Array.isArray(voos) || voos.length === 0) {
    return "";
  }

  const firstFlight = voos[0];

  if (!firstFlight || typeof firstFlight !== "object" || Array.isArray(firstFlight)) {
    return "";
  }

  return extractString((firstFlight as Record<string, unknown>).localizador);
}

function applyOrcamentoAutofill(current: FormState, source: {
  clienteBairro?: string | null;
  clienteCep?: string | null;
  clienteCidade?: string | null;
  clienteCpf?: string | null;
  clienteEndereco?: string | null;
  clienteEstado?: string | null;
  clienteNome?: string | null;
  clienteNumero?: string | null;
  raw?: Record<string, unknown> | null;
}) {
  return {
    ...current,
    ...EMPTY_AUTOFILL_FIELDS,
    bairro: source.clienteBairro || "",
    cep: source.clienteCep || "",
    cidade: source.clienteCidade || "",
    estado: source.clienteEstado || "",
    localizadorReserva: extractOrcamentoLocalizador(source.raw),
    logradouro: source.clienteEndereco || "",
    numero: source.clienteNumero || "",
  };
}

function applyPessoaAutofill(current: FormState, source: PessoaDocumentSource) {
  return {
    ...current,
    ...EMPTY_AUTOFILL_FIELDS,
    bairro: source.bairro || "",
    cep: source.cep || "",
    cidade: source.cidade || "",
    estado: source.estado || "",
    logradouro: source.endereco || "",
    numero: source.numero || "",
  };
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const text = await response.text();
    const payload = safeJsonParse(text) as
      | { details?: string[]; error?: string }
      | null;
    throw new Error(resolveApiErrorMessage(payload, "Não foi possível completar a operação."));
  }

  return response.json() as Promise<T>;
}

function safeJsonParse(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

function resolveApiErrorMessage(
  payload: { details?: string[]; error?: string } | null,
  fallback: string,
) {
  const detail = payload?.details?.find((value) => typeof value === "string" && value.trim());
  return detail ?? payload?.error ?? fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function upsertPassenger(current: PessoaDocumentSource[], source: PessoaDocumentSource) {
  return current.some((person) => person.id === source.id) ? current : [...current, source];
}

function toShortPersonName(value: string | null | undefined) {
  const normalized = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (normalized.length === 0) {
    return "";
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  return `${normalized[0]} ${normalized[normalized.length - 1]}`;
}

function ControlButton({
  children,
  icon,
  onClick,
}: {
  children: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    >
      {icon}
      {children}
    </button>
  );
}

function RemovableTag({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-xs text-[var(--color-ink)]">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="cursor-pointer text-[var(--color-muted)] transition hover:text-rose-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function SectionDivider({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`space-y-2 border-t border-[var(--color-line)] pt-4 ${className}`}>{children}</div>;
}

function PreviewPanel({
  emptyMessage,
  html,
  loading,
  title,
}: {
  emptyMessage: string;
  html: string;
  loading: boolean;
  title: string;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-[24px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3 text-[var(--color-ink)]">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--color-ink)]">Contrato v1</span>
          {loading ? (
            <span className="inline-flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
              Atualizando
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[22px] border border-[var(--color-line)] bg-[var(--color-panel)]">
        {html ? (
          <iframe
            title="Prévia do contrato"
            srcDoc={html}
            className="h-full w-full bg-white"
            style={{ zoom: 0.84 }}
          />
        ) : (
          <div className="flex h-full min-h-[720px] items-center justify-center px-6 text-center text-sm text-[var(--color-muted)]">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}

function PersonSearchModal({
  mode,
  onClose,
  onSearchChange,
  onSelect,
  results,
  search,
  selectedPassengers,
}: {
  mode: "contratante" | "passageiro";
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (option: RecentPessoaDocumentOption) => void;
  results: RecentPessoaDocumentOption[];
  search: string;
  selectedPassengers: Array<{ id: string; nome: string }>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_24px_80px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
              {mode === "contratante" ? "Contratante" : "Passageiro"}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
              {mode === "contratante" ? "Buscar contratante" : "Buscar passageiro"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
          <SearchField
            label={mode === "contratante" ? "Buscar contratante" : "Buscar passageiro"}
            labelClassName="text-[var(--color-accent)]"
            inputClassName="bg-[var(--color-panel)]"
            value={search}
            onChange={onSearchChange}
            placeholder="Digite nome ou CPF"
          />

          {mode === "passageiro" ? (
            <div className="mt-4 border-b border-[var(--color-line)] pb-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
                  Selecionados
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  {selectedPassengers.length} selecionado(s)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPassengers.length ? (
                  selectedPassengers.map((passenger) => (
                    <RemovableTag
                      key={`selected-passenger-${passenger.id}`}
                      onRemove={() => onSelect({ id: passenger.id } as RecentPessoaDocumentOption)}
                    >
                      {passenger.nome}
                    </RemovableTag>
                  ))
                ) : (
                  <span className="text-sm text-[var(--color-muted)]">
                    Nenhum passageiro selecionado.
                  </span>
                )}
              </div>
            </div>
          ) : null}

          <div className="table-scroll mt-4 min-h-0 flex-1 overflow-auto pr-1">
            <div className="space-y-2">
              {results.map((option) => {
                const isSelected =
                  mode === "passageiro" &&
                  selectedPassengers.some((passenger) => passenger.id === option.id);

                return (
                  <button
                    key={`person-search-${option.id}`}
                    type="button"
                    onClick={() => onSelect(option)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-[var(--color-accent)] bg-[var(--color-panel)]"
                        : "border-transparent bg-[var(--color-panel)] hover:border-[var(--color-accent)]"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--color-ink)]">
                        {option.nome ?? "Sem nome"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        {normalizeDocumentNumber(option.cpf) || option.id}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs text-[var(--color-faint)]">
                        {option.cidade ?? "Sem cidade"}
                      </span>
                      {isSelected ? (
                        <span className="mt-1 block text-xs font-medium text-[var(--color-accent)]">
                          Selecionado
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "passageiro" ? (
            <div className="mt-4 flex justify-end border-t border-[var(--color-line)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-105"
              >
                Concluir
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ServiceModal({
  form,
  onClose,
  onFieldChange,
}: {
  form: FormState;
  onClose: () => void;
  onFieldChange: (key: keyof FormState, value: string) => void;
}) {
  const [supplierSearch, setSupplierSearch] = useState(form.fornecedor);
  const [supplierResults, setSupplierResults] = useState<RecentFornecedorDocumentOption[]>([]);
  const selectedSupplier = form.fornecedor.trim();
  const hasSupplierQuery = supplierSearch.trim().length > 0 && supplierSearch.trim() !== selectedSupplier;

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      fetchJson<RecentFornecedorDocumentOption[]>(
        `/api/documentos/fornecedores?q=${encodeURIComponent(supplierSearch.trim())}`,
      )
        .then((results) => {
          if (active) {
            setSupplierResults(results);
          }
        })
        .catch(() => {
          if (active) {
            setSupplierResults([]);
          }
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [supplierSearch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_24px_80px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
              Dados do serviço
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
              Definir informações do contrato
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="table-scroll min-h-0 flex-1 overflow-auto px-6 py-5 pr-5">
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-[0.4fr_0.6fr]">
              <InputField
                label="Localizador da reserva"
                value={form.localizadorReserva}
                onChange={(value) => onFieldChange("localizadorReserva", value)}
              />
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
                  Fornecedor
                </span>
                <div className="relative mt-2">
                  {selectedSupplier ? (
                    <div className="flex min-h-[48px] w-full items-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
                      <RemovableTag
                        onRemove={() => {
                          setSupplierSearch("");
                          onFieldChange("fornecedor", "");
                          setSupplierResults([]);
                        }}
                      >
                        {selectedSupplier}
                      </RemovableTag>
                    </div>
                  ) : (
                    <>
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-faint)]" />
                      <input
                        className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] py-3 pl-11 pr-4 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)]"
                        value={supplierSearch}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSupplierSearch(value);
                          if (!value.trim()) {
                            onFieldChange("fornecedor", "");
                            setSupplierResults([]);
                          }
                        }}
                        placeholder="Buscar companhia ou fornecedor"
                      />
                    </>
                  )}
                  {hasSupplierQuery ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] shadow-[0_18px_50px_rgba(15,23,42,0.42)]">
                      {supplierResults.length > 0 ? (
                        <div className="table-scroll max-h-44 overflow-auto p-2 pr-1">
                          <div className="space-y-2">
                            {supplierResults.map((option) => (
                              <button
                              key={`supplier-${option.tipo}-${option.id}`}
                              type="button"
                              onClick={() => {
                                setSupplierSearch(option.nome);
                                onFieldChange("fornecedor", option.nome);
                                setSupplierResults([]);
                              }}
                                className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-transparent bg-[var(--color-surface)] px-3 py-2.5 text-left transition hover:border-[var(--color-accent)]"
                              >
                                <div>
                                  <p className="text-sm font-medium text-[var(--color-ink)]">{option.nome}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
                                    {option.tipo === "companhia" ? "Companhia aérea" : "Fornecedor"}
                                  </p>
                                </div>
                                <span className="text-xs text-[var(--color-faint)]">
                                  {option.hint ?? "—"}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-sm text-[var(--color-muted)]">
                          Nenhum fornecedor encontrado.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </label>
            </div>
            <InputField
              label="Serviço contratado"
              value={form.servicoContratado}
              onChange={(value) => onFieldChange("servicoContratado", value)}
            />
            <TextAreaField
              label="Condições tarifárias"
              value={form.condicoesTarifarias}
              onChange={(value) => onFieldChange("condicoesTarifarias", value)}
            />
          </div>
        </div>

        <div className="border-t border-[var(--color-line)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105"
          >
            Salvar dados do serviço
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentGenerator({
  forcedMode,
  initialOrcamentoId = "",
  recentPessoas,
}: {
  forcedMode?: "manual" | "orcamento";
  initialOrcamentoId?: string;
  recentPessoas: RecentPessoaDocumentOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [personModalMode, setPersonModalMode] = useState<"contratante" | "passageiro" | null>(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [personSearch, setPersonSearch] = useState("");
  const [personSearchResults, setPersonSearchResults] = useState<RecentPessoaDocumentOption[]>(recentPessoas);
  const [orcamentoSearch, setOrcamentoSearch] = useState("");
  const [orcamentoSearchResults, setOrcamentoSearchResults] = useState<RecentOrcamentoDocumentOption[]>([]);
  const [selectedPassengerPeople, setSelectedPassengerPeople] = useState<PessoaDocumentSource[]>([]);
  const [form, setForm] = useState<FormState>(() => createInitialFormState(forcedMode, initialOrcamentoId));
  const selectedContratante =
    selectedPassengerPeople.find((item) => item.id === form.pessoaContratanteId) ?? null;

  useEffect(() => {
    if (!forcedMode) {
      return;
    }

    setForm((current) => (current.mode === forcedMode ? current : { ...current, mode: forcedMode }));
  }, [forcedMode]);

  useEffect(() => {
    if (form.mode !== "orcamento") {
      return;
    }

    const query = orcamentoSearch.trim();

    if (!query) {
      setOrcamentoSearchResults([]);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(() => {
      fetchJson<RecentOrcamentoDocumentOption[]>(
        `/api/documentos/orcamentos?q=${encodeURIComponent(query)}`,
      )
        .then((results) => {
          if (active) {
            setOrcamentoSearchResults(results);
          }
        })
        .catch(() => {
          if (active) {
            setOrcamentoSearchResults([]);
          }
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [form.mode, orcamentoSearch]);

  useEffect(() => {
    if (!personModalMode) {
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(() => {
      fetchJson<RecentPessoaDocumentOption[]>(
        `/api/documentos/pessoas?q=${encodeURIComponent(personSearch.trim())}`,
      )
        .then((results) => {
          if (active) {
            setPersonSearchResults(results);
          }
        })
        .catch(() => {
          if (active) {
            setPersonSearchResults([]);
          }
        });
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [personModalMode, personSearch]);

  useEffect(() => {
    if (form.mode !== "orcamento") {
      return;
    }

    if (!form.orcamentoId.trim()) {
      setForm((current) => ({ ...current, ...EMPTY_AUTOFILL_FIELDS }));
      return;
    }

    let active = true;
    fetchJson<{
      clienteBairro?: string | null;
      clienteCep?: string | null;
      clienteCidade?: string | null;
      clienteCpf?: string | null;
      clienteEndereco?: string | null;
      clienteEstado?: string | null;
      clienteNome?: string | null;
      clienteNumero?: string | null;
      raw?: Record<string, unknown> | null;
    }>(`/api/documentos/orcamentos/${form.orcamentoId}`)
      .then((source) => {
        if (active) {
          setForm((current) => applyOrcamentoAutofill(current, source));
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            getErrorMessage(loadError, "Não foi possível carregar os dados automáticos do orçamento."),
          );
        }
      });

    return () => {
      active = false;
    };
  }, [form.mode, form.orcamentoId]);

  useEffect(() => {
    if (form.mode !== "manual") {
      return;
    }

    if (!form.pessoaContratanteId.trim()) {
      setForm((current) => ({
        ...current,
        ...EMPTY_AUTOFILL_FIELDS,
      }));
      return;
    }

    let active = true;
    fetchJson<PessoaDocumentSource>(`/api/documentos/pessoas/${form.pessoaContratanteId}`)
      .then((source) => {
        if (active) {
          setForm((current) => applyPessoaAutofill(current, source));
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(getErrorMessage(loadError, "Não foi possível carregar os dados da pessoa."));
        }
      });

    return () => {
      active = false;
    };
  }, [form.mode, form.pessoaContratanteId]);

  useEffect(() => {
    if (!canGeneratePreview(form)) {
      setPreviewHtml("");
      setLoadingPreview(false);
      return;
    }

    let active = true;
    setLoadingPreview(true);

    const timeoutId = window.setTimeout(() => {
      fetchJson<{ html: string }>("/api/documentos/preview", {
        body: JSON.stringify(createDocumentPayload(form, selectedPassengerPeople)),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then((payload) => {
          if (active) {
            setError("");
            setPreviewHtml(payload.html);
          }
        })
        .catch((previewError) => {
          if (active) {
            setPreviewHtml("");
            setError(getErrorMessage(previewError, "Não foi possível gerar a prévia do documento."));
          }
        })
        .finally(() => {
          if (active) {
            setLoadingPreview(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [form, selectedPassengerPeople]);

  function updateField(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetCurrentMode() {
    setError("");
    setPreviewHtml("");
    setLoadingPreview(false);
    setOrcamentoSearch("");
    setOrcamentoSearchResults([]);
    setPersonSearch("");
    setPersonSearchResults(recentPessoas);
    setServiceModalOpen(false);
    setPersonModalMode(null);

    if (form.mode === "orcamento") {
      setForm(createEmptyOrcamentoFormState());
      return;
    }

    setSelectedPassengerPeople([]);
    setForm(createEmptyManualFormState());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await fetchJson<{ id: number }>("/api/documentos", {
        body: JSON.stringify(createDocumentPayload(form, selectedPassengerPeople)),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      router.push(`/documentos/${payload.id}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Não foi possível gerar o documento."));
    } finally {
      setLoading(false);
    }
  }

  async function addPassengerFromBase(personId: string) {
    if (!personId) {
      return;
    }

    try {
      const source = await fetchJson<PessoaDocumentSource>(`/api/documentos/pessoas/${personId}`);
      setSelectedPassengerPeople((current) => upsertPassenger(current, source));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Não foi possível adicionar o passageiro selecionado."));
    }
  }

  function removePassengerFromBase(personId: string) {
    setSelectedPassengerPeople((current) => current.filter((person) => person.id !== personId));
  }

  function openPersonModal(mode: "contratante" | "passageiro") {
    setError("");
    setPersonModalMode(mode);
    setPersonSearch("");
    setPersonSearchResults(recentPessoas);
  }

  function closePersonModal() {
    setPersonModalMode(null);
    setPersonSearch("");
    setPersonSearchResults(recentPessoas);
  }

  function serviceSummary() {
    return [
      form.localizadorReserva.trim() || null,
      form.servicoContratado.trim() || null,
      form.fornecedor.trim() || null,
      form.condicoesTarifarias.trim() || null,
    ].filter(Boolean) as string[];
  }

  async function defineContratanteFromBase(personId: string) {
    if (!personId) {
      return;
    }

    setError("");
    updateField("pessoaContratanteId", personId);

    if (!selectedPassengerPeople.some((person) => person.id === personId)) {
      try {
        const source = await fetchJson<PessoaDocumentSource>(`/api/documentos/pessoas/${personId}`);
        setSelectedPassengerPeople((current) => [source, ...current]);
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Não foi possível adicionar o contratante como passageiro."));
      }
    }

    closePersonModal();
  }

  function handlePersonSelection(option: RecentPessoaDocumentOption) {
    if (personModalMode === "contratante") {
      void defineContratanteFromBase(option.id);
      return;
    }

    if (selectedPassengerPeople.some((person) => person.id === option.id)) {
      removePassengerFromBase(option.id);
      return;
    }

    void addPassengerFromBase(option.id);
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col space-y-5">
        <div
          className={`grid min-h-0 flex-1 gap-4 ${
            "xl:grid-cols-[0.8fr_1.2fr]"
          }`}
        >
          <section className="min-h-0 rounded-[24px] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            {form.mode === "orcamento" ? (
              <div className="flex h-full min-h-0 flex-col gap-4">
                <SearchField
                  label="Buscar orçamento por nome"
                  labelClassName="text-[var(--color-accent)]"
                  inputClassName="bg-[var(--color-panel)]"
                  value={orcamentoSearch}
                  onChange={setOrcamentoSearch}
                  placeholder="Digite o nome do cliente, tag ou ID"
                />

                <div className="min-h-0 flex-1">
                  {orcamentoSearchResults.length > 0 ? (
                    <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-2">
                      <div className="table-scroll min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                        {orcamentoSearchResults.map((option) => (
                          <button
                            key={`orcamento-search-${option.id}`}
                            type="button"
                            onClick={() => {
                              setError("");
                              updateField("orcamentoId", option.id);
                              setOrcamentoSearch(option.cliente_nome ?? option.identificador ?? option.id);
                              setOrcamentoSearchResults([]);
                            }}
                            className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-transparent bg-[var(--color-panel)] px-3 py-3 text-left transition hover:border-[var(--color-accent)]"
                          >
                            <div>
                              <p className="text-sm font-medium text-[var(--color-ink)]">
                                {option.cliente_nome ?? "Sem cliente"}
                              </p>
                              <p className="mt-1 text-xs text-[var(--color-muted)]">
                                {option.identificador ?? "sem-tag"}
                              </p>
                            </div>
                            <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">
                              {option.situacao_nome ?? "Sem situação"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-panel)] px-5 text-center text-sm text-[var(--color-muted)]">
                      Busque por nome, tag ou ID para localizar o orçamento e preencher o contrato automaticamente.
                    </div>
                  )}
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                ) : null}

                <div className="grid grid-cols-[7fr_3fr] gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Gerar documento
                  </button>
                  <button
                    type="button"
                    onClick={resetCurrentMode}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  >
                    Limpar dados
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col gap-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
                  Defina partes e dados do contrato
                </p>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[var(--color-ink)]">
                    <ControlButton icon={<UserRound className="h-4 w-4" />} onClick={() => openPersonModal("contratante")}>
                      Contratante
                    </ControlButton>

                    {form.pessoaContratanteId ? (
                      <RemovableTag
                        onRemove={() => {
                          setError("");
                          updateField("pessoaContratanteId", "");
                          setSelectedPassengerPeople((current) =>
                            current.filter((item) => item.id !== form.pessoaContratanteId),
                          );
                        }}
                      >
                        {toShortPersonName(selectedContratante?.nome || form.pessoaContratanteId)}
                      </RemovableTag>
                    ) : null}
                  </div>
                </div>

                <SectionDivider>
                  <div className="flex flex-wrap items-center gap-2 text-[var(--color-ink)]">
                    <ControlButton icon={<Users className="h-4 w-4" />} onClick={() => openPersonModal("passageiro")}>
                      Passageiros
                    </ControlButton>

                    <div className="table-scroll max-h-20 overflow-auto pr-1">
                      <div className="flex flex-wrap gap-2">
                        {selectedPassengerPeople
                          .filter((person) => person.id !== form.pessoaContratanteId)
                          .map((person) => (
                            <RemovableTag
                              key={person.id}
                              onRemove={() =>
                                setSelectedPassengerPeople((current) =>
                                  current.filter((item) => item.id !== person.id),
                                )
                              }
                            >
                              {toShortPersonName(person.nome ?? person.id)}
                            </RemovableTag>
                          ))}
                      </div>
                    </div>
                  </div>
                </SectionDivider>

                {serviceSummary().length > 0 ? (
                  <SectionDivider>
                    <div className="flex flex-wrap items-center gap-2">
                      <ControlButton icon={<FileText className="h-4 w-4" />} onClick={() => setServiceModalOpen(true)}>
                        Dados do serviço
                      </ControlButton>

                      <div className="table-scroll max-h-20 overflow-auto pr-1">
                        <div className="flex flex-wrap gap-2">
                          {form.localizadorReserva.trim() ? (
                            <RemovableTag onRemove={() => updateField("localizadorReserva", "")}>
                              Localizador: {form.localizadorReserva.trim()}
                            </RemovableTag>
                          ) : null}
                          {form.servicoContratado.trim() ? (
                            <RemovableTag onRemove={() => updateField("servicoContratado", "")}>
                              Serviço: {form.servicoContratado.trim()}
                            </RemovableTag>
                          ) : null}
                          {form.fornecedor.trim() ? (
                            <RemovableTag onRemove={() => updateField("fornecedor", "")}>
                              Fornecedor: {form.fornecedor.trim()}
                            </RemovableTag>
                          ) : null}
                          {form.condicoesTarifarias.trim() ? (
                            <RemovableTag onRemove={() => updateField("condicoesTarifarias", "")}>
                              Condições definidas
                            </RemovableTag>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </SectionDivider>
                ) : (
                  <SectionDivider>
                    <div className="flex flex-wrap items-center gap-2">
                      <ControlButton icon={<FileText className="h-4 w-4" />} onClick={() => setServiceModalOpen(true)}>
                        Dados do serviço
                      </ControlButton>
                    </div>
                  </SectionDivider>
                )}

                {error ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                ) : null}

                <div className="mt-auto grid grid-cols-[7fr_3fr] gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Gerar documento
                  </button>
                  <button
                    type="button"
                    onClick={resetCurrentMode}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  >
                    Limpar dados
                  </button>
                </div>
              </div>
            )}
          </section>

          <PreviewPanel
            emptyMessage={
              form.mode === "orcamento"
                ? "Selecione um orçamento para gerar a prévia automática do contrato."
                : "Selecione o contratante e preencha os dados do serviço para gerar a prévia do contrato."
            }
            html={previewHtml}
            loading={loadingPreview}
            title={form.mode === "orcamento" ? "Preview automático" : "Preview do contrato"}
          />
        </div>
      </form>

      {personModalMode ? (
        <PersonSearchModal
          mode={personModalMode}
          onClose={closePersonModal}
          onSearchChange={setPersonSearch}
          onSelect={handlePersonSelection}
          results={personSearchResults}
          search={personSearch}
          selectedPassengers={selectedPassengerPeople.map((person) => ({
            id: person.id,
            nome: toShortPersonName(person.nome),
          }))}
        />
      ) : null}

      {serviceModalOpen ? (
        <ServiceModal form={form} onClose={() => setServiceModalOpen(false)} onFieldChange={updateField} />
      ) : null}
    </section>
  );
}

function SearchField({
  label,
  labelClassName,
  inputClassName,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  labelClassName?: string;
  inputClassName?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className={`text-xs uppercase tracking-[0.16em] ${labelClassName ?? "text-[var(--color-faint)]"}`}>
        {label}
      </span>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-faint)]" />
        <input
          className={`w-full rounded-2xl border border-[var(--color-line)] py-3 pl-11 pr-4 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)] ${inputClassName ?? "bg-[var(--color-surface)]"}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </div>
    </label>
  );
}

function InputField({
  label,
  maxLength,
  onChange,
  value,
}: {
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
        {label}
      </span>
      <input
        maxLength={maxLength}
        className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
        {label}
      </span>
      <textarea
        rows={4}
        className="mt-2 w-full resize-y rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

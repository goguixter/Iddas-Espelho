"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  LoaderCircle,
  MapPinned,
  Plane,
  Plus,
  RefreshCcw,
  ReceiptText,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type {
  PessoaDocumentSource,
  RecentOrcamentoDocumentOption,
  RecentPessoaDocumentOption,
} from "@/lib/documents/types";

type FormState = {
  bairro: string;
  cancelamentosReembolsos: string;
  cep: string;
  cidade: string;
  condicoesTarifarias: string;
  estado: string;
  fornecedor: string;
  localizadorReserva: string;
  logradouro: string;
  manualContratanteDocumento: string;
  manualContratanteDocumentoLabel: string;
  manualContratanteNome: string;
  mode: "manual" | "orcamento";
  numero: string;
  orcamentoId: string;
  pessoaContratanteId: string;
  remarcacoes: string;
  servicoContratado: string;
};

type ManualPassenger = {
  dataNascimento: string;
  documento: string;
  nome: string;
};

const initialPassenger: ManualPassenger = {
  dataNascimento: "",
  documento: "",
  nome: "",
};

export function DocumentGenerator({
  initialOrcamentoId = "",
  recentOrcamentos,
  recentPessoas,
}: {
  initialOrcamentoId?: string;
  recentOrcamentos: RecentOrcamentoDocumentOption[];
  recentPessoas: RecentPessoaDocumentOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [selectedPassengerId, setSelectedPassengerId] = useState("");
  const [orcamentoSearch, setOrcamentoSearch] = useState("");
  const [orcamentoSearchResults, setOrcamentoSearchResults] = useState<
    RecentOrcamentoDocumentOption[]
  >([]);
  const [selectedPassengerPeople, setSelectedPassengerPeople] = useState<PessoaDocumentSource[]>([]);
  const [manualPassengers, setManualPassengers] = useState<ManualPassenger[]>([]);
  const [form, setForm] = useState<FormState>({
    bairro: "",
    cancelamentosReembolsos: "",
    cep: "",
    cidade: "",
    condicoesTarifarias: "",
    estado: "RS",
    fornecedor: "",
    localizadorReserva: "",
    logradouro: "",
    manualContratanteDocumento: "",
    manualContratanteDocumentoLabel: "CPF",
    manualContratanteNome: "",
    mode: initialOrcamentoId ? "orcamento" : "manual",
    numero: "",
    orcamentoId: initialOrcamentoId,
    pessoaContratanteId: "",
    remarcacoes: "",
    servicoContratado: "Intermediação na compra de passagens aéreas",
  });

  const datalistContratante = useMemo(() => "pessoas-contratante-documentos", []);
  const datalistPassageiros = useMemo(() => "pessoas-passageiros-documentos", []);

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
      fetch(`/api/documentos/orcamentos?q=${encodeURIComponent(query)}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Não foi possível buscar orçamentos.");
          }
          return response.json();
        })
        .then((results: RecentOrcamentoDocumentOption[]) => {
          if (!active) return;
          setOrcamentoSearchResults(results);
        })
        .catch(() => {
          if (!active) return;
          setOrcamentoSearchResults([]);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [form.mode, orcamentoSearch]);

  useEffect(() => {
    if (form.mode !== "orcamento" || !form.orcamentoId.trim()) {
      return;
    }

    let active = true;
    setLoadingSource(true);
    fetch(`/api/documentos/orcamentos/${form.orcamentoId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Não foi possível carregar os dados do orçamento.");
        }
        return response.json();
      })
      .then((source) => {
        if (!active) return;
        setForm((current) => ({
          ...current,
          bairro: current.bairro || source.clienteBairro || "",
          cep: current.cep || source.clienteCep || "",
          cidade: current.cidade || source.clienteCidade || "",
          estado: current.estado || source.clienteEstado || "RS",
          localizadorReserva: current.localizadorReserva || extractString(source.raw?.voos?.[0]?.localizador),
          logradouro: current.logradouro || source.clienteEndereco || "",
          manualContratanteDocumento:
            current.manualContratanteDocumento || source.clienteCpf || "",
          manualContratanteNome: current.manualContratanteNome || source.clienteNome || "",
          numero: current.numero || source.clienteNumero || "",
        }));
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar os dados automáticos do orçamento.");
        }
      })
      .finally(() => {
        if (active) setLoadingSource(false);
      });

    return () => {
      active = false;
    };
  }, [form.mode, form.orcamentoId]);

  useEffect(() => {
    if (form.mode !== "manual" || !form.pessoaContratanteId.trim()) {
      return;
    }

    let active = true;
    setLoadingSource(true);
    fetch(`/api/documentos/pessoas/${form.pessoaContratanteId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Não foi possível carregar a pessoa selecionada.");
        }
        return response.json();
      })
      .then((source: PessoaDocumentSource) => {
        if (!active) return;
        setForm((current) => ({
          ...current,
          bairro: source.bairro || current.bairro,
          cep: source.cep || current.cep,
          cidade: source.cidade || current.cidade,
          estado: source.estado || current.estado || "RS",
          logradouro: source.endereco || current.logradouro,
          manualContratanteDocumento:
            source.cpf || source.passaporte || current.manualContratanteDocumento,
          manualContratanteDocumentoLabel: source.cpf ? "CPF" : "Passaporte",
          manualContratanteNome: source.nome || current.manualContratanteNome,
          numero: source.numero || current.numero,
        }));
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar os dados da pessoa.");
        }
      })
      .finally(() => {
        if (active) setLoadingSource(false);
      });

    return () => {
      active = false;
    };
  }, [form.mode, form.pessoaContratanteId]);

  useEffect(() => {
    if (form.mode !== "orcamento") {
      setPreviewHtml("");
      setLoadingPreview(false);
      return;
    }

    if (
      !form.orcamentoId.trim() ||
      !form.logradouro.trim() ||
      !form.numero.trim() ||
      !form.bairro.trim() ||
      !form.cep.trim() ||
      !form.cidade.trim() ||
      !form.estado.trim()
    ) {
      setPreviewHtml("");
      return;
    }

    let active = true;
    setLoadingPreview(true);

    const timeoutId = window.setTimeout(() => {
      fetch("/api/documentos/preview", {
        body: JSON.stringify({
          ...form,
          manualPassageiros: manualPassengers.filter((item) => item.nome.trim()),
          passageirosPessoaIds: selectedPassengerPeople.map((item) => item.id),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Não foi possível gerar a prévia.");
          }
          return response.json();
        })
        .then((payload: { html: string }) => {
          if (!active) return;
          setPreviewHtml(payload.html);
        })
        .catch(() => {
          if (!active) return;
          setPreviewHtml("");
        })
        .finally(() => {
          if (!active) return;
          setLoadingPreview(false);
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [form, manualPassengers, selectedPassengerPeople]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/documentos", {
        body: JSON.stringify({
          ...form,
          manualPassageiros: manualPassengers.filter((item) => item.nome.trim()),
          passageirosPessoaIds: selectedPassengerPeople.map((item) => item.id),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Não foi possível gerar o documento.");
      }

      const payload = (await response.json()) as { id: number };
      router.push(`/documentos/${payload.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível gerar o documento.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function addPassengerFromBase() {
    const personId = selectedPassengerId.trim();
    if (!personId || selectedPassengerPeople.some((person) => person.id === personId)) {
      return;
    }

    setLoadingSource(true);
    try {
      const response = await fetch(`/api/documentos/pessoas/${personId}`);
      if (!response.ok) {
        throw new Error("Pessoa não encontrada.");
      }
      const source = (await response.json()) as PessoaDocumentSource;
      setSelectedPassengerPeople((current) => [...current, source]);
      setSelectedPassengerId("");
    } catch {
      setError("Não foi possível adicionar o passageiro selecionado.");
    } finally {
      setLoadingSource(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
            Template Base
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-ink)]">
            Contrato de intermediação
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted)]">
            Gere por orçamento com variáveis herdadas automaticamente ou monte manualmente
            usando pessoas da base e campos livres.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-right">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-faint)]">
            Template
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">Contrato v1</p>
        </div>
      </div>

      <div className="mt-5 inline-flex rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-1">
        <ModeButton
          active={form.mode === "orcamento"}
          label="Por orçamento"
          onClick={() => updateField("mode", "orcamento")}
        />
        <ModeButton
          active={form.mode === "manual"}
          label="Manual"
          onClick={() => updateField("mode", "manual")}
        />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div
          className={`grid gap-4 ${
            form.mode === "orcamento"
              ? "xl:grid-cols-[0.8fr_1.2fr]"
              : "xl:grid-cols-[1.15fr_1fr]"
          }`}
        >
          <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <div className="flex items-center gap-2 text-[var(--color-ink)]">
              {form.mode === "orcamento" ? (
                <Plane className="h-4 w-4 text-[var(--color-accent)]" />
              ) : (
                <UserRound className="h-4 w-4 text-[var(--color-accent)]" />
              )}
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">
                {form.mode === "orcamento" ? "Origem do documento" : "Contratante"}
              </h3>
            </div>

            {form.mode === "orcamento" ? (
              <div className="mt-4 space-y-4">
                <SearchField
                  label="Buscar orçamento por nome"
                  value={orcamentoSearch}
                  onChange={setOrcamentoSearch}
                  placeholder="Digite o nome do cliente, tag ou ID"
                />

                {orcamentoSearchResults.length > 0 ? (
                  <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-2">
                    <div className="space-y-2">
                      {orcamentoSearchResults.map((option) => (
                        <button
                          key={`orcamento-search-${option.id}`}
                          type="button"
                          onClick={() => {
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
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {recentOrcamentos.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => updateField("orcamentoId", option.id)}
                      className="cursor-pointer rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-ink)]"
                    >
                      {option.cliente_nome ?? option.identificador ?? "Sem cliente"}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <InputWithDatalist
                  datalistId={datalistContratante}
                  label="Pessoa do contratante"
                  value={form.pessoaContratanteId}
                  onChange={(value) => updateField("pessoaContratanteId", value)}
                  options={recentPessoas.map((option) => ({
                    label: `${option.nome ?? "sem nome"} • ${option.cpf ?? option.id}`,
                    value: option.id,
                  }))}
                  placeholder="ID da pessoa"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <InputField label="Nome manual" value={form.manualContratanteNome} onChange={(value) => updateField("manualContratanteNome", value)} />
                  <InputField label="Documento manual" value={form.manualContratanteDocumento} onChange={(value) => updateField("manualContratanteDocumento", value)} />
                </div>
              </div>
            )}
          </section>

          {form.mode === "orcamento" ? (
            <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <div className="flex items-center justify-between gap-3 text-[var(--color-ink)]">
                <div className="flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-[var(--color-accent)]" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">
                    Preview automático
                  </h3>
                </div>
                {loadingPreview ? (
                  <span className="inline-flex items-center gap-2 text-xs text-[var(--color-muted)]">
                    <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                    Atualizando
                  </span>
                ) : null}
              </div>

              <div className="mt-4 overflow-hidden rounded-[22px] border border-[var(--color-line)] bg-[var(--color-surface)]">
                {previewHtml ? (
                  <iframe
                    title="Prévia do contrato"
                    srcDoc={previewHtml}
                    className="h-[760px] w-full bg-white"
                    style={{ zoom: 0.8 }}
                  />
                ) : (
                  <div className="flex h-[760px] items-center justify-center px-6 text-center text-sm text-[var(--color-muted)]">
                    Selecione um orçamento para gerar a prévia automática do contrato.
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <div className="flex items-center gap-2 text-[var(--color-ink)]">
                <MapPinned className="h-4 w-4 text-[var(--color-accent)]" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">
                  Endereço do contratante
                </h3>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InputField label="Logradouro" value={form.logradouro} onChange={(value) => updateField("logradouro", value)} />
                <InputField label="Número" value={form.numero} onChange={(value) => updateField("numero", value)} />
                <InputField label="Bairro" value={form.bairro} onChange={(value) => updateField("bairro", value)} />
                <InputField label="CEP" value={form.cep} onChange={(value) => updateField("cep", value)} />
                <InputField label="Cidade" value={form.cidade} onChange={(value) => updateField("cidade", value)} />
                <InputField label="Estado" value={form.estado} onChange={(value) => updateField("estado", value.toUpperCase())} maxLength={2} />
              </div>
            </section>
          )}
        </div>

        {form.mode === "manual" ? (
        <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          <div className="flex items-center gap-2 text-[var(--color-ink)]">
            <Users className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">
              Passageiros
            </h3>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                <InputWithDatalist
                  datalistId={datalistPassageiros}
                  label="Adicionar passageiro da base"
                    value={selectedPassengerId}
                    onChange={setSelectedPassengerId}
                    options={recentPessoas.map((option) => ({
                      label: `${option.nome ?? "sem nome"} • ${option.cpf ?? option.id}`,
                      value: option.id,
                    }))}
                    placeholder="ID da pessoa"
                  />
                </div>
                <button
                  type="button"
                  onClick={addPassengerFromBase}
                  className="mt-[26px] inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedPassengerPeople.map((person) => (
                  <span
                    key={person.id}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-ink)]"
                  >
                    {person.nome ?? person.id}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPassengerPeople((current) =>
                          current.filter((item) => item.id !== person.id),
                        )
                      }
                      className="cursor-pointer text-[var(--color-muted)] transition hover:text-rose-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {manualPassengers.map((passenger, index) => (
                <div
                  key={`${index}-${passenger.nome}`}
                  className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3"
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    <InputField
                      label="Nome"
                      value={passenger.nome}
                      onChange={(value) => updateManualPassenger(index, "nome", value, setManualPassengers)}
                    />
                    <InputField
                      label="Documento"
                      value={passenger.documento}
                      onChange={(value) => updateManualPassenger(index, "documento", value, setManualPassengers)}
                    />
                    <InputField
                      label="Nascimento"
                      value={passenger.dataNascimento}
                      onChange={(value) => updateManualPassenger(index, "dataNascimento", value, setManualPassengers)}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setManualPassengers((current) => [...current, { ...initialPassenger }])}
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                <Plus className="h-4 w-4" />
                Adicionar passageiro manual
              </button>
            </div>
          </div>
        </section>
        ) : null}

        {form.mode === "manual" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <div className="flex items-center gap-2 text-[var(--color-ink)]">
              <ReceiptText className="h-4 w-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">
                Dados variáveis do serviço
              </h3>
            </div>

            <div className="mt-4 grid gap-3">
              <InputField label="Localizador da reserva" value={form.localizadorReserva} onChange={(value) => updateField("localizadorReserva", value)} />
              <InputField label="Serviço contratado" value={form.servicoContratado} onChange={(value) => updateField("servicoContratado", value)} />
              <InputField label="Fornecedor" value={form.fornecedor} onChange={(value) => updateField("fornecedor", value)} />
              <TextAreaField label="Condições tarifárias" value={form.condicoesTarifarias} onChange={(value) => updateField("condicoesTarifarias", value)} />
              <TextAreaField label="Remarcações" value={form.remarcacoes} onChange={(value) => updateField("remarcacoes", value)} />
              <TextAreaField label="Cancelamentos/Reembolsos" value={form.cancelamentosReembolsos} onChange={(value) => updateField("cancelamentosReembolsos", value)} />
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <div className="flex items-center gap-2 text-[var(--color-ink)]">
              <FileText className="h-4 w-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">
                Geração do documento
              </h3>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted)]">
              {loadingSource
                ? "Carregando dados automáticos..."
                : "A cidade será sempre Novo Hamburgo e a data será preenchida automaticamente com o dia da geração do contrato."}
            </div>

            <div className="mt-3 rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted)]">
              O documento será salvo com snapshot HTML estático e poderá ser impresso em PDF depois.
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}
          </section>
        </div>
        ) : (
          <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted)]">
              {loadingSource
                ? "Carregando dados automáticos..."
                : "A prévia usa as variáveis herdadas do orçamento. Cidade e data são aplicadas automaticamente no documento final."}
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}
          </section>
        )}

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
      </form>
    </section>
  );
}

function updateManualPassenger(
  index: number,
  key: keyof ManualPassenger,
  value: string,
  setState: Dispatch<SetStateAction<ManualPassenger[]>>,
) {
  setState((current) =>
    current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item,
    ),
  );
}

function extractString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-xl px-4 py-2 text-sm transition ${
        active
          ? "bg-[var(--color-accent)] font-semibold text-slate-950"
          : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      {label}
    </button>
  );
}

function InputWithDatalist({
  datalistId,
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  datalistId: string;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
        {label}
      </span>
      <input
        list={datalistId}
        className="mt-2 w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <datalist id={datalistId}>
        {options.map((option) => (
          <option key={`${datalistId}-${option.value}`} value={option.value} label={option.label} />
        ))}
      </datalist>
    </label>
  );
}

function SearchField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
        {label}
      </span>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-faint)]" />
        <input
          className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] py-3 pl-11 pr-4 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)]"
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

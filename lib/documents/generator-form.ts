import type { PessoaDocumentSource } from "@/lib/documents/types";

export type DocumentGeneratorMode = "manual" | "orcamento";

export type DocumentGeneratorFormState = {
  bairro: string;
  cep: string;
  cidade: string;
  condicoesTarifarias: string;
  estado: string;
  fornecedor: string;
  localizadorReserva: string;
  logradouro: string;
  mode: DocumentGeneratorMode;
  numero: string;
  orcamentoId: string;
  pessoaContratanteId: string;
  servicoContratado: string;
};

export type OrcamentoAutofillSource = {
  clienteBairro?: string | null;
  clienteCep?: string | null;
  clienteCidade?: string | null;
  clienteCpf?: string | null;
  clienteEndereco?: string | null;
  clienteEstado?: string | null;
  clienteNome?: string | null;
  clienteNumero?: string | null;
  raw?: Record<string, unknown> | null;
};

export const EMPTY_AUTOFILL_FIELDS = {
  bairro: "",
  cep: "",
  cidade: "",
  estado: "",
  localizadorReserva: "",
  logradouro: "",
  numero: "",
} as const;

export function createInitialFormState(
  forcedMode: DocumentGeneratorMode | undefined,
  initialOrcamentoId: string,
): DocumentGeneratorFormState {
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

export function createEmptyManualFormState() {
  return createInitialFormState("manual", "");
}

export function createEmptyOrcamentoFormState() {
  return createInitialFormState("orcamento", "");
}

export function createDocumentPayload(
  form: DocumentGeneratorFormState,
  passageiros: PessoaDocumentSource[],
) {
  return {
    ...form,
    passageirosPessoaIds: passageiros.map((item) => item.id),
  };
}

export function hasCompleteAddress(form: DocumentGeneratorFormState) {
  return [
    form.logradouro,
    form.numero,
    form.bairro,
    form.cep,
    form.cidade,
    form.estado,
  ].every((value) => value.trim());
}

export function canGeneratePreview(form: DocumentGeneratorFormState) {
  if (!hasCompleteAddress(form)) {
    return false;
  }

  if (form.mode === "orcamento") {
    return Boolean(form.orcamentoId.trim());
  }

  return Boolean(form.pessoaContratanteId.trim());
}

export function applyOrcamentoAutofill(
  current: DocumentGeneratorFormState,
  source: OrcamentoAutofillSource,
) {
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

export function applyPessoaAutofill(
  current: DocumentGeneratorFormState,
  source: PessoaDocumentSource,
) {
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

export function upsertPassenger(
  current: PessoaDocumentSource[],
  source: PessoaDocumentSource,
) {
  return current.some((person) => person.id === source.id) ? current : [...current, source];
}

export function toShortPersonName(value: string | null | undefined) {
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

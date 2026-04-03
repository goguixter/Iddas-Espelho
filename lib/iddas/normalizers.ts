import type { IddasObject } from "@/lib/iddas/client";
import { createHash } from "node:crypto";
import {
  pickReferenceId,
  readId,
  readString,
  requireString,
} from "@/lib/iddas/accessors";

export type OrcamentoRecord = {
  cliente_pessoa_id: string | null;
  created_at_source: string | null;
  detail_synced_at: string;
  id: string;
  identificador: string | null;
  last_seen_at: string;
  needs_detail: number;
  passageiro_count: number;
  passageiro_ids_json: string;
  raw_json: string;
  raw_summary_json: string;
  source_hash: string;
  source_updated_at: string | null;
  situacao_codigo: string | null;
  situacao_cor: string | null;
  situacao_nome: string | null;
  synced_at: string;
  updated_at: string;
};

export type PessoaRecord = {
  bairro: string | null;
  celular: string | null;
  cep: string | null;
  cidade: string | null;
  complemento: string | null;
  cpf: string | null;
  created_at_source: string | null;
  detail_synced_at: string | null;
  email: string | null;
  endereco: string | null;
  estado: string | null;
  id: string;
  last_seen_at: string | null;
  nascimento: string | null;
  nome: string | null;
  needs_detail: number;
  numero: string | null;
  pais_endereco: string | null;
  passaporte: string | null;
  raw_json: string;
  rg: string | null;
  sexo: string | null;
  source_hash: string | null;
  source_updated_at: string | null;
  synced_at: string;
  tipo_cliente: string | null;
  tipo_fornecedor: string | null;
  tipo_passageiro: string | null;
  tipo_representante: string | null;
  updated_at: string;
};

export type VendaRecord = {
  id: string;
  orcamento_id: string;
  orcamento_identificador: string | null;
  raw_json: string;
  status: string | null;
  synced_at: string;
  updated_at: string;
};

export type CompanhiaRecord = {
  companhia: string | null;
  iata: string | null;
  id: string;
  nome: string | null;
  raw_json: string;
  synced_at: string;
  updated_at: string;
};

export type VooRecord = {
  aeroporto_destino: string | null;
  aeroporto_origem: string | null;
  bagagem_bolsa: string | null;
  bagagem_demao: string | null;
  bagagem_despachada: string | null;
  classe: string | null;
  cliente_pessoa_id: string | null;
  companhia_id: string | null;
  companhia_nome: string | null;
  data_chegada: string | null;
  data_embarque: string | null;
  duracao: string | null;
  hora_chegada: string | null;
  hora_embarque: string | null;
  id: string;
  localizador: string | null;
  numero_compra: string | null;
  observacao: string | null;
  orcamento_id: string;
  orcamento_identificador: string | null;
  qtd_paradas: string | null;
  raw_json: string;
  synced_at: string;
  tipo_trecho: string | null;
  titulo_orcamento: string | null;
  updated_at: string;
  voo: string | null;
};

export type SolicitacaoRecord = {
  adultos: string | null;
  criancas: string | null;
  data_ida: string | null;
  data_solicitacao: string | null;
  data_volta: string | null;
  detail_synced_at: string;
  destino: string | null;
  email: string | null;
  id: string;
  last_seen_at: string;
  linked_orcamento_id: string | null;
  linked_orcamento_identificador: string | null;
  match_reason: string | null;
  match_status: string;
  needs_detail: number;
  nome: string | null;
  observacao: string | null;
  origem: string | null;
  possui_flexibilidade: string | null;
  raw_json: string;
  raw_summary_json: string;
  source_hash: string;
  source_updated_at: string | null;
  synced_at: string;
  telefone: string | null;
  updated_at: string;
};

export type SituacaoRecord = {
  codigo: string | null;
  cor: string | null;
  id: string;
  nome: string | null;
  ordem: string | null;
  raw_json: string;
  situacao_final: string | null;
  situacao_padrao: string | null;
  synced_at: string;
  updated_at: string;
};

export function normalizeOrcamento(detail: IddasObject, syncedAt: string): OrcamentoRecord {
  const rawJson = JSON.stringify(detail);
  const sourceUpdatedAt =
    readString(detail.updated_at) ??
    readString(detail.data_alteracao) ??
    readString(detail.data_ultima_situacao) ??
    readString(detail.data_orcamento);
  const clientePessoaId = pickReferenceId(detail, [
    "cliente",
    "cliente.pessoa_id",
    "cliente.id",
    "cliente_id",
    "pessoa",
    "pessoa.id",
    "pessoa_id",
  ]);
  const passageiroPessoaIds = extractPassengerPersonIds(detail);
  const passengerCount =
    passageiroPessoaIds.length > 0
      ? passageiroPessoaIds.length
      : extractPassengerCount(detail);

  return {
    id: requireString(readId(detail), "orcamento.id"),
    identificador:
      readString(detail.identificador) ??
      readString(detail.codigo) ??
      readString(detail.orcamento),
    created_at_source:
      readString(detail.created_at) ??
      readString(detail.data_criacao) ??
      readString(detail.data_orcamento),
    cliente_pessoa_id: clientePessoaId,
    situacao_codigo:
      readString(detail.situacao) ??
      readString(detail.codigo_situacao),
    situacao_cor:
      readString(detail.cor_situacao) ??
      readString(detail.situacao_cor),
    situacao_nome:
      readString(detail.nome_situacao) ??
      readString(detail.situacao_nome),
    passageiro_ids_json: JSON.stringify(passageiroPessoaIds),
    passageiro_count: passengerCount,
    raw_summary_json: rawJson,
    raw_json: rawJson,
    source_hash: hashPayload(rawJson),
    source_updated_at: sourceUpdatedAt,
    last_seen_at: syncedAt,
    detail_synced_at: syncedAt,
    needs_detail: 0,
    updated_at: sourceUpdatedAt ?? syncedAt,
    synced_at: syncedAt,
  };
}

export function normalizeOrcamentoSummary(
  summary: IddasObject,
  syncedAt: string,
): Pick<
  OrcamentoRecord,
  | "cliente_pessoa_id"
  | "created_at_source"
  | "id"
  | "identificador"
  | "last_seen_at"
  | "needs_detail"
  | "raw_json"
  | "raw_summary_json"
  | "source_hash"
  | "source_updated_at"
  | "situacao_codigo"
  | "situacao_cor"
  | "situacao_nome"
  | "synced_at"
  | "updated_at"
> {
  const rawSummaryJson = JSON.stringify(summary);
  const sourceUpdatedAt =
    readString(summary.updated_at) ??
    readString(summary.data_alteracao) ??
    readString(summary.data_ultima_situacao) ??
    readString(summary.data_orcamento);

  return {
    id: requireString(readId(summary), "orcamento.id"),
    identificador:
      readString(summary.identificador) ??
      readString(summary.codigo) ??
      readString(summary.orcamento),
    created_at_source:
      readString(summary.created_at) ??
      readString(summary.data_criacao) ??
      readString(summary.data_orcamento),
    cliente_pessoa_id: pickReferenceId(summary, [
      "cliente",
      "cliente.pessoa_id",
      "cliente.id",
      "cliente_id",
      "pessoa",
      "pessoa.id",
      "pessoa_id",
    ]),
    situacao_codigo:
      readString(summary.situacao) ??
      readString(summary.codigo_situacao),
    situacao_cor:
      readString(summary.cor_situacao) ??
      readString(summary.situacao_cor),
    situacao_nome:
      readString(summary.nome_situacao) ??
      readString(summary.situacao_nome),
    raw_summary_json: rawSummaryJson,
    raw_json: rawSummaryJson,
    source_hash: hashPayload(rawSummaryJson),
    source_updated_at: sourceUpdatedAt,
    last_seen_at: syncedAt,
    needs_detail: 0,
    updated_at: sourceUpdatedAt ?? syncedAt,
    synced_at: syncedAt,
  };
}

export function normalizeSituacao(detail: IddasObject, syncedAt: string): SituacaoRecord {
  return {
    codigo: readString(detail.codigo),
    cor: readString(detail.cor),
    id: requireString(readId(detail), "situacao.id"),
    nome: readString(detail.nome),
    ordem: readString(detail.ordem),
    raw_json: JSON.stringify(detail),
    situacao_final: readString(detail.situacao_final),
    situacao_padrao: readString(detail.situacao_padrao),
    updated_at:
      readString(detail.updated_at) ??
      readString(detail.data_alteracao) ??
      syncedAt,
    synced_at: syncedAt,
  };
}

export function normalizePessoa(detail: IddasObject, syncedAt: string): PessoaRecord {
  const rawJson = JSON.stringify(detail);
  const sourceUpdatedAt =
    readString(detail.updated_at) ??
    readString(detail.data_alteracao) ??
    syncedAt;

  return {
    bairro: readString(detail.bairro),
    celular: readString(detail.celular) ?? readString(detail.telefone),
    cep: readString(detail.cep),
    cidade: readString(detail.cidade),
    complemento: readString(detail.complemento),
    id: requireString(readId(detail), "pessoa.id"),
    nome:
      readString(detail.nome) ??
      readString(detail.nome_completo) ??
      readString(detail.razao_social),
    email: readString(detail.email),
    cpf:
      readString(detail.cpf) ??
      readString(detail.cpf_cnpj) ??
      readString(detail.documento),
    created_at_source:
      readString(detail.created_at) ??
      readString(detail.data_criacao),
    detail_synced_at: syncedAt,
    endereco:
      readString(detail.endereco) ??
      readString(detail.logradouro),
    estado: readString(detail.estado),
    last_seen_at: syncedAt,
    nascimento: readString(detail.nascimento),
    needs_detail: 0,
    numero: readString(detail.numero),
    pais_endereco: readString(detail.pais_endereco),
    passaporte: readString(detail.passaporte),
    raw_json: rawJson,
    rg: readString(detail.rg),
    sexo: readString(detail.sexo),
    source_hash: hashPayload(rawJson),
    source_updated_at: sourceUpdatedAt,
    synced_at: syncedAt,
    tipo_cliente: readString(detail.tipo_cliente),
    tipo_fornecedor: readString(detail.tipo_fornecedor),
    tipo_passageiro: readString(detail.tipo_passageiro),
    tipo_representante: readString(detail.tipo_representante),
    updated_at: sourceUpdatedAt,
  };
}

export function normalizePessoaSummary(
  summary: IddasObject,
  syncedAt: string,
): Pick<
  PessoaRecord,
  | "bairro"
  | "celular"
  | "cep"
  | "cidade"
  | "complemento"
  | "cpf"
  | "created_at_source"
  | "detail_synced_at"
  | "email"
  | "endereco"
  | "estado"
  | "id"
  | "last_seen_at"
  | "nascimento"
  | "needs_detail"
  | "nome"
  | "numero"
  | "pais_endereco"
  | "passaporte"
  | "raw_json"
  | "rg"
  | "sexo"
  | "source_hash"
  | "source_updated_at"
  | "synced_at"
  | "tipo_cliente"
  | "tipo_fornecedor"
  | "tipo_passageiro"
  | "tipo_representante"
  | "updated_at"
> {
  const rawJson = JSON.stringify(summary);
  const sourceUpdatedAt =
    readString(summary.updated_at) ??
    readString(summary.data_alteracao) ??
    syncedAt;

  return {
    bairro: readString(summary.bairro),
    celular: readString(summary.celular) ?? readString(summary.telefone),
    cep: readString(summary.cep),
    cidade: readString(summary.cidade),
    complemento: readString(summary.complemento),
    cpf:
      readString(summary.cpf) ??
      readString(summary.cpf_cnpj) ??
      readString(summary.documento),
    created_at_source:
      readString(summary.created_at) ??
      readString(summary.data_criacao),
    detail_synced_at: null,
    email: readString(summary.email),
    endereco:
      readString(summary.endereco) ??
      readString(summary.logradouro),
    estado: readString(summary.estado),
    id: requireString(readId(summary), "pessoa.id"),
    last_seen_at: syncedAt,
    nascimento: readString(summary.nascimento),
    needs_detail: 0,
    nome:
      readString(summary.nome) ??
      readString(summary.nome_completo) ??
      readString(summary.razao_social),
    numero: readString(summary.numero),
    pais_endereco: readString(summary.pais_endereco),
    passaporte: readString(summary.passaporte),
    raw_json: rawJson,
    rg: readString(summary.rg),
    sexo: readString(summary.sexo),
    source_hash: hashPayload(rawJson),
    source_updated_at: sourceUpdatedAt,
    synced_at: syncedAt,
    tipo_cliente: readString(summary.tipo_cliente),
    tipo_fornecedor: readString(summary.tipo_fornecedor),
    tipo_passageiro: readString(summary.tipo_passageiro),
    tipo_representante: readString(summary.tipo_representante),
    updated_at: sourceUpdatedAt,
  };
}

export function normalizeVenda(
  detail: IddasObject,
  orcamentoId: string,
  orcamentoIdentificador: string | null,
  syncedAt: string,
): VendaRecord {
  return {
    id: requireString(readId(detail), "venda.id"),
    orcamento_id: orcamentoId,
    orcamento_identificador:
      readString(detail.orcamento) ??
      readString(detail.identificador_orcamento) ??
      readString(detail.orcamento_identificador) ??
      orcamentoIdentificador,
    status:
      readString(detail.status) ??
      readString(detail.situacao) ??
      readString(detail.status_venda),
    raw_json: JSON.stringify(detail),
    updated_at:
      readString(detail.updated_at) ??
      readString(detail.data_alteracao) ??
      syncedAt,
    synced_at: syncedAt,
  };
}

export function normalizeCompanhia(detail: IddasObject, syncedAt: string): CompanhiaRecord {
  return {
    companhia:
      readString(detail.companhia) ??
      readString(detail.nome),
    iata: readString(detail.iata),
    id: requireString(readId(detail), "companhia.id"),
    nome: readString(detail.nome),
    raw_json: JSON.stringify(detail),
    synced_at: syncedAt,
    updated_at:
      readString(detail.updated_at) ??
      readString(detail.data_alteracao) ??
      syncedAt,
  };
}

export function normalizeVoo(detail: IddasObject, syncedAt: string): VooRecord {
  return {
    aeroporto_destino: readString(detail.aeroporto_destino),
    aeroporto_origem: readString(detail.aeroporto_origem),
    bagagem_bolsa: readString(detail.bagagem_bolsa),
    bagagem_demao: readString(detail.bagagem_demao),
    bagagem_despachada: readString(detail.bagagem_despachada),
    classe: readString(detail.classe),
    cliente_pessoa_id: pickReferenceId(detail, [
      "cliente",
      "cliente_id",
      "cliente.id",
      "cliente.pessoa_id",
      "pessoa",
      "pessoa.id",
    ]),
    companhia_id:
      readString(detail.id_companhia) ??
      readString(detail.companhia_id),
    companhia_nome:
      readString(detail.companhia) ??
      readString(detail.nome_companhia),
    data_chegada: readString(detail.data_chegada),
    data_embarque: readString(detail.data_embarque),
    duracao: readString(detail.duracao),
    hora_chegada: readString(detail.hora_chegada),
    hora_embarque: readString(detail.hora_embarque),
    id: requireString(readId(detail), "voo.id"),
    localizador: readString(detail.localizador),
    numero_compra: readString(detail.numero_compra),
    observacao: readString(detail.observacao),
    orcamento_id:
      requireString(
        readString(detail.id_orcamento) ??
          readString(detail.orcamento_id) ??
          readString(detail.orcamento),
        "voo.id_orcamento",
      ),
    orcamento_identificador:
      readString(detail.identificador_orcamento) ??
      readString(detail.orcamento_identificador),
    qtd_paradas: readString(detail.qtd_paradas),
    raw_json: JSON.stringify(detail),
    synced_at: syncedAt,
    tipo_trecho: readString(detail.tipo_trecho),
    titulo_orcamento: readString(detail.titulo_orcamento),
    updated_at:
      readString(detail.updated_at) ??
      readString(detail.data_alteracao) ??
      syncedAt,
    voo: readString(detail.voo),
  };
}

export function normalizeSolicitacao(
  detail: IddasObject,
  syncedAt: string,
): SolicitacaoRecord {
  const rawJson = JSON.stringify(detail);
  const sourceUpdatedAt =
    readString(detail.updated_at) ??
    readString(detail.data_solicitacao);
  return {
    adultos:
      readString(detail.adultos) ??
      readString(detail.passageiro_adulto),
    criancas:
      readString(detail.criancas) ??
      readString(detail.passageiro_crianca),
    data_ida: readString(detail.data_ida),
    data_solicitacao: readString(detail.data_solicitacao),
    data_volta: readString(detail.data_volta),
    destino: readString(detail.destino),
    email: readString(detail.email),
    id: requireString(readId(detail), "solicitacao.id"),
    linked_orcamento_id: null,
    linked_orcamento_identificador: null,
    match_reason: null,
    match_status: "unmatched",
    nome: readString(detail.nome),
    observacao: readString(detail.observacao),
    origem: readString(detail.origem),
    possui_flexibilidade:
      readString(detail.possui_flexibilidade) ??
      readString(detail.flexibilidade),
    raw_summary_json: rawJson,
    raw_json: rawJson,
    source_hash: hashPayload(rawJson),
    source_updated_at: sourceUpdatedAt,
    last_seen_at: syncedAt,
    detail_synced_at: syncedAt,
    needs_detail: 0,
    synced_at: syncedAt,
    telefone: readString(detail.telefone),
    updated_at: sourceUpdatedAt ?? syncedAt,
  };
}

export function normalizeSolicitacaoSummary(
  summary: IddasObject,
  syncedAt: string,
): Pick<
  SolicitacaoRecord,
  | "adultos"
  | "criancas"
  | "data_ida"
  | "data_solicitacao"
  | "data_volta"
  | "destino"
  | "email"
  | "id"
  | "last_seen_at"
  | "linked_orcamento_id"
  | "linked_orcamento_identificador"
  | "match_reason"
  | "match_status"
  | "needs_detail"
  | "nome"
  | "observacao"
  | "origem"
  | "possui_flexibilidade"
  | "raw_json"
  | "raw_summary_json"
  | "source_hash"
  | "source_updated_at"
  | "synced_at"
  | "telefone"
  | "updated_at"
> {
  const rawSummaryJson = JSON.stringify(summary);
  const sourceUpdatedAt =
    readString(summary.updated_at) ??
    readString(summary.data_solicitacao);

  return {
    adultos:
      readString(summary.adultos) ??
      readString(summary.passageiro_adulto),
    criancas:
      readString(summary.criancas) ??
      readString(summary.passageiro_crianca),
    data_ida: readString(summary.data_ida),
    data_solicitacao: readString(summary.data_solicitacao),
    data_volta: readString(summary.data_volta),
    destino: readString(summary.destino),
    email: readString(summary.email),
    id: requireString(readId(summary), "solicitacao.id"),
    last_seen_at: syncedAt,
    linked_orcamento_id: null,
    linked_orcamento_identificador: null,
    match_reason: null,
    match_status: "unmatched",
    needs_detail: 0,
    nome: readString(summary.nome),
    observacao: readString(summary.observacao),
    origem: readString(summary.origem),
    possui_flexibilidade:
      readString(summary.possui_flexibilidade) ??
      readString(summary.flexibilidade),
    raw_summary_json: rawSummaryJson,
    raw_json: rawSummaryJson,
    source_hash: hashPayload(rawSummaryJson),
    source_updated_at: sourceUpdatedAt,
    synced_at: syncedAt,
    telefone: readString(summary.telefone),
    updated_at: sourceUpdatedAt ?? syncedAt,
  };
}

function extractPassengerPersonIds(detail: IddasObject) {
  const groups = [detail.passageiros, detail.passageiro, detail.viajantes];

  for (const group of groups) {
    if (!Array.isArray(group)) {
      continue;
    }

    return group
      .map((entry) => {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          return pickReferenceId(entry as IddasObject, [
            "id_pessoa",
            "pessoa.id",
            "pessoa_id",
            "cliente.id",
            "cliente_id",
          ]);
        }

        return null;
      })
      .filter((value): value is string => Boolean(value));
  }

  return [];
}

function hashPayload(payload: string) {
  return createHash("sha1").update(payload).digest("hex");
}

function extractPassengerCount(detail: IddasObject) {
  const counts = [
    detail.passageiros_adulto,
    detail.passageiros_crianca,
    detail.passageiros_bebe,
  ].map(toInteger);

  return counts.reduce((sum, value) => sum + value, 0);
}

function toInteger(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;

  return Number.isFinite(parsed) ? parsed : 0;
}

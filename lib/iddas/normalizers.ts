import type { IddasObject } from "@/lib/iddas/client";
import {
  pickReferenceId,
  readId,
  readString,
  requireString,
} from "@/lib/iddas/accessors";

export type OrcamentoRecord = {
  cliente_pessoa_id: string | null;
  id: string;
  identificador: string | null;
  passageiro_count: number;
  passageiro_ids_json: string;
  raw_json: string;
  synced_at: string;
  updated_at: string;
};

export type PessoaRecord = {
  cpf: string | null;
  email: string | null;
  id: string;
  nome: string | null;
  raw_json: string;
  synced_at: string;
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

export function normalizeOrcamento(detail: IddasObject, syncedAt: string): OrcamentoRecord {
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
    cliente_pessoa_id: clientePessoaId,
    passageiro_ids_json: JSON.stringify(passageiroPessoaIds),
    passageiro_count: passengerCount,
    raw_json: JSON.stringify(detail),
    updated_at:
      readString(detail.updated_at) ??
      readString(detail.data_alteracao) ??
      syncedAt,
    synced_at: syncedAt,
  };
}

export function normalizePessoa(detail: IddasObject, syncedAt: string): PessoaRecord {
  return {
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
    raw_json: JSON.stringify(detail),
    updated_at:
      readString(detail.updated_at) ??
      readString(detail.data_alteracao) ??
      syncedAt,
    synced_at: syncedAt,
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

export function extractPersonIdsFromOrcamento(orcamento: OrcamentoRecord) {
  const ids = new Set<string>();

  if (orcamento.cliente_pessoa_id) {
    ids.add(orcamento.cliente_pessoa_id);
  }

  for (const personId of JSON.parse(orcamento.passageiro_ids_json) as string[]) {
    ids.add(personId);
  }

  return [...ids];
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

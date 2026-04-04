import { pickReferenceId, readString } from "@/lib/iddas/accessors";
import type { IddasObject } from "@/lib/iddas/client";

export type MirrorStateRow = {
  detail_synced_at: string | null;
  id: string;
  source_hash: string | null;
  source_updated_at: string | null;
};

export type PessoaReference = {
  cpf: string | null;
  email: string | null;
  id: string;
  nome: string | null;
};

export type SyncTaskType = "pessoa" | "venda_orcamento";

export type SyncTaskRow = {
  attempts: number;
  entity_id: string;
  id: number;
  parent_id: string | null;
  payload_json: string;
  task_key: string;
  task_type: SyncTaskType;
};

export function isSyncCancelledError(error: unknown) {
  return error instanceof Error && error.message === "SYNC_CANCELLED";
}

export function getSyncErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Falha inesperada no sync.";
}

export function shouldRefreshDetail(
  existing: MirrorStateRow | null,
  nextHash: string,
  nextSourceUpdatedAt: string | null,
) {
  if (!existing) {
    return true;
  }

  if (!existing.detail_synced_at) {
    return true;
  }

  if (existing.source_hash !== nextHash) {
    return true;
  }

  return (existing.source_updated_at ?? null) !== (nextSourceUpdatedAt ?? null);
}

export function readPendingIds(statement: { all(): unknown[] }) {
  return (statement.all() as Array<{ id: string }>).map((row) => row.id);
}

export function parseTaskPayload(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function extractReferencedPeople(
  detail: Record<string, unknown>,
  orcamento: { cliente_pessoa_id: string | null },
) {
  const references = new Map<string, PessoaReference>();

  if (orcamento.cliente_pessoa_id) {
    references.set(orcamento.cliente_pessoa_id, {
      cpf:
        readString(detail.cpf_cliente) ??
        readString(detail.cpf),
      email: readString(detail.email_cliente),
      id: orcamento.cliente_pessoa_id,
      nome: readString(detail.nome_cliente),
    });
  }

  for (const group of [detail.passageiros, detail.passageiro, detail.viajantes]) {
    if (!Array.isArray(group)) {
      continue;
    }

    for (const entry of group) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        continue;
      }

      const item = entry as IddasObject;
      const personId = pickReferenceId(item, [
        "id_pessoa",
        "pessoa.id",
        "pessoa_id",
        "cliente.id",
        "cliente_id",
      ]);

      if (!personId) {
        continue;
      }

      references.set(personId, mergePessoaReference(references.get(personId), {
        cpf:
          readString(item.cpf) ??
          readString(item.cpf_cnpj) ??
          readString(item.documento),
        email: readString(item.email),
        id: personId,
        nome:
          readString(item.nome) ??
          readString(item.nome_completo),
      }));
    }
  }

  return [...references.values()];
}

export function mergePessoaReference(
  current: PessoaReference | undefined,
  next: PessoaReference,
): PessoaReference {
  if (!current) {
    return next;
  }

  return {
    cpf: current.cpf ?? next.cpf,
    email: current.email ?? next.email,
    id: current.id,
    nome: current.nome ?? next.nome,
  };
}

export function shouldRefreshPessoa(
  existing:
    | {
        celular: string | null;
        cpf: string | null;
        email: string | null;
        id: string;
        nascimento: string | null;
        nome: string | null;
        tipo_cliente: string | null;
        tipo_fornecedor: string | null;
        tipo_passageiro: string | null;
        tipo_representante: string | null;
      }
    | undefined,
  reference: PessoaReference,
) {
  if (!existing) {
    return true;
  }

  return (
    isDifferentComparableText(existing.nome, reference.nome) ||
    isDifferentComparableText(existing.email, reference.email) ||
    isDifferentComparableDocument(existing.cpf, reference.cpf)
  );
}

export function isApprovedOrcamento(orcamento: {
  situacao_codigo: string | null;
  situacao_nome: string | null;
}) {
  return (
    normalizeComparableText(orcamento.situacao_codigo) === "a" ||
    normalizeComparableText(orcamento.situacao_nome) === "aprovado"
  );
}

export function isDifferentComparableText(current: string | null, next: string | null) {
  if (!next || !next.trim()) {
    return false;
  }

  return normalizeComparableText(current) !== normalizeComparableText(next);
}

export function isDifferentComparableDocument(current: string | null, next: string | null) {
  if (!next || !next.trim()) {
    return false;
  }

  return normalizeDocument(current) !== normalizeDocument(next);
}

export function normalizeComparableText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeDocument(value: string | null | undefined) {
  return (value ?? "").replace(/\D+/g, "");
}

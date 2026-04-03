import {
  buildContractDocument,
  buildManualContractDocument,
} from "@/lib/documents/contract-template";
import {
  getOrcamentoDocumentSource,
  getPessoaDocumentSource,
} from "@/lib/documents/repository";
import type { DocumentRequestInput } from "@/lib/documents/schema";

export class DocumentDraftError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function resolveDocumentDraft(payload: DocumentRequestInput) {
  if (payload.mode === "orcamento") {
    if (!payload.orcamentoId?.trim()) {
      throw new DocumentDraftError("Selecione um orçamento para gerar o documento.", 400);
    }

    const source = getOrcamentoDocumentSource(payload.orcamentoId);

    if (!source) {
      throw new DocumentDraftError("Orçamento não encontrado para gerar o documento.", 404);
    }

    return {
      document: buildContractDocument(source, payload),
      entityId: source.id,
      entityType: "orcamento",
    } as const;
  }

  const contratante = payload.pessoaContratanteId
    ? getPessoaDocumentSource(payload.pessoaContratanteId)
    : null;
  const passageiros = (payload.passageirosPessoaIds ?? [])
    .map((id) => getPessoaDocumentSource(id))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  if (!contratante) {
    throw new DocumentDraftError(
      "Selecione uma pessoa como contratante para gerar o documento.",
      400,
    );
  }

  return {
    document: buildManualContractDocument(payload, {
      contratante,
      passageiros,
    }),
    entityId: payload.pessoaContratanteId?.trim() || payload.orcamentoId?.trim() || "manual",
    entityType: "manual",
  } as const;
}

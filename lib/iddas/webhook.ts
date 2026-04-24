import { readNestedString, readString, toObject } from "@/lib/object-utils";

type IddasWebhookEntityType =
  | "checkin"
  | "cotacao"
  | "pessoa"
  | "solicitacao"
  | "tarefa"
  | "unknown";

type IddasWebhookSummary = {
  entityId: string | null;
  entityType: IddasWebhookEntityType;
  eventName: string | null;
  headersJson: string;
  occurredAt: string | null;
  orcamentoId: string | null;
  payloadJson: string;
  statusCode: string | null;
  statusLabel: string | null;
};

export function summarizeIddasWebhook(
  rawText: string,
  headers: Headers,
  payload: unknown,
): IddasWebhookSummary {
  const body = toObject(payload);

  return {
    entityId: normalizeString(body?.id) ?? normalizeString(body?.identificador),
    entityType: inferIddasWebhookEntityType(body),
    eventName: normalizeString(body?.evento),
    headersJson: JSON.stringify(Object.fromEntries(headers.entries())),
    occurredAt:
      normalizeString(body?.data_hora_evento) ??
      normalizeString(body?.data_solicitacao) ??
      normalizeString(body?.data_cadastro),
    orcamentoId: normalizeString(body?.id_orcamento),
    payloadJson: rawText,
    statusCode: readNestedString(body, ["situacao", "codigo"]),
    statusLabel: readNestedString(body, ["situacao", "descricao"]),
  };
}

function inferIddasWebhookEntityType(
  body: Record<string, unknown> | null,
): IddasWebhookEntityType {
  if (!body) {
    return "unknown";
  }

  if ("data_cadastro" in body || "aceita_comunicacao" in body || "passaporte" in body) {
    return "pessoa";
  }

  if ("data_solicitacao" in body || "servicos_adicionais" in body || "cupom_desconto" in body) {
    return "solicitacao";
  }

  if ("data_hora_evento" in body || "situacao" in body || "cliente" in body || "passageiro" in body) {
    return "cotacao";
  }

  if ("data_embarque" in body || "localizador" in body || "companhia" in body || "classe" in body) {
    return "checkin";
  }

  if ("assunto" in body || "descricao" in body || "usuario_destino" in body) {
    return "tarefa";
  }

  return "unknown";
}

const normalizeString = readString;

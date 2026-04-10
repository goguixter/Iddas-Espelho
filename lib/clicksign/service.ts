import {
  canDeleteDraftDocumentSignature,
  isDocumentSignatureLocked,
} from "@/lib/clicksign/actions";
import { clicksignRequest } from "@/lib/clicksign/client";
import {
  buildAuthRequirementPayload,
  buildDocumentPayload,
  buildDocumentStatusPayload,
  buildEnvelopePayload,
  buildEnvelopeStatusPayload,
  buildNotificationPayload,
  buildQualificationRequirementPayload,
  buildSignerPayload,
  normalizeBirthday,
} from "@/lib/clicksign/payloads";
import { mergeClicksignRawState } from "@/lib/clicksign/state";
import type { ClicksignSignerInput } from "@/lib/clicksign/types";
import { clicksignConfig, env } from "@/lib/env";
import { normalizeDocumentNumber } from "@/lib/documents/formatters";
import { renderDocumentPdf } from "@/lib/documents/pdf";
import {
  getDocumentSignatureRequestById,
  getDocumentRecord,
  insertDocumentSignatureRequest,
  getLatestDocumentSignatureRequest,
  getOrcamentoDocumentSource,
  getPessoaDocumentSource,
  updateDocumentSignatureRequest,
} from "@/lib/documents/repository";
import { logSync } from "@/lib/sync/logger";

export async function sendDocumentToClicksign(documentRecordId: number) {
  const document = requireDocumentRecord(documentRecordId);
  const existingRequest = getLatestDocumentSignatureRequest(document.id);

  if (isDocumentSignatureLocked(toSignatureActionState(existingRequest))) {
    throw new ServiceError(
      "Este documento já foi enviado para assinatura e não pode ser reenviado.",
      409,
    );
  }

  const signers = resolveSigners(document.entity_type, document.entity_id);
  const requestId = createProcessingSignatureRequest(document.id, signers);

  try {
    const base64 = await renderDocumentPdfBase64(document.html_snapshot);
    const envelopeId = await createEnvelope(document.id, document.title);

    persistRequestState(requestId, {
      envelopeId,
      rawResponseJson: mergeClicksignRawState(getCurrentSendState(requestId), {
        envelopeId,
        send: {
          envelopeId,
          signers,
        },
      }),
    });

    const clicksignDocumentId = await createEnvelopeDocument(
      document.id,
      envelopeId,
      document.title,
      base64,
    );

    persistRequestState(requestId, {
      documentId: clicksignDocumentId,
      envelopeId,
      rawResponseJson: mergeClicksignRawState(getCurrentSendState(requestId), {
        documentId: clicksignDocumentId,
        envelopeId,
        send: {
          documentId: clicksignDocumentId,
          envelopeId,
          signers,
        },
      }),
    });

    const createdSigners = await createEnvelopeSigners(
      document.id,
      envelopeId,
      clicksignDocumentId,
      signers,
    );

    await activateEnvelope(document.id, envelopeId);
    await notifyEnvelope(document.id, envelopeId);

    persistRequestState(requestId, {
      documentId: clicksignDocumentId,
      envelopeId,
      lastError: null,
      rawResponseJson: mergeClicksignRawState(getCurrentSendState(requestId), {
        documentId: clicksignDocumentId,
        envelopeId,
        send: {
          documentId: clicksignDocumentId,
          envelopeId,
          signers: createdSigners,
        },
      }),
      sentAt: new Date().toISOString(),
      signersJson: JSON.stringify(createdSigners),
      status: "sent",
    });

    return {
      id: requestId,
      providerDocumentId: clicksignDocumentId,
      providerEnvelopeId: envelopeId,
      status: "sent",
    };
  } catch (error) {
    updateDocumentSignatureRequest(requestId, {
      last_error: error instanceof Error ? error.message : "Falha desconhecida ao enviar para assinatura.",
      status: "failed",
      updated_at: new Date().toISOString(),
    });
    throw error;
  }
}

export async function cancelDocumentSignature(documentRecordId: number) {
  const request = getCancelableSignatureRequest(documentRecordId);
  const now = new Date().toISOString();

  await runClicksignStep(
    documentRecordId,
    "cancel-document",
    `/api/v3/envelopes/${request.provider_envelope_id}/documents/${request.provider_document_id}`,
    () =>
      clicksignRequest(
        `/api/v3/envelopes/${request.provider_envelope_id}/documents/${request.provider_document_id}`,
        {
          body: JSON.stringify(
            buildDocumentStatusPayload(request.provider_document_id!, "canceled"),
          ),
          method: "PATCH",
        },
      ),
  );

  persistLocalDocumentStatus(request, "cancel", "canceled", now);

  return { status: "canceled" };
}

export async function deleteDraftDocumentSignature(documentRecordId: number) {
  const request = getDeletableSignatureRequest(documentRecordId);
  const now = new Date().toISOString();

  await runClicksignStep(
    documentRecordId,
    "delete-document",
    `/api/v3/envelopes/${request.provider_envelope_id}/documents/${request.provider_document_id}`,
    () =>
      clicksignRequest(
        `/api/v3/envelopes/${request.provider_envelope_id}/documents/${request.provider_document_id}`,
        {
          method: "DELETE",
        },
      ),
  );

  persistLocalDocumentStatus(request, "document_deleted", "deleted", now);

  return { status: "deleted" };
}

async function renderDocumentPdfBase64(htmlSnapshot: string) {
  const pdfBuffer = await renderDocumentPdf(htmlSnapshot);
  return `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
}

async function createEnvelope(documentId: number, title: string) {
  const envelopePayload = buildEnvelopePayload(title);

  logSync("info", "document.clicksign.envelope-payload", {
    documentId,
    envelopeAttributes: envelopePayload.data.attributes,
  });

  const envelopeResponse = await runClicksignStep(
    documentId,
    "create-envelope",
    "/api/v3/envelopes",
    () =>
      clicksignRequest<{ data: { id: string } }>("/api/v3/envelopes", {
        body: JSON.stringify(envelopePayload),
        method: "POST",
      }),
  );

  return envelopeResponse.data.id;
}

async function createEnvelopeDocument(
  documentId: number,
  envelopeId: string,
  title: string,
  base64: string,
) {
  const documentResponse = await runClicksignStep(
    documentId,
    "create-document",
    `/api/v3/envelopes/${envelopeId}/documents`,
    () =>
      clicksignRequest<{ data: { id: string } }>(`/api/v3/envelopes/${envelopeId}/documents`, {
        body: JSON.stringify(buildDocumentPayload(title, base64)),
        method: "POST",
      }),
  );

  return documentResponse.data.id;
}

async function createEnvelopeSigners(
  documentId: number,
  envelopeId: string,
  clicksignDocumentId: string,
  signers: ClicksignSignerInput[],
) {
  const createdSigners: Array<ClicksignSignerInput & { id: string }> = [];

  for (const signer of signers) {
    const signerId = await createSigner(documentId, envelopeId, signer);
    createdSigners.push({ ...signer, id: signerId });
    await createSignerRequirements(
      documentId,
      envelopeId,
      clicksignDocumentId,
      signerId,
      signer,
    );
  }

  return createdSigners;
}

async function createSigner(
  documentId: number,
  envelopeId: string,
  signer: ClicksignSignerInput,
) {
  const signerPayload = buildSignerPayload(signer);

  logSync("info", "document.clicksign.signer-payload", {
    documentId,
    signerAttributes: signerPayload.data.attributes,
  });

  const signerResponse = await runClicksignStep(
    documentId,
    "create-signer",
    `/api/v3/envelopes/${envelopeId}/signers`,
    () =>
      clicksignRequest<{ data: { id: string } }>(`/api/v3/envelopes/${envelopeId}/signers`, {
        body: JSON.stringify(signerPayload),
        method: "POST",
      }),
  );

  return signerResponse.data.id;
}

async function createSignerRequirements(
  documentId: number,
  envelopeId: string,
  clicksignDocumentId: string,
  signerId: string,
  signer: ClicksignSignerInput,
) {
  await runClicksignStep(
    documentId,
    "create-qualification-requirement",
    `/api/v3/envelopes/${envelopeId}/requirements`,
    () =>
      clicksignRequest(`/api/v3/envelopes/${envelopeId}/requirements`, {
        body: JSON.stringify(
          buildQualificationRequirementPayload(
            clicksignDocumentId,
            signerId,
            signer.qualificationRole,
          ),
        ),
        method: "POST",
      }),
  );

  await runClicksignStep(
    documentId,
    "create-auth-requirement",
    `/api/v3/envelopes/${envelopeId}/requirements`,
    () =>
      clicksignRequest(`/api/v3/envelopes/${envelopeId}/requirements`, {
        body: JSON.stringify(buildAuthRequirementPayload(clicksignDocumentId, signerId)),
        method: "POST",
      }),
  );
}

async function activateEnvelope(documentId: number, envelopeId: string) {
  await runClicksignStep(
    documentId,
    "update-envelope-status",
    `/api/v3/envelopes/${envelopeId}`,
    () =>
      clicksignRequest(`/api/v3/envelopes/${envelopeId}`, {
        body: JSON.stringify(buildEnvelopeStatusPayload(envelopeId)),
        method: "PATCH",
      }),
  );
}

async function notifyEnvelope(documentId: number, envelopeId: string) {
  const notificationPayload = buildNotificationPayload();

  logSync("info", "document.clicksign.notification-payload", {
    documentId,
    notificationAttributes: notificationPayload.data.attributes,
    profile: clicksignConfig.profile,
  });

  await runClicksignStep(
    documentId,
    "notify-envelope",
    `/api/v3/envelopes/${envelopeId}/notifications`,
    () =>
      clicksignRequest(`/api/v3/envelopes/${envelopeId}/notifications`, {
        body: JSON.stringify(notificationPayload),
        method: "POST",
      }),
  );
}

function getCurrentSendState(requestId: number) {
  const request = getDocumentSignatureRequestById(requestId);
  return request?.raw_response_json ?? "{}";
}

function persistRequestState(
  requestId: number,
  input: {
    documentId?: string | null;
    envelopeId?: string | null;
    lastError?: string | null;
    rawResponseJson: string;
    sentAt?: string | null;
    signersJson?: string;
    status?: string;
  },
) {
  updateDocumentSignatureRequest(requestId, {
    last_error: input.lastError,
    provider_document_id: input.documentId,
    provider_envelope_id: input.envelopeId,
    raw_response_json: input.rawResponseJson,
    sent_at: input.sentAt,
    signers_json: input.signersJson,
    status: input.status,
    updated_at: new Date().toISOString(),
  });
}

function persistLocalDocumentStatus(
  request: NonNullable<ReturnType<typeof getLatestDocumentSignatureRequest>>,
  eventName: "cancel" | "document_deleted",
  documentStatus: "canceled" | "deleted",
  occurredAt: string,
) {
  persistRequestState(request.id, {
    documentId: request.provider_document_id,
    envelopeId: request.provider_envelope_id,
    lastError: null,
    rawResponseJson: mergeClicksignRawState(request.raw_response_json, {
      documentId: request.provider_document_id,
      documentSnapshot: { status: documentStatus },
      envelopeId: request.provider_envelope_id,
      lastWebhook: buildLocalDocumentEvent(eventName, documentStatus, occurredAt),
      webhookEvent: buildLocalDocumentEvent(eventName, documentStatus, occurredAt),
    }),
    sentAt: request.sent_at,
    signersJson: request.signers_json,
    status: documentStatus,
  });
}

function getCancelableSignatureRequest(documentRecordId: number) {
  const request = getLatestDocumentSignatureRequest(documentRecordId);

  if (!request?.provider_envelope_id || !request.provider_document_id) {
    throw new ServiceError("Documento de assinatura não encontrado para este registro.", 404);
  }

  return request;
}

function getDeletableSignatureRequest(documentRecordId: number) {
  const request = getLatestDocumentSignatureRequest(documentRecordId);

  if (!request?.provider_envelope_id || !request.provider_document_id) {
    throw new ServiceError("Documento de assinatura não encontrado para este registro.", 404);
  }

  if (!canDeleteDraftDocumentSignature(toSignatureActionState(request))) {
    throw new ServiceError("Este documento só pode ser excluído enquanto ainda estiver em draft.", 409);
  }

  return request;
}

function buildLocalDocumentEvent(
  eventName: "cancel" | "document_deleted",
  documentStatus: string,
  occurredAt: string,
) {
  return {
    document: {
      status: documentStatus,
    },
    event: {
      occurred_at: occurredAt,
      name: eventName,
    },
  };
}

class ServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function createProcessingSignatureRequest(
  documentRecordId: number,
  signers: ClicksignSignerInput[],
) {
  const now = new Date().toISOString();

  return insertDocumentSignatureRequest({
    created_at: now,
    document_record_id: documentRecordId,
    last_error: null,
    provider: "clicksign",
    provider_document_id: null,
    provider_envelope_id: null,
    raw_response_json: "{}",
    signature_links_json: "{}",
    signed_at: null,
    signers_json: JSON.stringify(signers),
    sent_at: null,
    status: "processing",
    updated_at: now,
  });
}

function requireDocumentRecord(documentRecordId: number) {
  const document = getDocumentRecord(documentRecordId);

  if (!document) {
    throw new Error("Documento não encontrado.");
  }

  return document;
}

function toSignatureActionState(
  request: Pick<
    NonNullable<ReturnType<typeof getLatestDocumentSignatureRequest>>,
    "provider_document_id" | "provider_envelope_id" | "sent_at" | "status"
  > | null | undefined,
) {
  if (!request) {
    return null;
  }

  return {
    providerDocumentId: request.provider_document_id,
    providerEnvelopeId: request.provider_envelope_id,
    sentAt: request.sent_at,
    status: request.status,
  };
}

function resolveSigners(entityType: string, entityId: string): ClicksignSignerInput[] {
  const contratada = {
    birthday: normalizeBirthday(env.CLICKSIGN_CONTRATADA_SIGNER_BIRTH ?? null),
    documentation: normalizeDocumentNumber(env.CLICKSIGN_CONTRATADA_SIGNER_DOCUMENT ?? null),
    email: env.CLICKSIGN_CONTRATADA_SIGNER_EMAIL ?? "",
    has_documentation: Boolean(env.CLICKSIGN_CONTRATADA_SIGNER_DOCUMENT?.trim()),
    name: env.CLICKSIGN_CONTRATADA_SIGNER_NAME ?? "Contratada",
    qualificationRole: "contractee",
  } satisfies ClicksignSignerInput;

  if (!contratada.email) {
    throw new Error("CLICKSIGN_CONTRATADA_SIGNER_EMAIL não configurado.");
  }

  if (entityType === "orcamento") {
    const source = getOrcamentoDocumentSource(entityId);

    if (!source?.clienteEmail) {
      throw new Error("O contratante deste orçamento não possui e-mail para assinatura.");
    }

    return [
      {
        birthday: normalizeBirthday(source.clienteNascimento),
        documentation: normalizeDocumentNumber(source.clienteCpf ?? null),
        email: source.clienteEmail,
        has_documentation: Boolean(source.clienteCpf?.trim()),
        name: source.clienteNome,
        qualificationRole: "contractor",
      },
      contratada,
    ];
  }

  const person = getPessoaDocumentSource(entityId);

  if (!person?.email) {
    throw new Error("O contratante selecionado não possui e-mail para assinatura.");
  }

  return [
    {
      birthday: normalizeBirthday(person.nascimento),
      documentation: normalizeDocumentNumber(person.cpf ?? person.passaporte ?? null),
      email: person.email,
      has_documentation: Boolean((person.cpf ?? person.passaporte)?.trim()),
      name: person.nome ?? "Contratante",
      qualificationRole: "contractor",
    },
    contratada,
  ];
}

async function runClicksignStep<T>(
  documentId: number,
  step: string,
  path: string,
  action: () => Promise<T>,
) {
  try {
    const result = await action();
    logSync("info", "document.clicksign.step.success", {
      documentId,
      path,
      step,
    });
    return result;
  } catch (error) {
    logSync("error", "document.clicksign.step.error", {
      documentId,
      error: error instanceof Error ? error.message : "Erro desconhecido.",
      path,
      raw:
        typeof error === "object" && error !== null && "body" in error
          ? (error as { body?: unknown }).body
          : null,
      statusCode:
        typeof error === "object" && error !== null && "status" in error
          ? (error as { status?: unknown }).status
          : null,
      step,
    });
    throw error;
  }
}

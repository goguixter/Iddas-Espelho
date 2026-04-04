import { clicksignRequest } from "@/lib/clicksign/client";
import {
  buildAuthRequirementPayload,
  buildDocumentPayload,
  buildEnvelopePayload,
  buildEnvelopeStatusPayload,
  buildNotificationPayload,
  buildQualificationRequirementPayload,
  buildSignerPayload,
  normalizeBirthday,
} from "@/lib/clicksign/payloads";
import { mergeClicksignRawState } from "@/lib/clicksign/state";
import type { ClicksignSignerInput } from "@/lib/clicksign/types";
import { env } from "@/lib/env";
import { normalizeDocumentNumber } from "@/lib/documents/formatters";
import { renderDocumentPdf } from "@/lib/documents/pdf";
import {
  getDocumentRecord,
  getOrcamentoDocumentSource,
  getPessoaDocumentSource,
  insertDocumentSignatureRequest,
  updateDocumentSignatureRequest,
} from "@/lib/documents/repository";
import { logSync } from "@/lib/sync/logger";

export async function sendDocumentToClicksign(documentRecordId: number) {
  const document = getDocumentRecord(documentRecordId);

  if (!document) {
    throw new Error("Documento não encontrado.");
  }

  const signers = resolveSigners(document.entity_type, document.entity_id);
  const now = new Date().toISOString();
  const requestId = insertDocumentSignatureRequest({
    created_at: now,
    document_record_id: document.id,
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

  try {
    const pdfBuffer = await renderDocumentPdf(document.html_snapshot);
    const base64 = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
    const envelopePayload = buildEnvelopePayload(document.title);
    const envelopeAttributes = envelopePayload.data.attributes;

    logSync("info", "document.clicksign.envelope-payload", {
      documentId: document.id,
      envelopeAttributes,
    });

    const envelopeResponse = await runClicksignStep(
      document.id,
      "create-envelope",
      "/api/v3/envelopes",
      () =>
        clicksignRequest<{ data: { id: string } }>("/api/v3/envelopes", {
          body: JSON.stringify(envelopePayload),
          method: "POST",
        }),
    );

    const envelopeId = envelopeResponse.data.id;

    const documentResponse = await runClicksignStep(
      document.id,
      "create-document",
      `/api/v3/envelopes/${envelopeId}/documents`,
      () =>
        clicksignRequest<{ data: { id: string } }>(`/api/v3/envelopes/${envelopeId}/documents`, {
          body: JSON.stringify(buildDocumentPayload(document.title, base64)),
          method: "POST",
        }),
    );

    const clicksignDocumentId = documentResponse.data.id;

    const createdSigners = [];

    for (const signer of signers) {
      const signerPayload = buildSignerPayload(signer);
      const signerAttributes = signerPayload.data.attributes;

      logSync("info", "document.clicksign.signer-payload", {
        documentId: document.id,
        signerAttributes,
      });

      const signerResponse = await runClicksignStep(
        document.id,
        "create-signer",
        `/api/v3/envelopes/${envelopeId}/signers`,
        () =>
          clicksignRequest<{ data: { id: string } }>(`/api/v3/envelopes/${envelopeId}/signers`, {
            body: JSON.stringify(signerPayload),
            method: "POST",
          }),
      );

      const signerId = signerResponse.data.id;
      createdSigners.push({ ...signer, id: signerId });

      await runClicksignStep(
        document.id,
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
        document.id,
        "create-auth-requirement",
        `/api/v3/envelopes/${envelopeId}/requirements`,
        () =>
          clicksignRequest(`/api/v3/envelopes/${envelopeId}/requirements`, {
            body: JSON.stringify(buildAuthRequirementPayload(clicksignDocumentId, signerId)),
            method: "POST",
          }),
      );
    }

    await runClicksignStep(
      document.id,
      "update-envelope-status",
      `/api/v3/envelopes/${envelopeId}`,
      () =>
        clicksignRequest(`/api/v3/envelopes/${envelopeId}`, {
          body: JSON.stringify(buildEnvelopeStatusPayload(envelopeId)),
          method: "PATCH",
        }),
    );

    await runClicksignStep(
      document.id,
      "notify-envelope",
      `/api/v3/envelopes/${envelopeId}/notifications`,
      () =>
        clicksignRequest(`/api/v3/envelopes/${envelopeId}/notifications`, {
          body: JSON.stringify(buildNotificationPayload()),
          method: "POST",
        }),
    );

    updateDocumentSignatureRequest(requestId, {
      last_error: null,
      provider_document_id: clicksignDocumentId,
      provider_envelope_id: envelopeId,
      raw_response_json: mergeClicksignRawState("{}", {
        documentId: clicksignDocumentId,
        envelopeId,
        send: {
          documentId: clicksignDocumentId,
          envelopeId,
          signers: createdSigners,
        },
      }),
      sent_at: new Date().toISOString(),
      signers_json: JSON.stringify(createdSigners),
      status: "sent",
      updated_at: new Date().toISOString(),
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

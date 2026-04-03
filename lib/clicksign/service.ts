import { clicksignRequest } from "@/lib/clicksign/client";
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
    const envelopeAttributes = {
      auto_close: true,
      block_after_refusal: false,
      deadline_at: buildEnvelopeDeadlineAt(),
      default_message: buildDefaultEnvelopeMessage(document.title),
      default_subject: buildDefaultEnvelopeSubject(document.title),
      locale: "pt-BR",
      name: document.title,
      remind_interval: 3,
    };

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
          body: JSON.stringify({
            data: {
              type: "envelopes",
              attributes: envelopeAttributes,
            },
          }),
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
          body: JSON.stringify({
            data: {
              type: "documents",
              attributes: {
                content_base64: base64,
                filename: `${sanitizeFilename(document.title)}.pdf`,
              },
            },
          }),
          method: "POST",
        }),
    );

    const clicksignDocumentId = documentResponse.data.id;

    const createdSigners = [];

    for (const signer of signers) {
      const signerAttributes = {
        birthday: normalizeBirthday(signer.birthday),
        communicate_events: {
          document_signed: "email",
          signature_reminder: "email",
          signature_request: "email",
        },
        documentation: normalizeDocumentNumber(signer.documentation),
        email: signer.email,
        group: 1,
        has_documentation: signer.has_documentation ?? Boolean(signer.documentation),
        location_required_enabled: false,
        name: signer.name,
        refusable: false,
      };

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
            body: JSON.stringify({
              data: {
                type: "signers",
                attributes: signerAttributes,
              },
            }),
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
            body: JSON.stringify({
              data: {
                type: "requirements",
                attributes: {
                  action: "agree",
                  role: signer.qualificationRole,
                },
                relationships: {
                  document: {
                    data: { id: clicksignDocumentId, type: "documents" },
                  },
                  signer: {
                    data: { id: signerId, type: "signers" },
                  },
                },
              },
            }),
            method: "POST",
          }),
      );

      await runClicksignStep(
        document.id,
        "create-auth-requirement",
        `/api/v3/envelopes/${envelopeId}/requirements`,
        () =>
          clicksignRequest(`/api/v3/envelopes/${envelopeId}/requirements`, {
            body: JSON.stringify({
              data: {
                type: "requirements",
                attributes: {
                  action: "provide_evidence",
                  auth: "email",
                },
                relationships: {
                  document: {
                    data: { id: clicksignDocumentId, type: "documents" },
                  },
                  signer: {
                    data: { id: signerId, type: "signers" },
                  },
                },
              },
            }),
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
          body: JSON.stringify({
            data: {
              type: "envelopes",
              id: envelopeId,
              attributes: {
                status: "running",
              },
            },
          }),
          method: "PATCH",
        }),
    );

    await runClicksignStep(
      document.id,
      "notify-envelope",
      `/api/v3/envelopes/${envelopeId}/notifications`,
      () =>
        clicksignRequest(`/api/v3/envelopes/${envelopeId}/notifications`, {
          body: JSON.stringify({
            data: {
              attributes: {},
              type: "notifications",
            },
          }),
          method: "POST",
        }),
    );

    updateDocumentSignatureRequest(requestId, {
      last_error: null,
      provider_document_id: clicksignDocumentId,
      provider_envelope_id: envelopeId,
      raw_response_json: JSON.stringify({
        documentId: clicksignDocumentId,
        envelopeId,
        signers: createdSigners,
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

function sanitizeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function normalizeBirthday(value: string | null | undefined) {
  const raw = value?.trim();

  if (!raw) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");
    return `${year}-${month}-${day}`;
  }

  return raw;
}

function buildEnvelopeDeadlineAt() {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  return deadline.toISOString();
}

function buildDefaultEnvelopeSubject(title: string) {
  const subject = `Assinatura pendente: ${title}`.trim();
  return subject.slice(0, 100);
}

function buildDefaultEnvelopeMessage(title: string) {
  return `Olá, este documento foi disponibilizado para assinatura: ${title}. Por favor, revise e conclua a assinatura.`;
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

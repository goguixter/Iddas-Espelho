import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { clicksignConfig } from "@/lib/env";
import { deriveClicksignSignatureState, mergeClicksignRawState } from "@/lib/clicksign/state";
import {
  getLatestDocumentSignatureRequestByDocumentProviderId,
  getLatestDocumentSignatureRequestByEnvelopeId,
  updateDocumentSignatureRequest,
  upsertDocumentSignatureEvent,
} from "@/lib/documents/repository";

type ClicksignWebhookPayload = {
  document?: unknown;
  envelope?: unknown;
  event?: {
    data?: unknown;
    name?: unknown;
    occurred_at?: unknown;
  };
};

type ProcessedClicksignWebhook = {
  envelopeId: string | null;
  eventId: string;
  eventName: string | null;
  occurredAt: string | null;
  signatureRequestId: number;
  status: string;
};

export function verifyClicksignWebhookSignature(rawText: string, signature: string | null) {
  const secret = clicksignConfig.webhookSecret?.trim();

  if (!secret) {
    return true;
  }

  if (!signature) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", secret)
    .update(rawText)
    .digest("hex")}`;

  return safeCompare(expected, signature.trim());
}

export function processClicksignWebhookPayload(rawText: string, payload: unknown) {
  const envelopeId = extractClicksignWebhookEnvelopeId(payload);
  const providerDocumentId = extractClicksignWebhookDocumentId(payload);
  const request =
    (envelopeId ? getLatestDocumentSignatureRequestByEnvelopeId(envelopeId) : undefined) ??
    (providerDocumentId
      ? getLatestDocumentSignatureRequestByDocumentProviderId(providerDocumentId)
      : undefined);

  if (!request) {
    throw new Error("Solicitação de assinatura não encontrada para o webhook recebido.");
  }

  const normalizedPayload = toWebhookPayload(payload);
  const documentPayload = toObject(normalizedPayload.document);
  const eventName = normalizeString(normalizedPayload.event?.name);
  const occurredAt = normalizeString(normalizedPayload.event?.occurred_at) ?? new Date().toISOString();
  const eventId = buildWebhookEventId(rawText);
  const now = new Date().toISOString();
  const parsedPayload = toObject(payload) ?? {};

  upsertDocumentSignatureEvent({
    created_at: now,
    id: eventId,
    payload_json: JSON.stringify(parsedPayload),
    provider_created_at: occurredAt,
    provider_event_type: eventName ?? "unknown",
    signature_request_id: request.id,
    updated_at: now,
  });

  const nextRawResponseJson = mergeClicksignRawState(request.raw_response_json, {
    documentId: providerDocumentId ?? request.provider_document_id,
    documentSnapshot: documentPayload,
    envelopeId: envelopeId ?? request.provider_envelope_id,
    lastWebhook: parsedPayload,
    webhookEvent: parsedPayload,
  });
  const nextSignersJson = resolveUpdatedSignersJson(request.signers_json, documentPayload?.signers);
  const derived = deriveClicksignSignatureState({
    currentStatus: request.status,
    rawResponseJson: nextRawResponseJson,
    signersJson: nextSignersJson,
  });

  updateDocumentSignatureRequest(request.id, {
    last_error: null,
    provider_document_id: providerDocumentId ?? request.provider_document_id,
    provider_envelope_id: envelopeId ?? request.provider_envelope_id,
    raw_response_json: nextRawResponseJson,
    sent_at: derived.sentAt,
    signature_links_json: JSON.stringify(derived.signatureLinks),
    signers_json: nextSignersJson,
    signed_at: derived.signedAt,
    status: derived.status,
    updated_at: now,
  });

  return {
    envelopeId: envelopeId ?? request.provider_envelope_id,
    eventId,
    eventName,
    occurredAt,
    signatureRequestId: request.id,
    status: derived.status,
  } satisfies ProcessedClicksignWebhook;
}

export function extractClicksignWebhookEnvelopeId(payload: unknown) {
  const candidates = [
    ["event", "data", "envelope", "id"],
    ["event", "data", "envelope", "key"],
    ["event", "data", "document", "envelope_id"],
    ["event", "data", "document", "envelopeId"],
    ["document", "envelope", "id"],
    ["document", "envelope", "key"],
    ["data", "envelope", "id"],
    ["data", "envelope", "key"],
    ["envelope", "id"],
    ["envelope", "key"],
    ["envelope_id"],
    ["envelopeId"],
  ];

  for (const path of candidates) {
    const value = readNestedString(payload, path);
    if (value) {
      return value;
    }
  }

  return null;
}

export function extractClicksignWebhookDocumentId(payload: unknown) {
  const candidates = [
    ["document", "key"],
    ["document", "id"],
    ["event", "data", "document", "key"],
    ["event", "data", "document", "id"],
    ["document_id"],
    ["documentId"],
  ];

  for (const path of candidates) {
    const value = readNestedString(payload, path);
    if (value) {
      return value;
    }
  }

  return null;
}

function buildWebhookEventId(rawText: string) {
  return createHash("sha256").update(rawText).digest("hex");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveUpdatedSignersJson(currentSignersJson: string, documentSigners: unknown) {
  if (!Array.isArray(documentSigners) || documentSigners.length === 0) {
    return currentSignersJson;
  }

  const normalized = documentSigners
    .map((item) => {
      const signer = toObject(item);
      const email = normalizeString(signer?.email);
      const name = normalizeString(signer?.name);
      if (!email || !name) {
        return null;
      }

      return {
        birthday: normalizeString(signer?.birthday),
        documentation: normalizeString(signer?.documentation),
        email,
        has_documentation: Boolean(signer?.has_documentation),
        id: normalizeString(signer?.key),
        name,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  return normalized.length > 0 ? JSON.stringify(normalized) : currentSignersJson;
}

function toWebhookPayload(payload: unknown) {
  return (payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload
    : {}) as ClicksignWebhookPayload;
}

function toObject(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNestedString(input: unknown, path: string[]) {
  let current = input;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return normalizeString(current);
}

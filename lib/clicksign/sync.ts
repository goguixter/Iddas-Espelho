import { createHash } from "node:crypto";
import { clicksignRequest } from "@/lib/clicksign/client";
import { deriveClicksignSignatureState, mergeClicksignRawState } from "@/lib/clicksign/state";
import {
  getLatestDocumentSignatureRequest,
  updateDocumentSignatureRequest,
  upsertDocumentSignatureEvent,
} from "@/lib/documents/repository";

type ClicksignDocumentResponse = {
  data?: {
    id?: string;
    attributes?: Record<string, unknown>;
    links?: Record<string, unknown>;
  };
};

type ClicksignEventsResponse = {
  data?: Array<{
    attributes?: {
      created?: string;
      data?: unknown;
      name?: string;
    };
    id?: string;
  }>;
};

type NormalizedSyncEvent = {
  event: {
    data: Record<string, unknown> | unknown | null;
    name: string;
    occurred_at: string | null;
  };
};

export async function syncDocumentSignatureStatus(documentRecordId: number) {
  const request = getLatestDocumentSignatureRequest(documentRecordId);

  if (!request?.provider_envelope_id || !request.provider_document_id) {
    throw new Error("Documento de assinatura não encontrado para sincronização.");
  }

  const [documentResponse, eventsResponse] = await Promise.all([
    clicksignRequest<ClicksignDocumentResponse>(
      `/api/v3/envelopes/${request.provider_envelope_id}/documents/${request.provider_document_id}`,
    ),
    clicksignRequest<ClicksignEventsResponse>(
      `/api/v3/envelopes/${request.provider_envelope_id}/events`,
    ),
  ]);

  const normalizedEvents = normalizeSyncEvents(eventsResponse.data ?? []);
  const documentSnapshot = normalizeDocumentSnapshot(documentResponse.data);
  const lastWebhook = normalizedEvents.at(-1) ?? null;
  const nextRawResponseJson = mergeClicksignRawState(request.raw_response_json, {
    documentId: request.provider_document_id,
    documentSnapshot,
    envelopeId: request.provider_envelope_id,
    lastWebhook,
    webhookEvents: normalizedEvents,
  });
  const derived = deriveClicksignSignatureState({
    currentStatus: request.status,
    documentCreatedAt: null,
    rawResponseJson: nextRawResponseJson,
    signersJson: request.signers_json,
  });
  const now = new Date().toISOString();

  for (const event of normalizedEvents) {
    const eventName = readEventString(event, ["event", "name"]) ?? "unknown";
    const occurredAt = readEventString(event, ["event", "occurred_at"]);

    upsertDocumentSignatureEvent({
      created_at: now,
      id: buildSyncEventId(request.id, event),
      payload_json: JSON.stringify(event),
      provider_created_at: occurredAt,
      provider_event_type: eventName,
      signature_request_id: request.id,
      updated_at: now,
    });
  }

  updateDocumentSignatureRequest(request.id, {
    last_error: null,
    raw_response_json: nextRawResponseJson,
    sent_at: derived.sentAt,
    signature_links_json: JSON.stringify(derived.signatureLinks),
    signed_at: derived.signedAt,
    status: derived.status,
    updated_at: now,
  });

  return {
    eventCount: normalizedEvents.length,
    status: derived.status,
  };
}

function normalizeDocumentSnapshot(data: ClicksignDocumentResponse["data"]) {
  return {
    ...(data?.attributes ?? {}),
    id: data?.id ?? null,
    key: data?.id ?? null,
    links: data?.links ?? null,
  };
}

function normalizeSyncEvents(
  events: Array<NonNullable<ClicksignEventsResponse["data"]>[number]>,
): NormalizedSyncEvent[] {
  return events.reduce<NormalizedSyncEvent[]>((acc, item) => {
    const attributes = item.attributes ?? {};
    const name = typeof attributes.name === "string" ? attributes.name : null;

    if (!name) {
      return acc;
    }

    acc.push({
      event: {
        data: isRecord(attributes.data) ? attributes.data : attributes.data ?? null,
        name,
        occurred_at: typeof attributes.created === "string" ? attributes.created : null,
      },
    });

    return acc;
  }, []);
}

function buildSyncEventId(signatureRequestId: number, event: NormalizedSyncEvent) {
  return createHash("sha256")
    .update(`${signatureRequestId}:${JSON.stringify(event)}`)
    .digest("hex");
}

function readEventString(input: unknown, path: string[]) {
  let current = input;

  for (const segment of path) {
    if (!isRecord(current)) {
      return null;
    }

    current = current[segment];
  }

  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

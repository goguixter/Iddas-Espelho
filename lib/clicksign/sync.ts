import { clicksignRequest } from "@/lib/clicksign/client";
import { deriveClicksignSignatureState, mergeClicksignRawState } from "@/lib/clicksign/state";
import {
  getLatestDocumentSignatureRequest,
  getLatestDocumentSignatureRequestByEnvelopeId,
  listDocumentSignatureEvents,
  upsertDocumentSignatureEvent,
  updateDocumentSignatureRequest,
} from "@/lib/documents/repository";

type ClicksignEnvelopeResponse = {
  data?: {
    attributes?: {
      status?: string | null;
    };
    id?: string;
  };
};

type ClicksignEnvelopeEventsResponse = {
  data?: Array<{
    attributes?: {
      created?: string | null;
      data?: Record<string, unknown> | null;
      name?: string | null;
    };
    id?: string;
  }>;
};

export async function syncDocumentSignatureRequestByDocumentId(documentRecordId: number) {
  const request = getLatestDocumentSignatureRequest(documentRecordId);

  if (!request?.provider_envelope_id) {
    throw new Error("Solicitação de assinatura não encontrada para este documento.");
  }

  return syncDocumentSignatureRequestByEnvelopeId(request.provider_envelope_id);
}

export async function syncDocumentSignatureRequestByEnvelopeId(providerEnvelopeId: string) {
  const request = getLatestDocumentSignatureRequestByEnvelopeId(providerEnvelopeId);

  if (!request?.provider_envelope_id) {
    throw new Error("Solicitação de assinatura não encontrada para este envelope.");
  }

  const [envelope, eventsResponse] = await Promise.all([
    clicksignRequest<ClicksignEnvelopeResponse>(`/api/v3/envelopes/${request.provider_envelope_id}`),
    clicksignRequest<ClicksignEnvelopeEventsResponse>(`/api/v3/envelopes/${request.provider_envelope_id}/events`),
  ]);

  const now = new Date().toISOString();
  const events = eventsResponse.data ?? [];

  for (const event of events) {
    if (!event.id) {
      continue;
    }

    upsertDocumentSignatureEvent({
      created_at: now,
      id: event.id,
      payload_json: JSON.stringify(event),
      provider_created_at: event.attributes?.created ?? null,
      provider_event_type: event.attributes?.name ?? "unknown",
      signature_request_id: request.id,
      updated_at: now,
    });
  }

  const persistedEvents = listDocumentSignatureEvents(request.id);
  const nextRawResponseJson = mergeClicksignRawState(request.raw_response_json, {
    syncEnvelope: envelope as Record<string, unknown>,
    syncEvents: persistedEvents
      .map((item) => safeParseEventPayload(item.payload_json))
      .filter((value): value is Record<string, unknown> => Boolean(value)),
  });
  const derived = deriveClicksignSignatureState({
    currentStatus: request.status,
    rawResponseJson: nextRawResponseJson,
    signersJson: request.signers_json,
  });

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
    eventCount: persistedEvents.length,
    signedAt: derived.signedAt,
    status: derived.status,
  };
}
function safeParseEventPayload(payloadJson: string) {
  try {
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

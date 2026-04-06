import { NextResponse } from "next/server";
import {
  extractClicksignWebhookDocumentId,
  extractClicksignWebhookEnvelopeId,
  processClicksignWebhookPayload,
  verifyClicksignWebhookSignature,
} from "@/lib/clicksign/webhook";
import {
  insertClicksignWebhookDelivery,
  updateClicksignWebhookDelivery,
} from "@/lib/documents/repository";
import { logSync } from "@/lib/sync/logger";

export async function POST(request: Request) {
  const rawText = await request.text();
  const payload = safeParseWebhookPayload(rawText);
  const signatureHeader =
    request.headers.get("content-hmac") ?? request.headers.get("event_hmac");

  if (!payload) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const envelopeId = extractClicksignWebhookEnvelopeId(payload);
  const documentId = extractClicksignWebhookDocumentId(payload);
  const eventName = extractEventName(payload);
  const now = new Date().toISOString();
  const deliveryId = insertClicksignWebhookDelivery({
    created_at: now,
    event_name: eventName,
    payload_json: rawText,
    processing_error: null,
    processing_status: "received",
    provider_document_id: documentId,
    provider_envelope_id: envelopeId,
    signature_header: signatureHeader,
    signature_valid: false,
    updated_at: now,
  });

  if (!verifyClicksignWebhookSignature(rawText, signatureHeader)) {
    updateClicksignWebhookDelivery(deliveryId, {
      processing_error: "Assinatura do webhook inválida.",
      processing_status: "invalid-signature",
      signature_valid: false,
      updated_at: new Date().toISOString(),
    });
    logSync("warn", "document.clicksign.webhook.invalid-signature", {
      deliveryId,
      envelopeId,
      payload,
      signatureHeader,
    });
    return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 401 });
  }
  updateClicksignWebhookDelivery(deliveryId, {
    processing_status: "validated",
    signature_valid: true,
    updated_at: new Date().toISOString(),
  });

  logSync("info", "document.clicksign.webhook.received", {
    deliveryId,
    documentId,
    envelopeId,
    payload,
  });

  if (!envelopeId && !documentId) {
    updateClicksignWebhookDelivery(deliveryId, {
      processing_error: "Envelope ou documento não identificado no payload do webhook.",
      processing_status: "missing-identifiers",
      updated_at: new Date().toISOString(),
    });
    logSync("warn", "document.clicksign.webhook.missing-envelope-id", {
      deliveryId,
      payload,
    });
    return NextResponse.json(
      { error: "Envelope ou documento não identificado no payload do webhook." },
      { status: 400 },
    );
  }

  try {
    const result = processClicksignWebhookPayload(rawText, payload);
    updateClicksignWebhookDelivery(deliveryId, {
      processing_status: "processed",
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Não foi possível sincronizar o webhook da Clicksign.";

    updateClicksignWebhookDelivery(deliveryId, {
      processing_error: message,
      processing_status: "failed",
      updated_at: new Date().toISOString(),
    });
    logSync("error", "document.clicksign.webhook.error", {
      deliveryId,
      envelopeId,
      message,
      payload,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeParseWebhookPayload(rawText: string) {
  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return null;
  }
}

function extractEventName(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const event = (payload as Record<string, unknown>).event;
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return null;
  }

  const name = (event as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

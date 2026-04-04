import { NextResponse } from "next/server";
import {
  extractClicksignWebhookDocumentId,
  extractClicksignWebhookEnvelopeId,
  processClicksignWebhookPayload,
  verifyClicksignWebhookSignature,
} from "@/lib/clicksign/webhook";
import { logSync } from "@/lib/sync/logger";

export async function POST(request: Request) {
  const rawText = await request.text();
  const payload = safeParseWebhookPayload(rawText);
  const signatureHeader = request.headers.get("event_hmac");

  if (!payload) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!verifyClicksignWebhookSignature(rawText, signatureHeader)) {
    logSync("warn", "document.clicksign.webhook.invalid-signature", {
      envelopeId: extractClicksignWebhookEnvelopeId(payload),
      payload,
      signatureHeader,
    });
    return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 401 });
  }

  const envelopeId = extractClicksignWebhookEnvelopeId(payload);
  const documentId = extractClicksignWebhookDocumentId(payload);

  logSync("info", "document.clicksign.webhook.received", {
    documentId,
    envelopeId,
    payload,
  });

  if (!envelopeId && !documentId) {
    logSync("warn", "document.clicksign.webhook.missing-envelope-id", {
      payload,
    });
    return NextResponse.json(
      { error: "Envelope ou documento não identificado no payload do webhook." },
      { status: 400 },
    );
  }

  try {
    const result = processClicksignWebhookPayload(rawText, payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Não foi possível sincronizar o webhook da Clicksign.";

    logSync("error", "document.clicksign.webhook.error", {
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

import { NextRequest, NextResponse } from "next/server";
import { applyIddasWebhook } from "@/lib/iddas/webhook-apply";
import { summarizeIddasWebhook } from "@/lib/iddas/webhook";
import {
  insertIddasWebhookDelivery,
  updateIddasWebhookDelivery,
} from "@/lib/documents/repository";
import { safeParseObject } from "@/lib/object-utils";
import { logSync } from "@/lib/sync/logger";

export async function POST(request: NextRequest) {
  const rawText = await request.text();
  const now = new Date().toISOString();
  let deliveryId: number | null = null;

  try {
    const payload = rawText ? safeParseObject(rawText) : {};
    if (rawText && !payload) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const summary = summarizeIddasWebhook(rawText || "{}", request.headers, payload);

    deliveryId = insertIddasWebhookDelivery({
      created_at: now,
      event_name: summary.eventName,
      headers_json: summary.headersJson,
      payload_json: summary.payloadJson,
      processing_error: null,
      processing_status: "received",
      provider_entity_id: summary.entityId,
      provider_entity_type: summary.entityType,
      provider_occurred_at: summary.occurredAt,
      provider_orcamento_id: summary.orcamentoId,
      provider_status_code: summary.statusCode,
      provider_status_label: summary.statusLabel,
      updated_at: now,
    });

    const applied = applyIddasWebhook(payload);

    updateIddasWebhookDelivery(deliveryId, {
      processing_status: applied.status,
      updated_at: new Date().toISOString(),
    });

    logSync("info", "iddas.webhook.processed", {
      deliveryId,
      entityId: applied.entityId,
      entityType: applied.entityType,
      eventName: summary.eventName,
      occurredAt: summary.occurredAt,
      orcamentoId: applied.orcamentoId,
      providerStatusCode: summary.statusCode,
      providerStatusLabel: summary.statusLabel,
      status: applied.status,
    });

    return NextResponse.json({
      deliveryId,
      entityId: applied.entityId,
      entityType: applied.entityType,
      eventName: summary.eventName,
      ok: true,
      orcamentoId: applied.orcamentoId,
      status: applied.status,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Não foi possível capturar o webhook do IDDAS.";

    if (deliveryId) {
      updateIddasWebhookDelivery(deliveryId, {
        processing_error: message,
        processing_status: "failed",
        updated_at: new Date().toISOString(),
      });
    } else {
      insertIddasWebhookDelivery({
        created_at: now,
        event_name: null,
        headers_json: JSON.stringify(Object.fromEntries(request.headers.entries())),
        payload_json: rawText || "{}",
        processing_error: message,
        processing_status: "failed",
        provider_entity_id: null,
        provider_entity_type: "unknown",
        provider_occurred_at: null,
        provider_orcamento_id: null,
        provider_status_code: null,
        provider_status_label: null,
        updated_at: now,
      });
    }

    logSync("error", "iddas.webhook.error", {
      error: message,
    });

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}

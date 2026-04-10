import { NextResponse } from "next/server";
import { buildApiErrorResponse } from "@/lib/api/errors";
import {
  cancelDocumentSignature,
  deleteDraftDocumentSignature,
  sendDocumentToClicksign,
} from "@/lib/clicksign/service";
import { logSync } from "@/lib/sync/logger";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleClicksignAction(context, "send", (documentId) => sendDocumentToClicksign(documentId));
}

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleClicksignAction(context, "cancel", (documentId) =>
    cancelDocumentSignature(documentId),
  );
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleClicksignAction(context, "delete-document", (documentId) =>
    deleteDraftDocumentSignature(documentId),
  );
}

async function handleClicksignAction(
  { params }: { params: Promise<{ id: string }> },
  action: "cancel" | "delete-document" | "send",
  executor: (documentId: number) => Promise<unknown>,
) {
  const { id } = await params;
  const documentId = Number(id);

  if (!Number.isFinite(documentId)) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }

  try {
    const result = await executor(documentId);
    return NextResponse.json(result);
  } catch (error) {
    const { payload, status } = buildApiErrorResponse(
      error,
      resolveFallbackMessage(action),
    );
    logSync("error", "document.clicksign.error", {
      action,
      documentId,
      error: payload.error,
      details: payload.details,
      raw: payload.raw,
      statusCode: status,
    });
    return NextResponse.json(payload, { status });
  }
}

function resolveFallbackMessage(action: "cancel" | "delete-document" | "send") {
  if (action === "cancel") {
    return "Não foi possível cancelar o documento no Clicksign.";
  }

  if (action === "delete-document") {
    return "Não foi possível excluir o documento no Clicksign.";
  }

  return "Não foi possível enviar o documento ao Clicksign.";
}

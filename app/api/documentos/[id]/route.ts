import { NextRequest, NextResponse } from "next/server";
import { canDeleteDocumentRecord } from "@/lib/clicksign/actions";
import {
  deleteDocumentRecord,
  getDocumentRecord,
  getLatestDocumentSignatureRequest,
} from "@/lib/documents/repository";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const recordId = Number(id);

  if (!Number.isFinite(recordId)) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }

  const record = getDocumentRecord(recordId);

  if (!record) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const signatureRequest = getLatestDocumentSignatureRequest(recordId);

  if (
    !canDeleteDocumentRecord(
      signatureRequest
        ? {
            providerDocumentId: signatureRequest.provider_document_id,
            providerEnvelopeId: signatureRequest.provider_envelope_id,
            sentAt: signatureRequest.sent_at,
            status: signatureRequest.status,
          }
        : null,
    )
  ) {
    return NextResponse.json(
      { error: "Este documento só pode ser excluído quando estiver cancelado ou aguardando envio." },
      { status: 409 },
    );
  }

  deleteDocumentRecord(recordId);

  return NextResponse.json({ success: true });
}

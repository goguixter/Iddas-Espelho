import { NextResponse } from "next/server";
import { buildApiErrorResponse } from "@/lib/api/errors";
import { sendDocumentToClicksign } from "@/lib/clicksign/service";
import { logSync } from "@/lib/sync/logger";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const documentId = Number(id);

  if (!Number.isFinite(documentId)) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }

  try {
    const result = await sendDocumentToClicksign(documentId);
    return NextResponse.json(result);
  } catch (error) {
    const { payload, status } = buildApiErrorResponse(
      error,
      "Não foi possível enviar o documento ao Clicksign.",
    );
    logSync("error", "document.clicksign.error", {
      documentId,
      error: payload.error,
      details: payload.details,
      raw: payload.raw,
      statusCode: status,
    });
    return NextResponse.json(payload, { status });
  }
}

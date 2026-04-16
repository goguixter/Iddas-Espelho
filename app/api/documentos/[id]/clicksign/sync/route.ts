import { NextResponse } from "next/server";
import { buildApiErrorResponse } from "@/lib/api/errors";
import { syncDocumentSignatureStatus } from "@/lib/clicksign/sync";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const documentId = Number(id);

  if (!Number.isFinite(documentId)) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }

  try {
    const result = await syncDocumentSignatureStatus(documentId);
    return NextResponse.json(result);
  } catch (error) {
    const { payload, status } = buildApiErrorResponse(
      error,
      "Não foi possível atualizar o status no Clicksign.",
    );
    return NextResponse.json(payload, { status });
  }
}

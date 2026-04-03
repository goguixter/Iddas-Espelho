import { NextRequest, NextResponse } from "next/server";
import { deleteDocumentRecord, getDocumentRecord } from "@/lib/documents/repository";

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

  deleteDocumentRecord(recordId);

  return NextResponse.json({ success: true });
}

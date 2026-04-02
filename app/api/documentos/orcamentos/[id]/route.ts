import { NextRequest, NextResponse } from "next/server";
import { getOrcamentoDocumentSource } from "@/lib/documents/repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = getOrcamentoDocumentSource(id);

  if (!source) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  return NextResponse.json(source);
}

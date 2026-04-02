import { NextRequest, NextResponse } from "next/server";
import { getPessoaDocumentSource } from "@/lib/documents/repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = getPessoaDocumentSource(id);

  if (!source) {
    return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  }

  return NextResponse.json(source);
}

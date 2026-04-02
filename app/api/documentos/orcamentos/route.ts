import { NextRequest, NextResponse } from "next/server";
import { searchOrcamentoDocumentOptions } from "@/lib/documents/repository";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json([]);
  }

  return NextResponse.json(searchOrcamentoDocumentOptions(query));
}

import { NextRequest, NextResponse } from "next/server";
import { searchFornecedorDocumentOptions } from "@/lib/documents/repository";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(searchFornecedorDocumentOptions(query));
}

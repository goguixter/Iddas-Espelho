import { NextRequest, NextResponse } from "next/server";
import { searchPessoaDocumentOptions } from "@/lib/documents/repository";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(searchPessoaDocumentOptions(query));
}

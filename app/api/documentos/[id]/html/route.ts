import { NextRequest } from "next/server";
import { getDocumentRecord } from "@/lib/documents/repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const document = getDocumentRecord(Number(id));

  if (!document) {
    return new Response("Documento não encontrado.", { status: 404 });
  }

  return new Response(document.html_snapshot, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

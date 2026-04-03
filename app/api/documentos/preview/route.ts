import { NextRequest, NextResponse } from "next/server";
import { buildApiErrorResponse } from "@/lib/api/errors";
import { resolveDocumentDraft } from "@/lib/documents/generate";
import { documentRequestSchema } from "@/lib/documents/schema";

export async function POST(request: NextRequest) {
  try {
    const payload = documentRequestSchema.parse(await request.json());
    const { document } = resolveDocumentDraft(payload);
    return NextResponse.json({ html: document.html, title: document.title });
  } catch (error) {
    const { payload, status } = buildApiErrorResponse(
      error,
      "Não foi possível gerar a prévia do documento.",
      400,
    );
    return NextResponse.json(payload, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { DocumentDraftError, resolveDocumentDraft } from "@/lib/documents/generate";
import { documentRequestSchema } from "@/lib/documents/schema";

export async function POST(request: NextRequest) {
  try {
    const payload = documentRequestSchema.parse(await request.json());
    const { document } = resolveDocumentDraft(payload);
    return NextResponse.json({ html: document.html, title: document.title });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof DocumentDraftError || error instanceof Error
            ? error.message
            : "Não foi possível gerar a prévia do documento.",
      },
      { status: error instanceof DocumentDraftError ? error.status : 400 },
    );
  }
}

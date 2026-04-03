import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DocumentDraftError, resolveDocumentDraft } from "@/lib/documents/generate";
import { insertDocumentRecord } from "@/lib/documents/repository";
import { documentRequestSchema } from "@/lib/documents/schema";

export async function POST(request: NextRequest) {
  try {
    const payload = documentRequestSchema.parse(await request.json());
    const now = new Date().toISOString();
    const { document, entityId, entityType } = resolveDocumentDraft(payload);
    const id = insertDocumentRecord({
      created_at: now,
      entity_id: entityId,
      entity_type: entityType,
      html_snapshot: document.html,
      payload_json: JSON.stringify(document.payload),
      template_key: document.templateKey,
      template_version: document.templateVersion,
      title: document.title,
      updated_at: now,
    });

    return NextResponse.json({
      id,
      title: document.title,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Preencha os campos obrigatórios para gerar o documento." },
        { status: 400 },
      );
    }

    if (error instanceof DocumentDraftError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Não foi possível gerar o documento." },
      { status: 500 },
    );
  }
}

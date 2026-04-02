import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDocumentTemplate, updateDocumentTemplateState } from "@/lib/documents/repository";

const updateTemplateSchema = z.object({
  isActive: z.boolean(),
  key: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const payload = updateTemplateSchema.parse(await request.json());
    const template = getDocumentTemplate(payload.key);

    if (!template) {
      return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
    }

    updateDocumentTemplateState(payload.key, payload.isActive);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o template." }, { status: 400 });
  }
}

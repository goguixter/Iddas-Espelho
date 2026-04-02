import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildContractDocument,
  buildManualContractDocument,
} from "@/lib/documents/contract-template";
import {
  getOrcamentoDocumentSource,
  getPessoaDocumentSource,
  insertDocumentRecord,
} from "@/lib/documents/repository";
import { CONTRACT_TEMPLATE_KEY } from "@/lib/documents/types";

const createDocumentSchema = z.object({
  bairro: z.string().trim().min(1),
  cep: z.string().trim().min(1),
  cidade: z.string().trim().min(1),
  condicoesTarifarias: z.string().trim().optional(),
  estado: z.string().trim().min(2).max(2),
  fornecedor: z.string().trim().optional(),
  localizadorReserva: z.string().trim().optional(),
  logradouro: z.string().trim().min(1),
  manualContratanteDocumento: z.string().trim().optional(),
  manualContratanteDocumentoLabel: z.string().trim().optional(),
  manualContratanteNome: z.string().trim().optional(),
  manualPassageiros: z
    .array(
      z.object({
        dataNascimento: z.string().trim().optional(),
        documento: z.string().trim().optional(),
        nome: z.string().trim().min(1),
      }),
    )
    .optional(),
  mode: z.enum(["manual", "orcamento"]).default("orcamento"),
  numero: z.string().trim().min(1),
  orcamentoId: z.string().trim().optional(),
  passageirosPessoaIds: z.array(z.string().trim().min(1)).optional(),
  pessoaContratanteId: z.string().trim().optional(),
  servicoContratado: z.string().trim().optional(),
  templateKey: z.literal(CONTRACT_TEMPLATE_KEY).default(CONTRACT_TEMPLATE_KEY),
});

export async function POST(request: NextRequest) {
  try {
    const payload = createDocumentSchema.parse(await request.json());
    const now = new Date().toISOString();

    if (payload.mode === "orcamento") {
      if (!payload.orcamentoId?.trim()) {
        return NextResponse.json(
          { error: "Selecione um orçamento para gerar o documento." },
          { status: 400 },
        );
      }

      const source = getOrcamentoDocumentSource(payload.orcamentoId);

      if (!source) {
        return NextResponse.json(
          { error: "Orçamento não encontrado para gerar o documento." },
          { status: 404 },
        );
      }

      const document = buildContractDocument(source, payload);
      const id = insertDocumentRecord({
        created_at: now,
        entity_id: source.id,
        entity_type: "orcamento",
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
    }

    const contratante = payload.pessoaContratanteId
      ? getPessoaDocumentSource(payload.pessoaContratanteId)
      : null;
    const passageiros = (payload.passageirosPessoaIds ?? [])
      .map((id) => getPessoaDocumentSource(id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));

    if (!contratante && !payload.manualContratanteNome?.trim()) {
      return NextResponse.json(
        { error: "Informe o contratante manualmente ou selecione uma pessoa." },
        { status: 400 },
      );
    }

    const document = buildManualContractDocument(payload, {
      contratante,
      passageiros,
    });
    const id = insertDocumentRecord({
      created_at: now,
      entity_id: payload.pessoaContratanteId?.trim() || payload.orcamentoId?.trim() || "manual",
      entity_type: "manual",
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

    return NextResponse.json(
      { error: "Não foi possível gerar o documento." },
      { status: 500 },
    );
  }
}

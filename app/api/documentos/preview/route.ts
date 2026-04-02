import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildContractDocument,
  buildManualContractDocument,
} from "@/lib/documents/contract-template";
import {
  getOrcamentoDocumentSource,
  getPessoaDocumentSource,
} from "@/lib/documents/repository";
import { CONTRACT_TEMPLATE_KEY } from "@/lib/documents/types";

const previewDocumentSchema = z.object({
  bairro: z.string().trim().min(1),
  cancelamentosReembolsos: z.string().trim().optional(),
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
  remarcacoes: z.string().trim().optional(),
  servicoContratado: z.string().trim().optional(),
  templateKey: z.literal(CONTRACT_TEMPLATE_KEY).default(CONTRACT_TEMPLATE_KEY),
});

export async function POST(request: NextRequest) {
  try {
    const payload = previewDocumentSchema.parse(await request.json());

    if (payload.mode === "orcamento") {
      if (!payload.orcamentoId?.trim()) {
        return NextResponse.json({ error: "Selecione um orçamento." }, { status: 400 });
      }

      const source = getOrcamentoDocumentSource(payload.orcamentoId);

      if (!source) {
        return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
      }

      const document = buildContractDocument(source, payload);
      return NextResponse.json({ html: document.html, title: document.title });
    }

    const contratante = payload.pessoaContratanteId
      ? getPessoaDocumentSource(payload.pessoaContratanteId)
      : null;
    const passageiros = (payload.passageirosPessoaIds ?? [])
      .map((id) => getPessoaDocumentSource(id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));

    const document = buildManualContractDocument(payload, {
      contratante,
      passageiros,
    });

    return NextResponse.json({ html: document.html, title: document.title });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível gerar a prévia do documento." },
      { status: 400 },
    );
  }
}

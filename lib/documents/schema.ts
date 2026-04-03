import { z } from "zod";
import { CONTRACT_TEMPLATE_KEY } from "@/lib/documents/types";

export const documentRequestSchema = z.object({
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

export type DocumentRequestInput = z.infer<typeof documentRequestSchema>;

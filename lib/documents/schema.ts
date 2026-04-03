import { z } from "zod";
import { CONTRACT_TEMPLATE_KEY } from "@/lib/documents/types";

const requiredText = (label: string) => z.string().trim().min(1, `${label} é obrigatório.`);

export const documentRequestSchema = z.object({
  bairro: requiredText("Bairro"),
  cep: requiredText("CEP"),
  cidade: requiredText("Cidade"),
  condicoesTarifarias: z.string().trim().optional(),
  estado: z
    .string()
    .trim()
    .min(2, "UF deve ter 2 caracteres.")
    .max(2, "UF deve ter 2 caracteres."),
  fornecedor: z.string().trim().optional(),
  localizadorReserva: z.string().trim().optional(),
  logradouro: requiredText("Logradouro"),
  mode: z.enum(["manual", "orcamento"]).default("orcamento"),
  numero: requiredText("Número"),
  orcamentoId: z.string().trim().optional(),
  passageirosPessoaIds: z.array(z.string().trim().min(1)).optional(),
  pessoaContratanteId: z.string().trim().optional(),
  servicoContratado: z.string().trim().optional(),
  templateKey: z.literal(CONTRACT_TEMPLATE_KEY).default(CONTRACT_TEMPLATE_KEY),
});

export type DocumentRequestInput = z.infer<typeof documentRequestSchema>;

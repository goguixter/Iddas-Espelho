export const CONTRACT_TEMPLATE_KEY = "contrato_intermediacao";
export const CONTRACT_TEMPLATE_VERSION = 1;

export type DocumentTemplateRecord = {
  description: string;
  is_active: number;
  key: string;
  title: string;
  updated_at: string;
  version: number;
};

export type ContractDocumentFormInput = {
  bairro: string;
  cep: string;
  cidade: string;
  condicoesTarifarias?: string;
  estado: string;
  fornecedor?: string;
  localizadorReserva?: string;
  logradouro: string;
  manualContratanteDocumento?: string;
  manualContratanteDocumentoLabel?: string;
  manualContratanteNome?: string;
  manualPassageiros?: Array<{
    dataNascimento?: string;
    documento?: string;
    nome: string;
  }>;
  mode: "manual" | "orcamento";
  numero: string;
  orcamentoId?: string;
  passageirosPessoaIds?: string[];
  pessoaContratanteId?: string;
  servicoContratado?: string;
};

export type DocumentRecord = {
  created_at: string;
  entity_id: string;
  entity_type: string;
  html_snapshot: string;
  id: number;
  payload_json: string;
  template_key: string;
  template_version: number;
  title: string;
  updated_at: string;
};

export type OrcamentoDocumentSource = {
  clienteBairro: string | null;
  clienteCpf: string | null;
  clienteEmail: string | null;
  clienteEndereco: string | null;
  clienteEstado: string | null;
  clienteNome: string;
  clienteNumero: string | null;
  clienteTelefone: string | null;
  clienteCep: string | null;
  clienteCidade: string | null;
  createdAt: string | null;
  id: string;
  identificador: string | null;
  pessoaCpf: string | null;
  pessoaEmail: string | null;
  pessoaNome: string | null;
  raw: Record<string, unknown> | null;
  solicitacaoData: string | null;
  solicitacaoEmail: string | null;
  solicitacaoNome: string | null;
  solicitacaoTelefone: string | null;
};

export type PessoaDocumentSource = {
  bairro: string | null;
  celular: string | null;
  cep: string | null;
  cidade: string | null;
  complemento: string | null;
  cpf: string | null;
  createdAt: string | null;
  email: string | null;
  endereco: string | null;
  estado: string | null;
  id: string;
  nascimento: string | null;
  nome: string | null;
  numero: string | null;
  passaporte: string | null;
  raw: Record<string, unknown> | null;
};

export type RecentPessoaDocumentOption = {
  cidade: string | null;
  cpf: string | null;
  id: string;
  nome: string | null;
};

export type RecentOrcamentoDocumentOption = {
  cliente_nome: string | null;
  id: string;
  identificador: string | null;
  situacao_cor?: string | null;
  situacao_nome?: string | null;
};

import { formatCurrencyValue } from "@/lib/formatting";
import { normalizeTabKey, parseRawJson, pickObjectString } from "@/lib/query-helpers";

type OrcamentoProjectionRow = {
  cliente_nome: string | null;
  cliente_pessoa_id: string | null;
  id: string;
  identificador: string | null;
  passageiro_count: number;
  raw_json: string;
  solicitacao_nome: string | null;
  situacao_cor: string | null;
  situacao_nome: string | null;
  updated_at: string;
};

type OrcamentoKanbanProjectionRow = OrcamentoProjectionRow & {
  situacao_codigo: string | null;
  situacao_ordem: string;
};

export function mapOrcamentoListItem(row: OrcamentoProjectionRow) {
  const raw = parseRawJson(row.raw_json);
  const situacaoNome =
    row.situacao_nome ??
    pickObjectString(raw, ["nome_situacao", "situacao_nome"]);
  const situacaoCor =
    row.situacao_cor ??
    pickObjectString(raw, ["cor_situacao", "situacao_cor"]);

  return {
    cliente_nome:
      row.cliente_nome ??
      pickObjectString(raw, ["nome_cliente", "cliente_nome"]) ??
      row.solicitacao_nome,
    cliente_pessoa_id: row.cliente_pessoa_id,
    email_cliente: pickObjectString(raw, ["email_cliente"]),
    id: row.id,
    identificador: row.identificador,
    passageiro_count: row.passageiro_count,
    situacao_cor: situacaoCor,
    situacao_nome: situacaoNome,
    tag: row.identificador,
    telefone_cliente: pickObjectString(raw, ["telefone_cliente", "celular_cliente"]),
    updated_at: row.updated_at,
  };
}

export function mapOrcamentoKanbanItem(row: OrcamentoKanbanProjectionRow) {
  const raw = parseRawJson(row.raw_json);
  const situacaoNome =
    row.situacao_nome ??
    pickObjectString(raw, ["nome_situacao", "situacao_nome"]);
  const situacaoCor =
    row.situacao_cor ??
    pickObjectString(raw, ["cor_situacao", "situacao_cor"]);
  const situacaoCodigo =
    row.situacao_codigo ??
    pickObjectString(raw, ["situacao", "codigo_situacao"]);
  const situacaoKey = normalizeTabKey(situacaoCodigo ?? situacaoNome ?? "sem-situacao");
  const rawObject =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;

  return {
    cliente_nome:
      row.cliente_nome ??
      pickObjectString(raw, ["nome_cliente", "cliente_nome"]) ??
      row.solicitacao_nome,
    cliente_pessoa_id: row.cliente_pessoa_id,
    email_cliente: pickObjectString(raw, ["email_cliente"]),
    id: row.id,
    identificador: row.identificador,
    passageiro_count: row.passageiro_count,
    situacao_codigo: situacaoCodigo,
    situacao_cor: situacaoCor,
    situacao_key: situacaoKey,
    situacao_nome: situacaoNome ?? "Sem situação",
    situacao_ordem: row.situacao_ordem,
    tag: row.identificador,
    telefone_cliente: pickObjectString(raw, ["telefone_cliente", "celular_cliente"]),
    updated_at: row.updated_at,
    valor_total: formatCurrencyValue(
      pickObjectString(raw, ["valor", "orcado"]) ??
        rawObject?.valor ??
        rawObject?.orcado,
    ),
  };
}

export function getDefaultSituacaoTabs() {
  return [
    { key: "e", label: "NOVOS LEADS", color: "#86befd", ordem: "100" },
    { key: "b", label: "ORÇAMENTO SOLICITADO", color: "#ffd500", ordem: "103" },
    { key: "y", label: "COTAÇÃO EM ANDAMENTO", color: "#ff9147", ordem: "200" },
    { key: "c", label: "ORÇAMENTO PRONTO", color: "#379a98", ordem: "300" },
    { key: "n", label: "VENDEDOR ENVIOU", color: "#ffa3a3", ordem: "301" },
    { key: "w", label: "FOLLOW UP", color: "#d494ff", ordem: "302" },
    { key: "z", label: "AGENDADO", color: "#e175c4", ordem: "303" },
    { key: "x", label: "EM EMISSÃO", color: "#0f3ae6", ordem: "304" },
    { key: "a", label: "APROVADO", color: "#3bdf30", ordem: "400" },
    { key: "r", label: "REPROVADO", color: "#ee2f2f", ordem: "500" },
  ];
}

export function getSituacaoFlowOrder(key: string, label: string) {
  const normalizedLabel = normalizeTabKey(label);
  const lookupKey = key || normalizedLabel;

  const orderMap: Record<string, number> = {
    e: 100,
    "novas-solicitacoes": 100,
    b: 103,
    solicitado: 103,
    "orcamento-solicitado": 103,
    y: 200,
    andamento: 200,
    "cotacao-em-andamento": 200,
    c: 300,
    pronto: 300,
    "orcamento-pronto": 300,
    n: 301,
    enviado: 301,
    "vendedor-enviou": 301,
    w: 302,
    "follow-up": 302,
    z: 303,
    agendado: 303,
    x: 304,
    "em-emissao": 304,
    a: 400,
    aprovado: 400,
    r: 500,
    reprovado: 500,
  };

  return orderMap[lookupKey] ?? orderMap[normalizedLabel] ?? 9999;
}

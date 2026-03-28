import { db } from "@/lib/db";
import { getSyncStateRecord } from "@/lib/sync/store";

export function parsePageParam(input?: string | null) {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function parseSearchParam(input?: string | null) {
  return input?.trim() ?? "";
}

export function normalizeTabKey(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function getDashboardMetrics() {
  const orcamentos = readCount("orcamentos");
  const pessoas = readCount("pessoas");
  const vendas = readCount("vendas");

  return { orcamentos, pessoas, vendas };
}

export async function getSyncState() {
  return getSyncStateRecord();
}

export async function getOrcamentosPage(page: number, perPage: number, query = "") {
  const where = buildLikeWhere(query, [
    "o.id",
    "o.identificador",
    "o.cliente_pessoa_id",
    "p.nome",
    "o.raw_json",
  ]);
  const total = readFilteredCount(
    `
      SELECT COUNT(*)
      FROM orcamentos o
      LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
      ${where.clause}
    `,
    where.params,
  );
  const rows = db
    .prepare(
      `
        SELECT
          o.id,
          o.identificador,
          o.cliente_pessoa_id,
          COALESCE(s.nome, o.situacao_nome) AS situacao_nome,
          COALESCE(s.cor, o.situacao_cor) AS situacao_cor,
          o.passageiro_count,
          o.raw_json,
          o.updated_at,
          p.nome AS cliente_nome
        FROM orcamentos o
        LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
        LEFT JOIN situacoes s ON s.codigo = o.situacao_codigo
        ${where.clause}
        ORDER BY datetime(o.updated_at) DESC, o.id DESC
        LIMIT ? OFFSET ?
      `,
    )
    .all(...where.params, perPage, (page - 1) * perPage) as Array<{
      cliente_nome: string | null;
      cliente_pessoa_id: string | null;
      id: string;
      identificador: string | null;
      passageiro_count: number;
      raw_json: string;
      situacao_cor: string | null;
      situacao_nome: string | null;
      updated_at: string;
    }>;

  const items = rows.map((row) => {
    const raw = parseRawJson(row.raw_json);
    const situacaoNome =
      row.situacao_nome ??
      pickObjectString(raw, ["nome_situacao", "situacao_nome"]);
    const situacaoCor =
      row.situacao_cor ??
      pickObjectString(raw, ["cor_situacao", "situacao_cor"]);

    return {
      cliente_nome: row.cliente_nome ?? pickObjectString(raw, ["nome_cliente", "cliente_nome"]),
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
  });

  return { items, page, perPage, total };
}

export async function getOrcamentosKanbanPage(
  page: number,
  perPage: number,
  query = "",
  situacao = "",
) {
  const where = buildLikeWhere(query, [
    "o.id",
    "o.identificador",
    "o.cliente_pessoa_id",
    "p.nome",
    "o.raw_json",
  ]);
  const rows = db
    .prepare(
      `
        SELECT
          o.id,
          o.identificador,
          o.cliente_pessoa_id,
          o.situacao_codigo,
          COALESCE(s.nome, o.situacao_nome) AS situacao_nome,
          COALESCE(s.cor, o.situacao_cor) AS situacao_cor,
          COALESCE(s.ordem, '') AS situacao_ordem,
          o.passageiro_count,
          o.raw_json,
          o.updated_at,
          p.nome AS cliente_nome
        FROM orcamentos o
        LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
        LEFT JOIN situacoes s ON s.codigo = o.situacao_codigo
        ${where.clause}
        ORDER BY datetime(o.updated_at) DESC, o.id DESC
      `,
    )
    .all(...where.params) as Array<{
      cliente_nome: string | null;
      cliente_pessoa_id: string | null;
      id: string;
      identificador: string | null;
      passageiro_count: number;
      raw_json: string;
      situacao_codigo: string | null;
      situacao_cor: string | null;
      situacao_nome: string | null;
      situacao_ordem: string;
      updated_at: string;
    }>;

  const items = rows.map((row) => {
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
      cliente_nome: row.cliente_nome ?? pickObjectString(raw, ["nome_cliente", "cliente_nome"]),
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
  });

  const situacoes = db
    .prepare(
      `
        SELECT codigo, nome, cor, ordem
        FROM situacoes
      `,
    )
    .all() as Array<{
      codigo: string | null;
      cor: string | null;
      nome: string | null;
      ordem: string | null;
    }>;

  const tabsMap = new Map<
    string,
    { color: string | null; count: number; key: string; label: string; ordem: string }
  >();

  for (const tab of getDefaultSituacaoTabs()) {
    tabsMap.set(tab.key, { ...tab, count: 0 });
  }

  for (const situacaoItem of situacoes) {
    const key = normalizeTabKey(situacaoItem.codigo ?? situacaoItem.nome ?? "");
    if (!key) {
      continue;
    }

    const current = tabsMap.get(key);
    tabsMap.set(key, {
      color: situacaoItem.cor ?? current?.color ?? null,
      count: current?.count ?? 0,
      key,
      label: situacaoItem.nome ?? current?.label ?? "Sem situação",
      ordem: situacaoItem.ordem ?? current?.ordem ?? "",
    });
  }

  for (const item of items) {
    const current = tabsMap.get(item.situacao_key);
    if (current) {
      current.count += 1;
      if (!current.color && item.situacao_cor) {
        current.color = item.situacao_cor;
      }
      if ((!current.label || current.label === "Sem situação") && item.situacao_nome) {
        current.label = item.situacao_nome;
      }
      continue;
    }

    tabsMap.set(item.situacao_key, {
      color: item.situacao_cor,
      count: 1,
      key: item.situacao_key,
      label: item.situacao_nome ?? "Sem situação",
      ordem: item.situacao_ordem ?? "",
    });
  }

  const tabs = [...tabsMap.values()].sort((left, right) => {
    const leftOrder = Number(left.ordem);
    const rightOrder = Number(right.ordem);

    if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder) && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftFlowOrder = getSituacaoFlowOrder(left.key, left.label);
    const rightFlowOrder = getSituacaoFlowOrder(right.key, right.label);

    if (leftFlowOrder !== rightFlowOrder) {
      return leftFlowOrder - rightFlowOrder;
    }

    return left.label.localeCompare(right.label, "pt-BR");
  });

  const activeSituacao =
    tabs.find((tab) => tab.key === situacao)?.key ??
    tabs[0]?.key ??
    "sem-situacao";
  const filteredItems = items.filter((item) => item.situacao_key === activeSituacao);
  const total = filteredItems.length;
  const pagedItems = filteredItems.slice((page - 1) * perPage, page * perPage);

  return {
    activeSituacao,
    items: pagedItems,
    page,
    perPage,
    tabs,
    total,
  };
}

function getDefaultSituacaoTabs() {
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

export async function getPessoasPage(page: number, perPage: number, query = "") {
  const where = buildLikeWhere(query, [
    "id",
    "nome",
    "email",
    "cpf",
    "raw_json",
  ]);
  const total = readFilteredCount(
    `
      SELECT COUNT(*)
      FROM pessoas
      ${where.clause}
    `,
    where.params,
  );
  const rows = db
    .prepare(
      `
          SELECT id, nome, email, cpf, raw_json, updated_at
        FROM pessoas
        ${where.clause}
        ORDER BY datetime(updated_at) DESC, id DESC
        LIMIT ? OFFSET ?
      `,
    )
    .all(...where.params, perPage, (page - 1) * perPage) as Array<{
      cpf: string | null;
      email: string | null;
      id: string;
      nome: string | null;
      raw_json: string;
      updated_at: string;
    }>;

  const items = rows.map((row) => {
    const raw = parseRawJson(row.raw_json);

    return {
      cpf: row.cpf,
      email: row.email,
      id: row.id,
      nome: row.nome,
      telefone: pickObjectString(raw, ["telefone", "celular", "telefone_cliente"]),
      updated_at: row.updated_at,
    };
  });

  return { items, page, perPage, total };
}

export async function getVendasPage(page: number, perPage: number, query = "") {
  const where = buildLikeWhere(query, [
    "v.id",
    "v.orcamento_identificador",
    "v.orcamento_id",
    "p.nome",
    "v.raw_json",
    "o.raw_json",
  ]);
  const total = readFilteredCount(
    `
      SELECT COUNT(*)
      FROM vendas v
      LEFT JOIN orcamentos o ON o.id = v.orcamento_id
      LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
      ${where.clause}
    `,
    where.params,
  );
  const rows = db
    .prepare(
      `
        SELECT
          v.id,
          v.orcamento_identificador,
          v.status,
          v.orcamento_id,
          v.updated_at,
          o.cliente_pessoa_id,
          o.raw_json AS orcamento_raw_json,
          p.nome AS cliente_nome,
          v.raw_json AS venda_raw_json
        FROM vendas v
        LEFT JOIN orcamentos o ON o.id = v.orcamento_id
        LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
        ${where.clause}
        ORDER BY datetime(v.updated_at) DESC, v.id DESC
        LIMIT ? OFFSET ?
      `,
    )
    .all(...where.params, perPage, (page - 1) * perPage) as Array<{
      cliente_nome: string | null;
      cliente_pessoa_id: string | null;
      id: string;
      orcamento_id: string;
      orcamento_identificador: string | null;
      orcamento_raw_json: string | null;
      status: string | null;
      updated_at: string;
      venda_raw_json: string;
    }>;

  const items = rows.map((row) => {
    const raw = parseRawJson(row.venda_raw_json);
    const orcamentoRaw = parseNullableRawJson(row.orcamento_raw_json);
    const clienteNome =
      row.cliente_nome ??
      pickObjectString(raw, ["cliente"]) ??
      pickObjectString(orcamentoRaw, ["nome_cliente"]);

    return {
      cliente_nome: clienteNome,
      email_cliente:
        pickObjectString(raw, ["email_cliente"]) ??
        pickObjectString(orcamentoRaw, ["email_cliente"]),
      id: row.id,
      orcamento_id: row.orcamento_id,
      orcamento_identificador: row.orcamento_identificador,
      status: row.status,
      tag: row.orcamento_identificador,
      telefone_cliente:
        pickObjectString(raw, ["telefone_cliente", "telefone"]) ??
        pickObjectString(orcamentoRaw, ["telefone_cliente"]),
      updated_at: row.updated_at,
      valor_total: formatCurrencyValue(
        pickObjectString(raw, ["venda", "valor"]) ??
          pickObjectString(orcamentoRaw, ["venda", "valor"]),
      ),
    };
  });

  return { items, page, perPage, total };
}

export async function getPessoaDetail(id: string) {
  const pessoa = db
    .prepare(
      `
        SELECT id, nome, email, cpf, updated_at, raw_json
        FROM pessoas
        WHERE id = ?
      `,
    )
    .get(id) as
    | {
        cpf: string | null;
        email: string | null;
        id: string;
        nome: string | null;
        raw_json: string;
        updated_at: string;
      }
    | undefined;

  if (!pessoa) {
    return null;
  }

  const orcamentos = db
    .prepare(
      `
        SELECT o.id, o.identificador, p.nome AS cliente_nome
        FROM orcamentos o
        LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
        WHERE o.cliente_pessoa_id = ?
           OR o.passageiro_ids_json LIKE ?
        ORDER BY datetime(o.updated_at) DESC, o.id DESC
      `,
    )
    .all(id, `%\"${id}\"%`) as Array<{
      cliente_nome: string | null;
      id: string;
      identificador: string | null;
    }>;

  return {
    ...pessoa,
    orcamentos,
    raw: parseRawJson(pessoa.raw_json),
  };
}

export async function getOrcamentoDetail(id: string) {
  const orcamento = db
    .prepare(
      `
        SELECT
          o.id,
          o.identificador,
          o.cliente_pessoa_id,
          COALESCE(s.nome, o.situacao_nome) AS situacao_nome,
          COALESCE(s.cor, o.situacao_cor) AS situacao_cor,
          o.passageiro_count,
          o.passageiro_ids_json,
          o.updated_at,
          o.raw_json,
          p.nome AS cliente_nome
        FROM orcamentos o
        LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
        LEFT JOIN situacoes s ON s.codigo = o.situacao_codigo
        WHERE o.id = ?
      `,
    )
    .get(id) as
    | {
        cliente_nome: string | null;
        cliente_pessoa_id: string | null;
        id: string;
        identificador: string | null;
        passageiro_count: number;
        passageiro_ids_json: string;
        raw_json: string;
        situacao_cor: string | null;
        situacao_nome: string | null;
        updated_at: string;
      }
    | undefined;

  if (!orcamento) {
    return null;
  }

  const passageiroIds = JSON.parse(orcamento.passageiro_ids_json) as string[];
  const passageiros =
    passageiroIds.length > 0
      ? (db
          .prepare(
            `
              SELECT id, nome
              FROM pessoas
              WHERE id IN (${passageiroIds.map(() => "?").join(",")})
            `,
          )
          .all(...passageiroIds) as Array<{ id: string; nome: string | null }>)
      : [];

  const vendas = db
    .prepare(
      `
        SELECT id, status
        FROM vendas
        WHERE orcamento_id = ?
        ORDER BY datetime(updated_at) DESC, id DESC
      `,
    )
    .all(id) as Array<{ id: string; status: string | null }>;

  return {
    ...orcamento,
    passageiros,
    situacao_cor:
      orcamento.situacao_cor ??
      pickObjectString(parseRawJson(orcamento.raw_json), ["cor_situacao", "situacao_cor"]),
    situacao_nome:
      orcamento.situacao_nome ??
      pickObjectString(parseRawJson(orcamento.raw_json), ["nome_situacao", "situacao_nome"]),
    raw: parseRawJson(orcamento.raw_json),
    vendas,
  };
}

export async function getVendaDetail(id: string) {
  const venda = db
    .prepare(
      `
        SELECT
          v.id,
          v.orcamento_id,
          v.orcamento_identificador,
          v.status,
          v.updated_at,
          v.raw_json,
          o.cliente_pessoa_id,
          o.raw_json AS orcamento_raw_json,
          p.nome AS cliente_nome
        FROM vendas v
        LEFT JOIN orcamentos o ON o.id = v.orcamento_id
        LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
        WHERE v.id = ?
      `,
    )
    .get(id) as
    | {
        cliente_nome: string | null;
        cliente_pessoa_id: string | null;
        id: string;
        orcamento_id: string | null;
        orcamento_identificador: string | null;
        orcamento_raw_json: string | null;
        raw_json: string;
        status: string | null;
        updated_at: string;
      }
    | undefined;

  if (!venda) {
    return null;
  }

  return {
    ...venda,
    cliente_nome:
      venda.cliente_nome ??
      pickObjectString(parseRawJson(venda.raw_json), ["cliente"]) ??
      pickObjectString(parseNullableRawJson(venda.orcamento_raw_json), ["nome_cliente"]),
    raw: parseRawJson(venda.raw_json),
  };
}

function readCount(table: "orcamentos" | "pessoas" | "vendas") {
  const row = db
    .prepare(`SELECT COUNT(*) as total FROM ${table}`)
    .get() as { total: number };

  return row.total;
}

function readFilteredCount(sql: string, params: unknown[]) {
  const row = db.prepare(sql).get(...params) as { "COUNT(*)": number } | { total: number };
  return "total" in row ? row.total : row["COUNT(*)"];
}

function buildLikeWhere(query: string, columns: string[]) {
  const normalized = query.trim();

  if (!normalized || columns.length === 0) {
    return {
      clause: "",
      params: [] as unknown[],
    };
  }

  const like = `%${normalized}%`;

  return {
    clause: `WHERE (${columns.map((column) => `${column} LIKE ?`).join(" OR ")})`,
    params: columns.map(() => like) as unknown[],
  };
}

function getSituacaoFlowOrder(key: string, label: string) {
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

function parseRawJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function parseNullableRawJson(value: string | null) {
  if (!value) {
    return null;
  }

  return parseRawJson(value);
}

function pickObjectString(
  input: unknown,
  keys: string[],
): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  for (const key of keys) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function formatCurrencyValue(input: unknown) {
  const numericValue = parseNumericValue(input);

  if (numericValue === null) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
}

function parseNumericValue(input: unknown) {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

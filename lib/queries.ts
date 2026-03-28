import { db } from "@/lib/db";
import { getSyncStateRecord } from "@/lib/sync/store";

export function parsePageParam(input?: string | null) {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function parseSearchParam(input?: string | null) {
  return input?.trim() ?? "";
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
          o.passageiro_count,
          o.raw_json,
          o.updated_at,
          p.nome AS cliente_nome
        FROM orcamentos o
        LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
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
      updated_at: string;
    }>;

  const items = rows.map((row) => {
    const raw = parseRawJson(row.raw_json);

    return {
      cliente_nome: row.cliente_nome ?? pickObjectString(raw, ["nome_cliente", "cliente_nome"]),
      cliente_pessoa_id: row.cliente_pessoa_id,
      email_cliente: pickObjectString(raw, ["email_cliente"]),
      id: row.id,
      identificador: row.identificador,
      passageiro_count: row.passageiro_count,
      tag: row.identificador,
      telefone_cliente: pickObjectString(raw, ["telefone_cliente", "celular_cliente"]),
      updated_at: row.updated_at,
    };
  });

  return { items, page, perPage, total };
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
          o.passageiro_count,
          o.passageiro_ids_json,
          o.updated_at,
          o.raw_json,
          p.nome AS cliente_nome
        FROM orcamentos o
        LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
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

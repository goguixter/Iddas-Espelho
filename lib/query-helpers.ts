export function normalizeTabKey(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function readFilteredCountResult(row: { "COUNT(*)": number } | { total: number }) {
  return "total" in row ? row.total : row["COUNT(*)"];
}

export function buildLikeWhere(query: string, columns: string[]) {
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

export function buildSolicitacaoDateWhere(date: string, prefix: "WHERE" | "AND") {
  const normalized = date.trim();

  if (!normalized) {
    return {
      clause: "",
      params: [] as unknown[],
    };
  }

  return {
    clause: ` ${prefix} substr(sl.data_solicitacao, 1, 10) = ?`,
    params: [normalized] as unknown[],
  };
}

export function formatPessoaTipos(row: {
  tipo_cliente: string | null;
  tipo_fornecedor: string | null;
  tipo_passageiro: string | null;
  tipo_representante: string | null;
}) {
  const labels: string[] = [];

  if (row.tipo_cliente === "S") labels.push("Cliente");
  if (row.tipo_passageiro === "S") labels.push("Passageiro");
  if (row.tipo_fornecedor === "S") labels.push("Fornecedor");
  if (row.tipo_representante === "S") labels.push("Representante");

  return labels.join(" · ") || null;
}

export function parseRawJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function parseNullableRawJson(value: string | null) {
  if (!value) {
    return null;
  }

  return parseRawJson(value);
}

export function pickObjectString(input: unknown, keys: string[]) {
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

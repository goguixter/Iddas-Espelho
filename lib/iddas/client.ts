import { env } from "@/lib/env";
import { logSync } from "@/lib/sync/logger";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

type JsonObject = {
  [key: string]: JsonValue;
};

let cachedToken: { value: string; expiresAt: number } | null = null;
const MAX_RETRIES = 4;

export async function fetchIddasList(
  resource: string,
  page: number,
  perPage: number,
  extra: Record<string, string> = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    ...extra,
  });

  const payload = await requestIddas<JsonValue>(`${resource}?${params.toString()}`);
  const items = unwrapArray(payload);

  logSync("info", "iddas.list.response", {
    extra,
    page,
    per_page: perPage,
    resource,
    returned: items.length,
  });

  return items;
}

export async function fetchIddasDetail(resource: string, id: string) {
  const payload = await requestIddas<JsonValue>(`${resource}/${id}`);
  const item = unwrapObject(payload);

  logSync("info", "iddas.detail.response", {
    id,
    resource,
    returned_id:
      typeof item.id === "string" || typeof item.id === "number"
        ? String(item.id)
        : null,
  });

  return item;
}

async function requestIddas<T>(resourcePath: string): Promise<T> {
  const token = await getBearerToken();
  const url = new URL(resourcePath.replace(/^\//, ""), `${env.IDDAS_API_BASE_URL}/`);

  logSync("info", "iddas.request.start", {
    method: "GET",
    path: url.pathname + url.search,
  });

  const response = await fetchWithRetry(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    logSync("error", "iddas.request.error", {
      method: "GET",
      path: url.pathname + url.search,
      status: response.status,
    });
    throw new Error(`IDDAS respondeu ${response.status} ao consultar ${url.pathname}.`);
  }

  logSync("info", "iddas.request.success", {
    method: "GET",
    path: url.pathname + url.search,
    status: response.status,
  });

  return (await response.json()) as T;
}

async function getBearerToken() {
  if (!env.IDDAS_ACCESS_KEY) {
    throw new Error("Defina IDDAS_ACCESS_KEY no ambiente antes de sincronizar.");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const tokenUrl = new URL(
    env.IDDAS_TOKEN_ENDPOINT.replace(/^\//, ""),
    `${env.IDDAS_API_BASE_URL}/`,
  );

  logSync("info", "iddas.auth.start", {
    path: tokenUrl.pathname,
  });

  const response = await fetchWithRetry(tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chave: env.IDDAS_ACCESS_KEY,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    logSync("error", "iddas.auth.error", {
      path: tokenUrl.pathname,
      status: response.status,
    });
    throw new Error(
      `Falha ao gerar bearer token no IDDAS (${response.status}). Ajuste IDDAS_TOKEN_ENDPOINT se necessário.`,
    );
  }

  const body = (await response.json()) as JsonValue;
  const token = extractToken(body);
  const expiresInSeconds = extractExpiresIn(body);

  if (!token) {
    throw new Error("Não foi possível localizar o bearer token na resposta do IDDAS.");
  }

  cachedToken = {
    value: token,
    expiresAt: Date.now() + Math.max(60, expiresInSeconds - 60) * 1000,
  };

  logSync("info", "iddas.auth.success", {
    expires_in: expiresInSeconds,
    path: tokenUrl.pathname,
  });

  return token;
}

function extractToken(payload: JsonValue): string | null {
  if (typeof payload === "string") {
    return payload;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidates = [
    payload.token,
    payload.access_token,
    payload.bearer,
    typeof payload.data === "object" && payload.data && !Array.isArray(payload.data)
      ? payload.data.token
      : null,
  ];

  return candidates.find((value): value is string => typeof value === "string") ?? null;
}

function extractExpiresIn(payload: JsonValue): number {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return 3600;
  }

  const expiresIn = payload.expires_in;
  return typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? expiresIn
    : 3600;
}

function unwrapArray(payload: JsonValue): JsonObject[] {
  if (Array.isArray(payload)) {
    return payload.filter(isObject);
  }

  if (isObject(payload)) {
    const candidates = [
      payload.data,
      payload.items,
      payload.results,
      payload.orcamentos,
      payload.pessoas,
      payload.vendas,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter(isObject);
      }
    }
  }

  return [];
}

function unwrapObject(payload: JsonValue): JsonObject {
  if (isObject(payload)) {
    if (isObject(payload.data)) {
      return payload.data;
    }

    return payload;
  }

  return {};
}

function isObject(value: JsonValue): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function fetchWithRetry(input: URL, init: RequestInit, attempt = 0): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status !== 429 || attempt >= MAX_RETRIES) {
    return response;
  }

  const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
  const backoffMs = retryAfterMs ?? Math.min(1000 * 2 ** attempt, 8000);
  logSync("warn", "iddas.request.retry", {
    attempt: attempt + 1,
    backoff_ms: backoffMs,
    path: input.pathname + input.search,
    status: response.status,
  });
  await sleep(backoffMs);

  return fetchWithRetry(input, init, attempt + 1);
}

function parseRetryAfter(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type IddasObject = JsonObject;

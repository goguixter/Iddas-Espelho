export function safeJsonParse(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function resolveApiErrorMessage(
  payload: { details?: string[]; error?: string } | null,
  fallback: string,
) {
  const detail = payload?.details?.find((value) => typeof value === "string" && value.trim());
  return detail ?? payload?.error ?? fallback;
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const text = await response.text();
    const payload = safeJsonParse(text) as { details?: string[]; error?: string } | null;
    throw new Error(resolveApiErrorMessage(payload, "Não foi possível completar a operação."));
  }

  return response.json() as Promise<T>;
}

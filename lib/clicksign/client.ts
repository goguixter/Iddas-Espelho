import { safeJsonParse } from "@/lib/api/json";
import { clicksignConfig } from "@/lib/env";

export class ClicksignError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

export async function clicksignRequest<T>(path: string, init?: RequestInit) {
  if (!clicksignConfig.apiKey) {
    throw new ClicksignError("CLICKSIGN_API_KEY não configurada.", 500);
  }

  const response = await fetch(`${clicksignConfig.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: clicksignConfig.apiKey,
      "Content-Type": "application/vnd.api+json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const reason = extractClicksignErrorMessage(body);
    throw new ClicksignError(
      reason
        ? `Clicksign retornou ${response.status}: ${reason}`
        : `Clicksign retornou ${response.status}.`,
      response.status,
      body,
    );
  }

  return body as T;
}
function extractClicksignErrorMessage(body: unknown) {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (!body || typeof body !== "object") {
    return null;
  }

  const errors = (body as { errors?: Array<{ detail?: string; title?: string }> }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map((item) => item.detail || item.title).filter(Boolean).join(" | ");
  }

  const message = (body as { error?: string; message?: string }).message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const error = (body as { error?: string; message?: string }).error;
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return null;
}

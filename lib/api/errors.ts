import { z } from "zod";

export type ApiErrorPayload = {
  details?: string[];
  error: string;
  fieldErrors?: Record<string, string[]>;
  raw?: unknown;
  statusCode?: number;
};

export function buildApiErrorResponse(
  error: unknown,
  fallbackMessage: string,
  fallbackStatus = 500,
): { payload: ApiErrorPayload; status: number } {
  if (error instanceof z.ZodError) {
    const details = error.issues.map((issue) => issue.message).filter(Boolean);

    return {
      payload: {
        details,
        error: details[0] ?? fallbackMessage,
        fieldErrors: error.flatten().fieldErrors,
      },
      status: 400,
    };
  }

  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : fallbackStatus;

  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : fallbackMessage;

  const details =
    typeof error === "object" &&
    error !== null &&
    "body" in error &&
    Array.isArray((error as { body?: { errors?: Array<{ detail?: string; title?: string }> } }).body?.errors)
      ? (error as { body?: { errors?: Array<{ detail?: string; title?: string }> } }).body?.errors
          ?.map((item) => item.detail ?? item.title)
          .filter((value): value is string => Boolean(value))
      : undefined;

  const raw =
    typeof error === "object" && error !== null && "body" in error
      ? (error as { body?: unknown }).body
      : undefined;

  return {
    payload: {
      details: details?.length ? details : undefined,
      error: message,
      raw,
      statusCode: status,
    },
    status,
  };
}

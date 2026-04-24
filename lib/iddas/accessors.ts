import type { IddasObject } from "@/lib/iddas/client";
export { readString } from "@/lib/object-utils";
import { readString } from "@/lib/object-utils";

export function readId(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const object = value as IddasObject;
    return (
      readString(object.id) ??
      readString(object.codigo) ??
      readString(object.pessoa_id)
    );
  }

  return null;
}

export function requireString(value: string | null, field: string) {
  if (!value) {
    throw new Error(`Campo obrigatório ausente no IDDAS: ${field}`);
  }

  return value;
}

export function pickReferenceId(object: IddasObject, paths: string[]) {
  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = object;

    for (const part of parts) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        current = null;
        break;
      }

      current = (current as IddasObject)[part];
    }

    const value = readId(current) ?? readString(current);
    if (value) {
      return value;
    }
  }

  return null;
}

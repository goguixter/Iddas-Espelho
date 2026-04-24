export type UnknownObject = Record<string, unknown>;

export function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

export function toObject(input: unknown): UnknownObject | null {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as UnknownObject)
    : null;
}

export function safeParseObject(rawJson: string) {
  try {
    return toObject(JSON.parse(rawJson) as unknown);
  } catch {
    return null;
  }
}

export function readObjectArray(value: unknown): UnknownObject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is UnknownObject => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
  );
}

export function readFirstObjectArrayItem(value: unknown) {
  return readObjectArray(value)[0] ?? null;
}

export function readNestedString(
  input: UnknownObject | null | unknown,
  path: string[],
) {
  let current = input;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as UnknownObject)[segment];
  }

  return readString(current);
}

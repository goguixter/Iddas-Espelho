export function formatCurrencyValue(input: unknown) {
  const numericValue = parseNumericValue(input);

  if (numericValue === null) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
}

export function parseNumericValue(input: unknown) {
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

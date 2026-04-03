export function toUpperDisplay(value: string | null | undefined) {
  return (value ?? "").toLocaleUpperCase("pt-BR");
}

export function formatCpfOrCnpj(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  return toUpperDisplay(raw);
}

export function formatCep(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 8) {
    return digits.replace(/(\d{5})(\d{3})/, "$1-$2");
  }

  return toUpperDisplay(raw);
}

export function formatDateShort(input: string | null | undefined) {
  const date = toDate(input);

  if (!date) {
    return input?.trim() || "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateLong(input: string | null | undefined) {
  const date = toDate(input);

  if (!date) {
    return input?.trim() || "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function toDate(input: string | null | undefined) {
  const trimmed = input?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/");
    const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const isoLike = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00Z`
    : trimmed.replace(" ", "T");
  const date = new Date(isoLike);

  return Number.isNaN(date.getTime()) ? null : date;
}

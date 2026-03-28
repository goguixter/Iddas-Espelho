const IDDAS_TIME_ZONE = "America/Sao_Paulo";

export function getIddasCotacaoRange(days: number) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - Math.max(0, days - 1));

  return {
    periodo_cotacao_final: formatDateInTimeZone(today, IDDAS_TIME_ZONE),
    periodo_cotacao_inicio: formatDateInTimeZone(start, IDDAS_TIME_ZONE),
  };
}

export function normalizeCotacaoRange(input: {
  periodo_cotacao_final?: string | null;
  periodo_cotacao_inicio?: string | null;
}) {
  if (!input.periodo_cotacao_inicio || !input.periodo_cotacao_final) {
    return null;
  }

  if (!isIsoDate(input.periodo_cotacao_inicio) || !isIsoDate(input.periodo_cotacao_final)) {
    return null;
  }

  return {
    periodo_cotacao_final: input.periodo_cotacao_final,
    periodo_cotacao_inicio: input.periodo_cotacao_inicio,
  };
}

export function formatIsoDateToDisplay(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

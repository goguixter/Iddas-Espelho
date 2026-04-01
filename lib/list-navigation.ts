type BaseListSearchParams = {
  page?: string;
  q?: string;
};

type OrcamentosListSearchParams = BaseListSearchParams & {
  situacao?: string;
};

type SolicitacoesListSearchParams = BaseListSearchParams & {
  data?: string;
};

export function buildListHref({
  basePath,
  extraParams,
  page,
  query,
}: {
  basePath: string;
  extraParams?: Record<string, string | undefined>;
  page?: number;
  query?: string;
}) {
  const params = new URLSearchParams();

  if (typeof page === "number") {
    params.set("page", String(page));
  }

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value?.trim()) {
        params.set(key, value.trim());
      }
    }
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export async function readBaseListParams(
  searchParams: Promise<BaseListSearchParams>,
) {
  const params = await searchParams;

  return {
    page: parsePageParam(params.page),
    query: parseSearchParam(params.q),
  };
}

export async function readOrcamentosListParams(
  searchParams: Promise<OrcamentosListSearchParams>,
) {
  const params = await searchParams;

  return {
    page: parsePageParam(params.page),
    query: parseSearchParam(params.q),
    situacao: parseSearchParam(params.situacao),
  };
}

export async function readSolicitacoesListParams(
  searchParams: Promise<SolicitacoesListSearchParams>,
) {
  const params = await searchParams;

  return {
    page: parsePageParam(params.page),
    query: parseSearchParam(params.q),
    data: parseDateParam(params.data),
  };
}

export function parsePageParam(input?: string | null) {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function parseSearchParam(input?: string | null) {
  return input?.trim() ?? "";
}

export function parseDateParam(input?: string | null) {
  if (!input?.trim()) {
    return "";
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(input.trim()) ? input.trim() : "";
}

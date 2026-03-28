import { parsePageParam, parseSearchParam } from "@/lib/queries";

type BaseListSearchParams = {
  page?: string;
  q?: string;
};

type OrcamentosListSearchParams = BaseListSearchParams & {
  situacao?: string;
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

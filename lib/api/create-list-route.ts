import { NextRequest, NextResponse } from "next/server";
import { parsePageParam, parseSearchParam } from "@/lib/list-navigation";

export function createListRoute<T>(
  loader: (page: number, perPage: number, query: string) => Promise<T>,
) {
  return async function GET(request: NextRequest) {
    const page = parsePageParam(request.nextUrl.searchParams.get("page") ?? "1");
    const perPage = parsePageParam(
      request.nextUrl.searchParams.get("per_page") ?? "10",
    );
    const query = parseSearchParam(request.nextUrl.searchParams.get("q"));

    return NextResponse.json(await loader(page, perPage, query));
  };
}

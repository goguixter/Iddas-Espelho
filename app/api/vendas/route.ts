import { createListRoute } from "@/lib/api/create-list-route";
import { getVendasPage } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = createListRoute(getVendasPage);

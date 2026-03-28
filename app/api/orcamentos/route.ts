import { createListRoute } from "@/lib/api/create-list-route";
import { getOrcamentosPage } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = createListRoute(getOrcamentosPage);

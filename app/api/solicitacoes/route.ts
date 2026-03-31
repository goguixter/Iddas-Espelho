import { createListRoute } from "@/lib/api/create-list-route";
import { getSolicitacoesPage } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = createListRoute(getSolicitacoesPage);

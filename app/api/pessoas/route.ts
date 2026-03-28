import { createListRoute } from "@/lib/api/create-list-route";
import { getPessoasPage } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = createListRoute(getPessoasPage);

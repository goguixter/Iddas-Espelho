import { EntityListPage } from "@/components/entity-list-page";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import {
  getOrcamentosPage,
  parsePageParam,
  parseSearchParam,
} from "@/lib/queries";

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const query = parseSearchParam(params.q);
  const result = await getOrcamentosPage(page, LIST_PAGE_SIZE, query);

  return (
    <EntityListPage
      basePath="/orcamentos"
      columns={[
        { key: "id", label: "ID" },
        { key: "identificador", label: "Identificador" },
        { key: "cliente_nome", label: "Cliente" },
        { key: "passageiro_count", label: "Passageiros" },
        { key: "updated_at", label: "Atualizado" },
      ]}
      currentPage={page}
      currentQuery={query}
      emptyLabel="Nenhum orçamento disponível no espelho."
      eyebrow="Orçamentos"
      placeholder="Buscar por id, tag, cliente, telefone ou e-mail"
      result={result}
      title="Espelho paginado de orçamentos"
    />
  );
}

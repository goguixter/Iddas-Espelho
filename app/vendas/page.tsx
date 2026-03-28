import { EntityListPage } from "@/components/entity-list-page";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import {
  getVendasPage,
  parsePageParam,
  parseSearchParam,
} from "@/lib/queries";

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const query = parseSearchParam(params.q);
  const result = await getVendasPage(page, LIST_PAGE_SIZE, query);

  return (
    <EntityListPage
      basePath="/vendas"
      columns={[
        { key: "id", label: "ID" },
        { key: "orcamento_identificador", label: "Orçamento" },
        { key: "cliente_nome", label: "Cliente" },
        { key: "status", label: "Status" },
        { key: "orcamento_id", label: "ID orçamento" },
        { key: "updated_at", label: "Atualizado" },
      ]}
      currentPage={page}
      currentQuery={query}
      emptyLabel="Nenhuma venda vinculada ainda."
      eyebrow="Vendas"
      placeholder="Buscar por id, tag, cliente, telefone ou e-mail"
      result={result}
      title="Vendas vinculadas por identificador do orçamento"
    />
  );
}

import { EntityListPage } from "@/components/entity-list-page";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import { readBaseListParams } from "@/lib/list-navigation";
import { getVendasPage } from "@/lib/queries";

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, query } = await readBaseListParams(searchParams);
  const result = await getVendasPage(page, LIST_PAGE_SIZE, query);

  return (
    <EntityListPage
      basePath="/vendas"
      columns={[
        { key: "orcamento_identificador", label: "Orçamento" },
        { key: "cliente_nome", label: "Cliente" },
        { key: "status", label: "Status" },
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

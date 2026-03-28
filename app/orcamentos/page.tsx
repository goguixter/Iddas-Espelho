import { OrcamentosKanbanPage } from "@/components/orcamentos-kanban-page";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import { readOrcamentosListParams } from "@/lib/list-navigation";
import { getOrcamentosKanbanPage } from "@/lib/queries";

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; situacao?: string }>;
}) {
  const { page, query, situacao } = await readOrcamentosListParams(searchParams);
  const result = await getOrcamentosKanbanPage(page, LIST_PAGE_SIZE, query, situacao);

  return (
    <OrcamentosKanbanPage
      activeSituacao={result.activeSituacao}
      columns={[
        { key: "identificador", label: "Identificador" },
        { key: "cliente_nome", label: "Cliente" },
        { key: "passageiro_count", label: "Passageiros" },
      ]}
      currentPage={page}
      currentQuery={query}
      items={result.items}
      tabs={result.tabs}
      total={result.total}
    />
  );
}

import { EntityListPage } from "@/components/entity-list-page";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import { readBaseListParams } from "@/lib/list-navigation";
import { getVoosPage } from "@/lib/queries";

export default async function VoosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, query } = await readBaseListParams(searchParams);
  const result = await getVoosPage(page, LIST_PAGE_SIZE, query);

  return (
    <EntityListPage
      basePath="/voos"
      columns={[
        { key: "orcamento_identificador", label: "Orçamento" },
        { key: "companhia_nome", label: "Fornecedor" },
        { key: "rota", label: "Rota" },
        { key: "embarque", label: "Embarque" },
        { key: "localizador", label: "Localizador" },
      ]}
      currentPage={page}
      currentQuery={query}
      emptyLabel="Nenhum voo espelhado ainda."
      eyebrow="Voos"
      placeholder="Buscar por id, tag, fornecedor, localizador, rota ou cliente"
      result={result}
      title="Voos vinculados aos orçamentos espelhados"
    />
  );
}

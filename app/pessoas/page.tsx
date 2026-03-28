import { EntityListPage } from "@/components/entity-list-page";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import { readBaseListParams } from "@/lib/list-navigation";
import { getPessoasPage } from "@/lib/queries";

export default async function PessoasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, query } = await readBaseListParams(searchParams);
  const result = await getPessoasPage(page, LIST_PAGE_SIZE, query);

  return (
    <EntityListPage
      basePath="/pessoas"
      columns={[
        { key: "nome", label: "Nome" },
        { key: "email", label: "E-mail" },
        { key: "cpf", label: "CPF" },
      ]}
      currentPage={page}
      currentQuery={query}
      emptyLabel="Nenhuma pessoa espelhada ainda."
      eyebrow="Pessoas"
      placeholder="Buscar por id, nome, telefone ou e-mail"
      result={result}
      title="Clientes e passageiros consolidados"
    />
  );
}

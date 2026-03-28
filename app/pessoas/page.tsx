import { EntityListPage } from "@/components/entity-list-page";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import {
  getPessoasPage,
  parsePageParam,
  parseSearchParam,
} from "@/lib/queries";

export default async function PessoasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const query = parseSearchParam(params.q);
  const result = await getPessoasPage(page, LIST_PAGE_SIZE, query);

  return (
    <EntityListPage
      basePath="/pessoas"
      columns={[
        { key: "id", label: "ID" },
        { key: "nome", label: "Nome" },
        { key: "email", label: "E-mail" },
        { key: "cpf", label: "CPF" },
        { key: "updated_at", label: "Atualizado" },
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

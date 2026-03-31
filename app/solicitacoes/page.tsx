import { SolicitacoesList } from "@/components/solicitacoes-list";
import { LIST_PAGE_SIZE } from "@/lib/constants";
import { readSolicitacoesListParams } from "@/lib/list-navigation";
import { getSolicitacoesPage } from "@/lib/queries";

export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; page?: string; q?: string }>;
}) {
  const { data, page, query } = await readSolicitacoesListParams(searchParams);
  const result = await getSolicitacoesPage(page, LIST_PAGE_SIZE, query, data);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          Solicitações
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          Solicitações recebidas pelo formulário
        </h1>
      </div>

      <SolicitacoesList
        currentDate={data}
        currentPage={page}
        currentQuery={query}
        emptyLabel="Nenhuma solicitação espelhada ainda."
        placeholder="Buscar por id, nome, e-mail, telefone, origem ou destino"
        result={result}
      />
    </section>
  );
}

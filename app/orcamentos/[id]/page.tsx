import { notFound } from "next/navigation";
import {
  EntityDetailCard,
  EntityDetailHeader,
  EntityJsonPanel,
} from "@/components/entity-detail";
import { EntityRelations } from "@/components/entity-relations";
import { getOrcamentoDetail } from "@/lib/queries";

export default async function OrcamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getOrcamentoDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <EntityDetailHeader
        eyebrow="Orçamento"
        title={detail.identificador ?? detail.id}
        subtitle={`ID ${detail.id}`}
        backHref="/orcamentos"
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <EntityDetailCard
            items={[
              { label: "ID", value: detail.id },
              { label: "Identificador", value: detail.identificador },
              { label: "Cliente", value: detail.cliente_nome },
              { label: "ID da pessoa", value: detail.cliente_pessoa_id },
              { label: "Passageiros", value: String(detail.passageiro_count) },
              { label: "Atualizado em", value: detail.updated_at },
            ]}
            title="Dados do orçamento"
          />
          <EntityJsonPanel raw={detail.raw} />
        </div>
        <div className="space-y-6">
          <EntityRelations
            title="Pessoa do cliente"
            emptyLabel="Nenhuma pessoa vinculada."
            items={
              detail.cliente_pessoa_id
                ? [
                    {
                      description: detail.cliente_pessoa_id,
                      href: `/pessoas/${detail.cliente_pessoa_id}`,
                      label: detail.cliente_nome ?? "Cliente",
                    },
                  ]
                : []
            }
          />
          <EntityRelations
            title="Passageiros"
            emptyLabel="Nenhum passageiro vinculado."
            items={detail.passageiros.map((item) => ({
              description: item.id,
              href: `/pessoas/${item.id}`,
              label: item.nome ?? item.id,
            }))}
          />
          <EntityRelations
            title="Vendas vinculadas"
            emptyLabel="Nenhuma venda vinculada."
            items={detail.vendas.map((item) => ({
              description: item.status,
              href: `/vendas/${item.id}`,
              label: item.id,
            }))}
          />
        </div>
      </section>
    </div>
  );
}

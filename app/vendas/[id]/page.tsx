import { notFound } from "next/navigation";
import {
  EntityDetailCard,
  EntityDetailHeader,
  EntityJsonPanel,
} from "@/components/entity-detail";
import { EntityRelations } from "@/components/entity-relations";
import { getVendaDetail } from "@/lib/queries";

export default async function VendaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getVendaDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <EntityDetailHeader
        eyebrow="Venda"
        title={detail.id}
        subtitle={detail.orcamento_identificador ?? "Sem identificador de orçamento"}
        backHref="/vendas"
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <EntityDetailCard
            items={[
              { label: "ID", value: detail.id },
              { label: "Orçamento", value: detail.orcamento_identificador },
              { label: "Cliente", value: detail.cliente_nome },
              { label: "ID da pessoa", value: detail.cliente_pessoa_id },
              { label: "Status", value: detail.status },
              { label: "Atualizado em", value: detail.updated_at },
            ]}
            title="Dados da venda"
          />
          <EntityJsonPanel raw={detail.raw} />
        </div>
        <div className="space-y-6">
          <EntityRelations
            title="Orçamento vinculado"
            emptyLabel="Nenhum orçamento vinculado."
            items={
              detail.orcamento_id
                ? [
                    {
                      description: detail.orcamento_identificador,
                      href: `/orcamentos/${detail.orcamento_id}`,
                      label: detail.orcamento_id,
                    },
                  ]
                : []
            }
          />
          <EntityRelations
            title="Pessoa vinculada"
            emptyLabel="Nenhuma pessoa vinculada."
            items={
              detail.cliente_pessoa_id
                ? [
                    {
                      description: detail.cliente_pessoa_id,
                      href: `/pessoas/${detail.cliente_pessoa_id}`,
                      label: detail.cliente_nome ?? detail.cliente_pessoa_id,
                    },
                  ]
                : []
            }
          />
        </div>
      </section>
    </div>
  );
}

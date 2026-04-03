import { notFound } from "next/navigation";
import {
  EntityDetailCard,
  EntityDetailHeader,
  EntityJsonPanel,
} from "@/components/entity-detail";
import { EntityRelations } from "@/components/entity-relations";
import { getVooDetail } from "@/lib/queries";

export default async function VooDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getVooDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <EntityDetailHeader
        eyebrow="Voo"
        title={detail.localizador ?? detail.id}
        subtitle={detail.companhia_nome ?? "Sem fornecedor"}
        backHref="/voos"
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <EntityDetailCard
            title="Dados do voo"
            items={[
              { label: "ID", value: detail.id },
              { label: "Orçamento", value: detail.orcamento_identificador ?? detail.orcamento_id },
              { label: "Fornecedor", value: detail.companhia_nome },
              { label: "IATA", value: detail.companhia_iata },
              { label: "Classe", value: detail.classe },
              { label: "Trecho", value: detail.tipo_trecho },
              { label: "Origem", value: detail.aeroporto_origem },
              { label: "Destino", value: detail.aeroporto_destino },
              { label: "Embarque", value: [detail.data_embarque, detail.hora_embarque].filter(Boolean).join(" · ") || null },
              { label: "Chegada", value: [detail.data_chegada, detail.hora_chegada].filter(Boolean).join(" · ") || null },
              { label: "Duração", value: detail.duracao },
              { label: "Localizador", value: detail.localizador },
            ]}
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

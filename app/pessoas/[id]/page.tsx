import { notFound } from "next/navigation";
import {
  EntityDetailCard,
  EntityDetailHeader,
  EntityJsonPanel,
} from "@/components/entity-detail";
import { EntityRelations } from "@/components/entity-relations";
import { getPessoaDetail } from "@/lib/queries";

export default async function PessoaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPessoaDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <EntityDetailHeader
        eyebrow="Pessoa"
        title={detail.nome ?? detail.id}
        subtitle={`ID ${detail.id}`}
        backHref="/pessoas"
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <EntityDetailCard
            items={[
              { label: "ID", value: detail.id },
              { label: "Nome", value: detail.nome },
              { label: "E-mail", value: detail.email },
              { label: "Celular", value: detail.celular },
              { label: "CPF", value: detail.cpf },
              { label: "Nascimento", value: detail.nascimento },
              { label: "Tipos", value: detail.tipos },
              {
                label: "Endereço",
                value:
                  [
                    detail.endereco,
                    detail.numero,
                    detail.complemento,
                    detail.bairro,
                    detail.cidade,
                    detail.estado,
                    detail.cep,
                  ]
                    .filter(Boolean)
                    .join(", ") || null,
              },
              { label: "Atualizado em", value: detail.updated_at },
            ]}
            title="Dados da pessoa"
          />
          <EntityJsonPanel raw={detail.raw} />
        </div>
        <EntityRelations
          title="Orçamentos vinculados"
          emptyLabel="Nenhum orçamento vinculado."
          items={detail.orcamentos.map((item) => ({
            description: item.identificador ?? null,
            href: `/orcamentos/${item.id}`,
            label: `${item.id} · ${item.cliente_nome ?? "Sem cliente"}`,
          }))}
        />
      </section>
    </div>
  );
}

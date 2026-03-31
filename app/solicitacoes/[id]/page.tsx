import { notFound } from "next/navigation";
import {
  EntityDetailCard,
  EntityDetailHeader,
  EntityJsonPanel,
} from "@/components/entity-detail";
import { EntityRelations } from "@/components/entity-relations";
import { getSolicitacaoDetail } from "@/lib/queries";

export default async function SolicitacaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const solicitacao = await getSolicitacaoDetail(id);

  if (!solicitacao) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <EntityDetailHeader
        backHref="/solicitacoes"
        eyebrow="Solicitação"
        title={solicitacao.nome ?? `Solicitação ${solicitacao.id}`}
        subtitle={`ID ${solicitacao.id}`}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <EntityDetailCard
            title="Resumo"
            items={[
              { label: "Nome", value: solicitacao.nome },
              { label: "Telefone", value: solicitacao.telefone },
              { label: "E-mail", value: solicitacao.email },
              { label: "Flexibilidade", value: solicitacao.possui_flexibilidade },
              { label: "Origem", value: solicitacao.origem },
              { label: "Destino", value: solicitacao.destino },
              { label: "Data ida", value: solicitacao.data_ida },
              { label: "Data volta", value: solicitacao.data_volta },
              { label: "Adultos", value: solicitacao.adultos },
              { label: "Crianças", value: solicitacao.criancas },
              { label: "Data solicitação", value: solicitacao.data_solicitacao },
              { label: "Atualizado em", value: solicitacao.updated_at },
            ]}
          />

          <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
              Observação
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--color-ink)]">
              {solicitacao.observacao ?? "—"}
            </p>
          </section>
        </div>

        <div className="space-y-4">
          <EntityRelations
            title="Vínculo preparado"
            items={[
              {
                href: solicitacao.linked_orcamento_id
                  ? `/orcamentos/${solicitacao.linked_orcamento_id}`
                  : "",
                label: "Orçamento por ID",
                description: solicitacao.linked_orcamento_id,
              },
              {
                href:
                  solicitacao.linked_orcamento_id &&
                  solicitacao.linked_orcamento_identificador
                    ? `/orcamentos/${solicitacao.linked_orcamento_id}`
                    : "",
                label: "Orçamento por tag",
                description: solicitacao.linked_orcamento_identificador,
              },
            ].filter((item) => item.description)}
            emptyLabel="Nenhum vínculo de orçamento definido ainda."
          />

          <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
              Campos locais de vínculo
            </h2>
            <div className="mt-4 grid gap-4">
            <DetailField
              label="Campo local: linked_orcamento_id"
              value={solicitacao.linked_orcamento_id}
            />
            <DetailField
              label="Campo local: linked_orcamento_identificador"
              value={solicitacao.linked_orcamento_identificador}
            />
            </div>
          </section>
          </div>
      </div>

      <EntityJsonPanel raw={solicitacao.raw} />
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl bg-[var(--color-surface)] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
        {label}
      </p>
      <p className="mt-1 text-sm text-[var(--color-ink)]">{value ?? "—"}</p>
    </div>
  );
}

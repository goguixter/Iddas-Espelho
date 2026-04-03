import { notFound } from "next/navigation";
import {
  EntityDetailHeader,
} from "@/components/entity-detail";
import { OrcamentoDetailTabs } from "@/components/orcamento-detail-tabs";
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

      <OrcamentoDetailTabs
        clienteNome={detail.cliente_nome}
        clientePessoaId={detail.cliente_pessoa_id}
        id={detail.id}
        identificador={detail.identificador}
        passageiros={detail.passageiros}
        raw={detail.raw}
        situacaoCor={detail.situacao_cor}
        situacaoNome={detail.situacao_nome}
        vendas={detail.vendas}
        voos={detail.voos}
      />
    </div>
  );
}

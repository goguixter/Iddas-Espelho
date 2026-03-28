"use client";

import Link from "next/link";
import { useState } from "react";
import { EntityJsonPanel } from "@/components/entity-detail";
import { formatCurrencyValue, parseNumericValue } from "@/lib/formatting";

type Passenger = {
  id: string;
  nome: string | null;
};

type Sale = {
  id: string;
  status: string | null;
};

type OrcamentoDetailTabsProps = {
  clienteNome: string | null;
  clientePessoaId: string | null;
  id: string;
  identificador: string | null;
  passageiros: Passenger[];
  raw: unknown;
  situacaoCor: string | null;
  situacaoNome: string | null;
  vendas: Sale[];
};

const tabs = [
  { id: "solicitacao", label: "Solicitação" },
  { id: "orcamento", label: "Orçamento" },
  { id: "voos", label: "Voos" },
  { id: "passageiros", label: "Passageiros" },
  { id: "valores", label: "Valores" },
  { id: "json", label: "JSON" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function OrcamentoDetailTabs(props: OrcamentoDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("solicitacao");
  const raw = isObject(props.raw) ? props.raw : null;
  const payloadPassengers = readObjectArray(raw?.passageiros);

  return (
    <section className="rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
      <div className="flex flex-wrap items-end gap-1 border-b border-[var(--color-line)] px-1 pt-2">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative -mb-px rounded-t-2xl rounded-b-none border px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-[var(--color-line)] border-b-[var(--color-surface)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_-10px_24px_rgba(15,23,42,0.22)]"
                  : "border-transparent bg-[var(--color-panel)] text-[var(--color-faint)] hover:border-[var(--color-line)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {activeTab === "solicitacao" ? <SolicitacaoTab raw={raw} /> : null}
        {activeTab === "orcamento" ? <OrcamentoTab {...props} raw={raw} /> : null}
        {activeTab === "voos" ? <VoosTab raw={raw} /> : null}
        {activeTab === "passageiros" ? (
          <PassageirosTab fallbackPassengers={props.passageiros} payloadPassengers={payloadPassengers} />
        ) : null}
        {activeTab === "valores" ? <ValoresTab raw={raw} /> : null}
        {activeTab === "json" ? <EntityJsonPanel raw={props.raw} /> : null}
      </div>
    </section>
  );
}

function SolicitacaoTab({ raw }: { raw: Record<string, unknown> | null }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ContentPanel
        title="Informações"
        content={readText(raw, ["informacoes", "detalhes_viagem"])}
      />
      <ContentPanel
        title="Forma de pagamento"
        content={readText(raw, ["forma_pagamento"])}
      />
      <ContentPanel
        title="Termos e condições"
        content={readText(raw, ["termos_condicoes"])}
      />
      <ContentPanel
        title="Outras informações"
        content={readText(raw, ["outras_informações", "outras_informacoes", "servicos"])}
      />
    </div>
  );
}

function OrcamentoTab({
  clienteNome,
  clientePessoaId,
  id,
  identificador,
  raw,
  situacaoCor,
  situacaoNome,
  vendas,
}: OrcamentoDetailTabsProps & { raw: Record<string, unknown> | null }) {
  const titulo = readText(raw, ["titulo"]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
          Resumo do orçamento
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FieldCard label="Cliente" value={clienteNome} />
          <FieldCard label="ID do orçamento" value={id} />
          <FieldCard label="Tag" value={identificador} badge />
          <FieldCard
            label="Situação"
            value={situacaoNome}
            badge
            badgeColor={situacaoCor}
          />
          <FieldCard label="Título" value={titulo} className="md:col-span-2" />
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
          Vínculos rápidos
        </h2>
        <div className="mt-4 space-y-3">
          {clientePessoaId ? (
            <LinkCard
              href={`/pessoas/${clientePessoaId}`}
              label={clienteNome ?? "Pessoa do cliente"}
              description={clientePessoaId}
            />
          ) : (
            <EmptyState label="Nenhuma pessoa vinculada." />
          )}

          {vendas.length > 0 ? (
            vendas.map((sale) => (
              <LinkCard
                key={sale.id}
                href={`/vendas/${sale.id}`}
                label={`Venda ${sale.id}`}
                description={sale.status}
              />
            ))
          ) : (
            <EmptyState label="Nenhuma venda vinculada." />
          )}
        </div>
      </section>
    </div>
  );
}

function VoosTab({ raw }: { raw: Record<string, unknown> | null }) {
  const voos = readObjectArray(raw?.voos);

  if (voos.length === 0) {
    return <PlaceholderPanel title="Voos" description="Implementaremos esta visualização depois." />;
  }

  return (
    <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
        Voos
      </h2>
      <div className="mt-4 space-y-3">
        {voos.map((flight, index) => (
          <div
            key={readString(flight.id) ?? String(index)}
            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
          >
            <p className="text-sm font-medium text-[var(--color-ink)]">
              {readText(flight, ["resumo", "numero"]) ?? "Voo"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Localizador: {readText(flight, ["localizador"]) ?? "—"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PassageirosTab({
  fallbackPassengers,
  payloadPassengers,
}: {
  fallbackPassengers: Passenger[];
  payloadPassengers: Record<string, unknown>[];
}) {
  const passengers =
    payloadPassengers.length > 0
      ? payloadPassengers.map((passenger) => ({
          documento: readText(passenger, ["cpf", "passaporte", "rg"]),
          email: readText(passenger, ["email"]),
          id: readText(passenger, ["id_pessoa", "id"]),
          nascimento: readText(passenger, ["nascimento"]),
          nome: readText(passenger, ["nome"]),
          telefone: readText(passenger, ["celular", "telefone"]),
        }))
      : fallbackPassengers.map((passenger) => ({
          documento: null,
          email: null,
          id: passenger.id,
          nascimento: null,
          nome: passenger.nome,
          telefone: null,
        }));

  if (passengers.length === 0) {
    return <EmptyPanel title="Passageiros" label="Nenhum passageiro encontrado no payload." />;
  }

  return (
    <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
        Passageiros
      </h2>
      <div className="mt-4 space-y-3">
        {passengers.map((passenger, index) => (
          <div
            key={`${passenger.id ?? passenger.nome ?? "passageiro"}-${index}`}
            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  {passenger.nome ?? "Sem nome"}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  ID pessoa: {passenger.id ?? "—"}
                </p>
              </div>
              {passenger.id ? (
                <Link
                  href={`/pessoas/${passenger.id}`}
                  className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-xs font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)]"
                >
                  Ver pessoa
                </Link>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <MiniField label="E-mail" value={passenger.email} />
              <MiniField label="Telefone" value={passenger.telefone} />
              <MiniField label="Documento" value={passenger.documento} />
              <MiniField label="Nascimento" value={passenger.nascimento} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ValoresTab({ raw }: { raw: Record<string, unknown> | null }) {
  const valores = readObjectArray(raw?.valores);

  if (valores.length === 0) {
    return <EmptyPanel title="Valores" label="Nenhum valor encontrado no payload." />;
  }

  const rows = valores.map((value, index) => ({
    id: readText(value, ["id"]) ?? String(index + 1),
    nome: resolveValorNome(value, "orcamento"),
    parcelas: readText(value, ["parcelas"]),
    pessoaId: readText(value, ["id_pessoa"]),
    tipo: readText(value, ["tipo"]),
    valor: resolveValorAmount(value, raw, "orcamento"),
    vencimento: readText(value, ["vencimento"]),
  }));

  return (
    <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
            Valores
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {rows.length} registro(s) financeiros encontrados no payload do IDDAS.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-line)]">
        <div className="table-scroll max-h-[55vh] overflow-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-[var(--color-panel)]">
              <tr>
                {[
                  "Tipo",
                  "Descrição",
                  "Pessoa",
                  "Vencimento",
                  "Parcelas",
                  "Valor",
                ].map((label) => (
                  <th
                    key={label}
                    className="border-b border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-faint)]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-[var(--color-surface)]">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink)]">
                    <span className="inline-flex rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink)]">
                      {row.tipo ?? "—"}
                    </span>
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink)]">
                    <div>
                      <p>{row.nome}</p>
                      <p className="mt-1 text-xs text-[var(--color-faint)]">
                        ID {row.id}
                      </p>
                    </div>
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink)]">
                    {row.pessoaId ? (
                      <Link
                        href={`/pessoas/${row.pessoaId}`}
                        className="inline-flex rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)]"
                      >
                        {row.pessoaId}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink)]">
                    {row.vencimento ?? "—"}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink)]">
                    {row.parcelas ?? "—"}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-ink)]">
                    {row.valor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FieldCard({
  badge = false,
  badgeColor,
  className,
  label,
  value,
}: {
  badge?: boolean;
  badgeColor?: string | null;
  className?: string;
  label: string;
  value: string | null;
}) {
  return (
    <div className={`rounded-2xl bg-[var(--color-surface)] p-4 ${className ?? ""}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
        {label}
      </p>
      <div className="mt-2">
        {badge ? (
          <span
            className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]"
            style={{
              backgroundColor: normalizeHex(badgeColor) ?? "var(--color-accent-soft)",
              color: normalizeHex(badgeColor) ? readableTextColor(normalizeHex(badgeColor)) : "var(--color-accent)",
            }}
          >
            {value ?? "—"}
          </span>
        ) : (
          <p className="text-sm text-[var(--color-ink)]">{value ?? "—"}</p>
        )}
      </div>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-faint)]">
        {label}
      </p>
      <p className="mt-1 text-sm text-[var(--color-ink)]">{value ?? "—"}</p>
    </div>
  );
}

function ContentPanel({
  content,
  title,
}: {
  content: string | null;
  title: string;
}) {
  return (
    <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
        {title}
      </h2>
      <div className="mt-4 rounded-2xl bg-[var(--color-surface)] p-4">
        <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--color-ink)]">
          {content ?? "Sem conteúdo disponível."}
        </p>
      </div>
    </section>
  );
}

function PlaceholderPanel({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-[24px] border border-dashed border-[var(--color-line)] bg-[var(--color-panel)] p-6">
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
        {title}
      </h2>
      <p className="mt-3 text-sm text-[var(--color-muted)]">{description}</p>
    </section>
  );
}

function EmptyPanel({ label, title }: { label: string; title: string }) {
  return (
    <section className="rounded-[24px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
        {title}
      </h2>
      <p className="mt-4 text-sm text-[var(--color-muted)]">{label}</p>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-[var(--color-muted)]">{label}</p>;
}

function LinkCard({
  description,
  href,
  label,
}: {
  description?: string | null;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 transition hover:border-[var(--color-accent)]"
    >
      <p className="font-medium text-[var(--color-ink)]">{label}</p>
      {description ? (
        <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
      ) : null}
    </Link>
  );
}

function isObject(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function readObjectArray(input: unknown) {
  return Array.isArray(input) ? input.filter(isObject) : [];
}

function readString(input: unknown) {
  if (typeof input === "string" && input.trim()) {
    return input;
  }

  if (typeof input === "number") {
    return String(input);
  }

  return null;
}

function readText(
  input: Record<string, unknown> | null,
  keys: string[],
) {
  if (!input) {
    return null;
  }

  for (const key of keys) {
    const value = readString(input[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function normalizeHex(value: string | null | undefined) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim()
    : null;
}

function readableTextColor(background: string | null) {
  if (!background) {
    return "#0f172a";
  }

  const hex = background.slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance > 160 ? "#0f172a" : "#ffffff";
}

function readCurrency(input: unknown) {
  return formatCurrencyValue(input);
}

function resolveValorAmount(
  value: Record<string, unknown>,
  raw: Record<string, unknown> | null,
  context: "orcamento" | "venda",
) {
  const directValue = parseNumericValue(value["valor"]);
  if (directValue !== null) {
    return readCurrency(directValue);
  }

  const tipo = readText(value, ["tipo"]);
  if (tipo === "R" && raw) {
    const fallbackValue =
      context === "venda"
        ? parseNumericValue(raw.venda) ?? parseNumericValue(raw.valor)
        : parseNumericValue(raw.valor) ?? parseNumericValue(raw.orcado);

    if (fallbackValue !== null) {
      return readCurrency(fallbackValue);
    }
  }

  return "—";
}

function resolveValorNome(
  value: Record<string, unknown>,
  context: "orcamento" | "venda",
) {
  const nome = readText(value, ["nome"]);
  if (nome) {
    return nome;
  }

  const tipo = readText(value, ["tipo"]);

  if (tipo === "R") {
    return context === "venda" ? "Valor da venda" : "Valor orçado";
  }

  return "Sem descrição";
}

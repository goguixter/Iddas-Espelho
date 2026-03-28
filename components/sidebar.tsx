"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, LayoutDashboard, Users, WalletCards } from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orcamentos", label: "Orçamentos", icon: Database },
  { href: "/pessoas", label: "Pessoas", icon: Users },
  { href: "/vendas", label: "Vendas", icon: WalletCards },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-[320px] flex-col border-r border-[var(--color-line)] bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] p-6 text-white shadow-[24px_0_80px_rgba(15,23,42,0.18)]">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-accent-strong)]">
          IDDAS Mirror
        </p>
        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
          Hub local de sincronização
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Sidebar fixa no estilo workspace para monitorar os dados espelhados e
          consultar cada coleção com paginação.
        </p>
      </div>

      <nav className="mt-8 flex flex-col gap-2">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                active
                  ? "bg-[var(--color-accent)] text-slate-950 shadow-[0_12px_32px_rgba(251,191,36,0.28)]"
                  : "text-slate-300 hover:bg-white/6 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <p className="font-medium text-white">Fluxo aplicado</p>
        <p className="mt-2 leading-6">
          `/orcamento` → `/orcamento/:id` → `/pessoa/:id` → `/venda?orcamento=identificador`
        </p>
      </div>
    </aside>
  );
}

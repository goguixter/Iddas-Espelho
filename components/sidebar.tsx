"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  LayoutDashboard,
  Users,
  WalletCards,
} from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orcamentos", label: "Orçamentos", icon: Database },
  { href: "/pessoas", label: "Pessoas", icon: Users },
  { href: "/vendas", label: "Vendas", icon: WalletCards },
];

export function Sidebar({
  collapsed,
  onToggle,
  width,
}: {
  collapsed: boolean;
  onToggle: () => void;
  width: number;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 flex h-screen flex-col border-r border-[var(--color-line)] bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] px-3 py-4 text-white shadow-[24px_0_80px_rgba(15,23,42,0.18)] transition-[width] duration-200"
      style={{ width }}
    >
      <div className={`mb-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed ? (
          <span className="px-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-accent-strong)]">
            IDDAS
          </span>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="mt-2 flex flex-col gap-2">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center rounded-2xl px-3 py-3 text-sm font-medium transition ${
                active
                  ? "bg-[var(--color-accent)] text-slate-950 shadow-[0_12px_32px_rgba(251,191,36,0.28)]"
                  : "text-slate-300 hover:bg-white/6 hover:text-white"
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon className={`h-4 w-4 shrink-0 ${collapsed ? "mx-auto" : ""}`} />
              {!collapsed ? <span className="ml-3 truncate">{label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

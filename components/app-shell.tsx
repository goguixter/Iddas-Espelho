"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";

const SIDEBAR_EXPANDED_WIDTH = 232;
const SIDEBAR_COLLAPSED_WIDTH = 76;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((current) => !current)}
        width={sidebarWidth}
      />
      <main
        className="min-w-0 flex-1 transition-[padding] duration-200"
        style={{ paddingLeft: `${sidebarWidth}px` }}
      >
        <div className="flex h-full min-h-0 flex-col px-6 py-6">{children}</div>
      </main>
    </div>
  );
}

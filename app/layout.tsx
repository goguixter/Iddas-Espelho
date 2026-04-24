import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Espelho IDDAS",
  description: "Painel de espelhamento de orçamentos, pessoas e vendas do IDDAS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-[var(--color-page)] text-[var(--color-ink)]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

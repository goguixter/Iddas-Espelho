import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

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
      <body className="min-h-full bg-[var(--color-page)] text-[var(--color-ink)]">
        <div className="mx-auto flex min-h-screen w-full max-w-[1800px]">
          <Sidebar />
          <main className="flex-1 pl-[320px]">
            <div className="min-h-screen px-8 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}

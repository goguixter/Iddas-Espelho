import { LoginForm } from "@/components/login-form";
import { isAuthConfigured } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const authConfigured = isAuthConfigured();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextPath =
    resolvedSearchParams?.next && resolvedSearchParams.next.startsWith("/")
      ? resolvedSearchParams.next
      : "/";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-md rounded-[32px] border border-white/10 bg-[rgba(15,23,42,0.82)] p-8 shadow-[0_32px_120px_rgba(15,23,42,0.45)] backdrop-blur">
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent-strong)]">
          IDDAS Espelho
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Acesso protegido</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          Faça login para acessar o painel administrativo e liberar o deploy com acesso restrito.
        </p>

        <LoginForm authConfigured={authConfigured} nextPath={nextPath} />
      </section>
    </main>
  );
}

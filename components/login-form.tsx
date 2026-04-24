"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({
  authConfigured,
  nextPath,
}: {
  authConfigured: boolean;
  nextPath: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authConfigured) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ password, username }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Falha ao autenticar.");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Falha ao autenticar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2 text-sm text-[var(--color-muted)]">
        Usuário
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition focus:border-[var(--color-accent)]"
          placeholder="admin"
          disabled={!authConfigured || submitting}
          required
        />
      </label>

      <label className="flex flex-col gap-2 text-sm text-[var(--color-muted)]">
        Senha
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition focus:border-[var(--color-accent)]"
          placeholder="••••••••"
          disabled={!authConfigured || submitting}
          required
        />
      </label>

      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {!authConfigured ? (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
          Configure `AUTH_SECRET`, `AUTH_USERNAME` e `AUTH_PASSWORD` no ambiente antes do deploy.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!authConfigured || submitting}
        className="mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

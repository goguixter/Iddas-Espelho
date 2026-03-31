import { NextResponse } from "next/server";
import {
  isIddasSyncRunning,
  requestCancelIddasSync,
  syncIddasScope,
} from "@/lib/iddas/mirror";
import { normalizeCotacaoRange } from "@/lib/iddas/date-range";
import { getSyncState } from "@/lib/queries";
import { logSync } from "@/lib/sync/logger";
import type { SyncScope } from "@/lib/sync/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSyncState());
}

export async function POST(request: Request) {
  try {
    const body = (await requestJson(request)) as
      | {
          scope?: SyncScope;
          periodo_cotacao_final?: string;
          periodo_cotacao_inicio?: string;
        }
      | null;
    const scope = normalizeScope(body?.scope);
    const range =
      scope === "orcamentos" ? normalizeCotacaoRange(body ?? {}) : null;

    if (!isIddasSyncRunning(scope)) {
      logSync("info", "sync.api.start", { scope, ...(range ?? {}) });
      void syncIddasScope(scope, range ?? undefined).catch(() => undefined);
    } else {
      logSync("info", "sync.api.already-running", { scope });
    }

    return NextResponse.json(await getSyncState(), { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao sincronizar.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const body = (await requestJson(request)) as { scope?: SyncScope } | null;
  const scope = normalizeScope(body?.scope);

  logSync("warn", "sync.api.cancel", { scope });
  return NextResponse.json(requestCancelIddasSync(scope), { status: 202 });
}

async function requestJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeScope(scope?: SyncScope) {
  return scope === "solicitacoes" ? "solicitacoes" : "orcamentos";
}

import { NextResponse } from "next/server";
import {
  isIddasSyncRunning,
  requestCancelIddasSync,
  syncIddasMirror,
} from "@/lib/iddas/mirror";
import { normalizeCotacaoRange } from "@/lib/iddas/date-range";
import { getSyncState } from "@/lib/queries";
import { logSync } from "@/lib/sync/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSyncState());
}

export async function POST(request: Request) {
  try {
    const body = (await requestJson(request)) as
      | {
          periodo_cotacao_final?: string;
          periodo_cotacao_inicio?: string;
        }
      | null;
    const range = normalizeCotacaoRange(body ?? {});

    if (!isIddasSyncRunning()) {
      logSync("info", "sync.api.start", range ?? {});
      void syncIddasMirror(range ?? undefined).catch(() => undefined);
    } else {
      logSync("info", "sync.api.already-running");
    }

    return NextResponse.json(await getSyncState(), { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao sincronizar.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  logSync("warn", "sync.api.cancel");
  return NextResponse.json(requestCancelIddasSync(), { status: 202 });
}

async function requestJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

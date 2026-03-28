import { db } from "@/lib/db";
import type { SyncStateRecord, SyncStatus } from "@/lib/sync/types";

export type SyncStatePatch = Partial<{
  cancel_requested: number;
  current_item_id: string | null;
  current_page: number | null;
  current_stage: string | null;
  error: string | null;
  last_synced_at: string | null;
  next_orcamento_page: number;
  orcamentos_created: number;
  orcamentos_synced: number;
  people_created: number;
  people_synced: number;
  running_started_at: string | null;
  status: SyncStatus;
  vendas_created: number;
  vendas_synced: number;
}>;

export function getSyncStateRecord() {
  return db.prepare(
    `
      SELECT
        status,
        current_stage,
        current_page,
        current_item_id,
        cancel_requested,
        running_started_at,
        last_synced_at,
        next_orcamento_page,
        orcamentos_created,
        orcamentos_synced,
        people_created,
        people_synced,
        vendas_created,
        vendas_synced,
        error
      FROM sync_state
      WHERE scope = 'global'
    `,
  ).get() as SyncStateRecord;
}

export function updateSyncStateRecord(patch: SyncStatePatch) {
  const next = { ...getSyncStateRecord(), ...patch };

  db.prepare(
    `
      UPDATE sync_state
      SET
        status = @status,
        current_stage = @current_stage,
        current_page = @current_page,
        current_item_id = @current_item_id,
        cancel_requested = @cancel_requested,
        running_started_at = @running_started_at,
        last_synced_at = @last_synced_at,
        next_orcamento_page = @next_orcamento_page,
        orcamentos_created = @orcamentos_created,
        orcamentos_synced = @orcamentos_synced,
        people_created = @people_created,
        people_synced = @people_synced,
        vendas_created = @vendas_created,
        vendas_synced = @vendas_synced,
        error = @error
      WHERE scope = 'global'
    `,
  ).run(next);
}

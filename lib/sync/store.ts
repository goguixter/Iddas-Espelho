import { db } from "@/lib/db";
import type {
  SyncDashboardState,
  SyncScope,
  SyncStateRecord,
  SyncStatus,
} from "@/lib/sync/types";

export type SyncStatePatch = Partial<{
  cancel_requested: number;
  current_item_id: string | null;
  current_page: number | null;
  current_stage: string | null;
  details_synced: number;
  error: string | null;
  items_created: number;
  items_skipped: number;
  items_synced: number;
  last_synced_at: string | null;
  next_page: number;
  next_orcamento_page: number;
  orcamentos_created: number;
  orcamentos_synced: number;
  people_created: number;
  people_synced: number;
  related_created: number;
  related_synced: number;
  reconciled_synced: number;
  running_started_at: string | null;
  queue_pending: number;
  secondary_created: number;
  secondary_synced: number;
  status: SyncStatus;
  vendas_created: number;
  vendas_synced: number;
}>;

const SELECT_SYNC_STATE = `
  SELECT
    scope,
    status,
    current_stage,
    current_page,
    current_item_id,
    cancel_requested,
    running_started_at,
    last_synced_at,
    details_synced,
    items_synced,
    items_created,
    items_skipped,
    related_synced,
    related_created,
    secondary_synced,
    secondary_created,
    queue_pending,
    reconciled_synced,
    next_page,
    next_orcamento_page,
    orcamentos_created,
    orcamentos_synced,
    people_created,
    people_synced,
    vendas_created,
    vendas_synced,
    error
  FROM sync_state
  WHERE scope = ?
`;

export function getSyncStateRecord(scope: SyncScope) {
  return db.prepare(
    SELECT_SYNC_STATE,
  ).get(scope) as SyncStateRecord;
}

export function getSyncDashboardState(): SyncDashboardState {
  return {
    orcamentos: getSyncStateRecord("orcamentos"),
    pessoas: getSyncStateRecord("pessoas"),
    solicitacoes: getSyncStateRecord("solicitacoes"),
    vendas: getSyncStateRecord("vendas"),
  };
}

export function updateSyncStateRecord(
  scope: SyncScope,
  patch: SyncStatePatch,
) {
  const next = { ...getSyncStateRecord(scope), ...patch };

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
        details_synced = @details_synced,
        items_synced = @items_synced,
        items_created = @items_created,
        items_skipped = @items_skipped,
        related_synced = @related_synced,
        related_created = @related_created,
        secondary_synced = @secondary_synced,
        secondary_created = @secondary_created,
        queue_pending = @queue_pending,
        reconciled_synced = @reconciled_synced,
        next_page = @next_page,
        next_orcamento_page = @next_orcamento_page,
        orcamentos_created = @orcamentos_created,
        orcamentos_synced = @orcamentos_synced,
        people_created = @people_created,
        people_synced = @people_synced,
        vendas_created = @vendas_created,
        vendas_synced = @vendas_synced,
        error = @error
      WHERE scope = @scope
    `,
  ).run({ ...next, scope });
}

export function resetSyncStateRecord(scope: SyncScope) {
  db.prepare(
    `
      UPDATE sync_state
      SET
        status = 'idle',
        current_stage = NULL,
        current_page = NULL,
        current_item_id = NULL,
        cancel_requested = 0,
        running_started_at = NULL,
        last_synced_at = NULL,
        details_synced = 0,
        items_synced = 0,
        items_created = 0,
        items_skipped = 0,
        related_synced = 0,
        related_created = 0,
        secondary_synced = 0,
        secondary_created = 0,
        queue_pending = 0,
        reconciled_synced = 0,
        next_page = 1,
        next_orcamento_page = 1,
        orcamentos_created = 0,
        orcamentos_synced = 0,
        people_created = 0,
        people_synced = 0,
        vendas_created = 0,
        vendas_synced = 0,
        error = NULL
      WHERE scope = ?
    `,
  ).run(scope);

  return getSyncStateRecord(scope);
}

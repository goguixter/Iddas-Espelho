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
  error: string | null;
  items_created: number;
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
  running_started_at: string | null;
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
    items_synced,
    items_created,
    related_synced,
    related_created,
    secondary_synced,
    secondary_created,
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

export function getSyncStateRecord(scope: SyncScope = "global") {
  return db.prepare(
    SELECT_SYNC_STATE,
  ).get(scope) as SyncStateRecord;
}

export function getSyncDashboardState(): SyncDashboardState {
  return {
    orcamentos: getSyncStateRecord("orcamentos"),
    solicitacoes: getSyncStateRecord("solicitacoes"),
  };
}

export function updateSyncStateRecord(
  scope: SyncScope = "global",
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
        items_synced = @items_synced,
        items_created = @items_created,
        related_synced = @related_synced,
        related_created = @related_created,
        secondary_synced = @secondary_synced,
        secondary_created = @secondary_created,
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

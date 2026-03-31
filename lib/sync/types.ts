export type SyncStatus = "idle" | "running" | "completed" | "cancelled" | "failed";

export type SyncScope = "global" | "orcamentos" | "solicitacoes";

export type SyncStateRecord = {
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
  running_started_at: string | null;
  scope: SyncScope;
  secondary_created: number;
  secondary_synced: number;
  related_created: number;
  related_synced: number;
  status: SyncStatus;
  vendas_created: number;
  vendas_synced: number;
};

export type SyncDashboardState = {
  orcamentos: SyncStateRecord;
  solicitacoes: SyncStateRecord;
};

export function translateSyncStatus(status: SyncStatus) {
  switch (status) {
    case "running":
      return "Em execução";
    case "completed":
      return "Concluído";
    case "cancelled":
      return "Cancelado";
    case "failed":
      return "Falhou";
    default:
      return "Parado";
  }
}

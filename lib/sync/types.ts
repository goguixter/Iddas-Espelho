export type SyncStatus = "idle" | "running" | "completed" | "cancelled" | "failed";

export type SyncStateRecord = {
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

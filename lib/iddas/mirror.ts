import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readId } from "@/lib/iddas/accessors";
import {
  fetchIddasDetail,
  fetchIddasList,
} from "@/lib/iddas/client";
import {
  getIddasCotacaoRange,
  normalizeCotacaoRange,
} from "@/lib/iddas/date-range";
import {
  extractPersonIdsFromOrcamento,
  normalizeOrcamento,
  normalizePessoa,
  normalizeVenda,
} from "@/lib/iddas/normalizers";
import { logSync } from "@/lib/sync/logger";
import {
  getSyncStateRecord,
  updateSyncStateRecord,
} from "@/lib/sync/store";

const upsertOrcamento = db.prepare(`
  INSERT INTO orcamentos (
    id,
    identificador,
    cliente_pessoa_id,
    passageiro_ids_json,
    passageiro_count,
    raw_json,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @identificador,
    @cliente_pessoa_id,
    @passageiro_ids_json,
    @passageiro_count,
    @raw_json,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    identificador = excluded.identificador,
    cliente_pessoa_id = excluded.cliente_pessoa_id,
    passageiro_ids_json = excluded.passageiro_ids_json,
    passageiro_count = excluded.passageiro_count,
    raw_json = excluded.raw_json,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const upsertPessoa = db.prepare(`
  INSERT INTO pessoas (
    id,
    nome,
    email,
    cpf,
    raw_json,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @nome,
    @email,
    @cpf,
    @raw_json,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    nome = excluded.nome,
    email = excluded.email,
    cpf = excluded.cpf,
    raw_json = excluded.raw_json,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const upsertVenda = db.prepare(`
  INSERT INTO vendas (
    id,
    orcamento_id,
    orcamento_identificador,
    status,
    raw_json,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @orcamento_id,
    @orcamento_identificador,
    @status,
    @raw_json,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    orcamento_id = excluded.orcamento_id,
    orcamento_identificador = excluded.orcamento_identificador,
    status = excluded.status,
    raw_json = excluded.raw_json,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const hasOrcamento = db.prepare(`SELECT 1 FROM orcamentos WHERE id = ? LIMIT 1`);
const hasPessoa = db.prepare(`SELECT 1 FROM pessoas WHERE id = ? LIMIT 1`);
const hasVenda = db.prepare(`SELECT 1 FROM vendas WHERE id = ? LIMIT 1`);

type SyncResult = {
  last_synced_at: string;
  ok: true;
  orcamentos_synced: number;
  people_synced: number;
  vendas_synced: number;
};

let activeSync: Promise<SyncResult> | null = null;

export async function syncIddasMirror(input?: {
  periodo_cotacao_final?: string;
  periodo_cotacao_inicio?: string;
}) {
  if (activeSync) {
    logSync("info", "sync.reuse-active-job");
    return activeSync;
  }

  logSync("info", "sync.start-request");
  activeSync = runSync(input);

  try {
    return await activeSync;
  } finally {
    activeSync = null;
  }
}

async function runSync(input?: {
  periodo_cotacao_final?: string;
  periodo_cotacao_inicio?: string;
}): Promise<SyncResult> {
  const initialState = getSyncStateRecord();
  const startOrcamentoPage = Math.max(1, initialState.next_orcamento_page);
  const cotacaoRange =
    normalizeCotacaoRange(input ?? {}) ??
    getIddasCotacaoRange(env.IDDAS_SYNC_LOOKBACK_DAYS);
  let orcamentosCreated = 0;
  let orcamentosSynced = 0;
  let peopleCreated = 0;
  let peopleSynced = 0;
  let vendasCreated = 0;
  let vendasSynced = 0;
  const now = new Date().toISOString();
  const fetchedPersonIds = new Set<string>();

  try {
    logSync("info", "sync.started", {
      cotacao_periodo_final: cotacaoRange.periodo_cotacao_final,
      cotacao_periodo_inicio: cotacaoRange.periodo_cotacao_inicio,
      max_pages: env.IDDAS_SYNC_MAX_PAGES,
      orcamentos_per_page: env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE,
      start_orcamento_page: startOrcamentoPage,
      vendas_per_page: env.IDDAS_SYNC_VENDAS_PER_PAGE,
      started_at: now,
    });

    updateSyncStateRecord({
      cancel_requested: 0,
      current_item_id: null,
      current_page: 1,
      current_stage: "Buscando páginas de orçamentos",
      error: null,
      last_synced_at: null,
      next_orcamento_page: startOrcamentoPage,
      orcamentos_created: 0,
      orcamentos_synced: 0,
      people_created: 0,
      people_synced: 0,
      running_started_at: now,
      status: "running",
      vendas_created: 0,
      vendas_synced: 0,
    });

    for (
      let orcamentoPage = startOrcamentoPage;
      orcamentoPage < startOrcamentoPage + env.IDDAS_SYNC_MAX_PAGES;
      orcamentoPage += 1
    ) {
      throwIfCancelRequested();

      updateSyncStateRecord({
        current_item_id: null,
        current_page: orcamentoPage,
        current_stage: "Buscando página de orçamentos",
        next_orcamento_page: orcamentoPage,
      });

      const summaries = await fetchIddasList(
        "orcamento",
        orcamentoPage,
        env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE,
        cotacaoRange,
      );

      logSync("info", "sync.orcamentos.page", {
        cotacao_periodo_final: cotacaoRange.periodo_cotacao_final,
        cotacao_periodo_inicio: cotacaoRange.periodo_cotacao_inicio,
        next_orcamento_page: orcamentoPage + 1,
        page: orcamentoPage,
        returned: summaries.length,
      });

      if (summaries.length === 0) {
        updateSyncStateRecord({
          next_orcamento_page: 1,
        });
        break;
      }

      for (const summary of summaries) {
        throwIfCancelRequested();

        const orcamentoId = readId(summary);
        if (!orcamentoId) {
          continue;
        }

        updateSyncStateRecord({
          current_item_id: orcamentoId,
          current_stage: "Processando orçamento",
        });

        const detail = await fetchIddasDetail("orcamento", orcamentoId);
        const orcamento = normalizeOrcamento(detail, now);
        const orcamentoAlreadyExists = hasRow(hasOrcamento, orcamento.id);
        logSync("info", "sync.orcamento.processed", {
          cliente_pessoa_id: orcamento.cliente_pessoa_id,
          id: orcamento.id,
          identificador: orcamento.identificador,
          new_record: orcamentoAlreadyExists ? 0 : 1,
          passageiros: orcamento.passageiro_count,
        });
        if (!orcamentoAlreadyExists) {
          orcamentosCreated += 1;
        }
        upsertOrcamento.run(orcamento);
        orcamentosSynced += 1;

        updateSyncStateRecord({
          orcamentos_created: orcamentosCreated,
          orcamentos_synced: orcamentosSynced,
        });

        for (const personId of extractPersonIdsFromOrcamento(orcamento)) {
          throwIfCancelRequested();

          if (fetchedPersonIds.has(personId)) {
            continue;
          }

          updateSyncStateRecord({
            current_item_id: personId,
            current_stage: "Processando pessoa",
          });

          try {
            const pessoa = await fetchIddasDetail("pessoa", personId);
            const pessoaAlreadyExists = hasRow(hasPessoa, personId);
            if (!pessoaAlreadyExists) {
              peopleCreated += 1;
            }
            upsertPessoa.run(normalizePessoa(pessoa, now));
            fetchedPersonIds.add(personId);
            peopleSynced += 1;
            logSync("info", "sync.pessoa.processed", {
              id: personId,
              new_record: pessoaAlreadyExists ? 0 : 1,
            });
            updateSyncStateRecord({
              people_created: peopleCreated,
              people_synced: peopleSynced,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Falha ao buscar pessoa.";

            if (message.includes("IDDAS respondeu 404")) {
              fetchedPersonIds.add(personId);
              logSync("warn", "sync.pessoa.not-found", {
                id: personId,
              });
              continue;
            }

            if (!message.includes("IDDAS respondeu 429")) {
              logSync("error", "sync.pessoa.error", {
                id: personId,
                message,
              });
              throw error;
            }

            logSync("warn", "sync.pessoa.rate-limited", {
              id: personId,
            });
          }
        }

        if (!orcamento.identificador) {
          continue;
        }

        for (
          let vendaPage = 1;
          vendaPage <= env.IDDAS_SYNC_MAX_PAGES;
          vendaPage += 1
        ) {
          throwIfCancelRequested();

          updateSyncStateRecord({
            current_item_id: orcamento.id,
            current_page: vendaPage,
            current_stage: `Buscando vendas do orçamento ${orcamento.identificador}`,
          });

          const vendas = await fetchIddasList(
            "venda",
            vendaPage,
            env.IDDAS_SYNC_VENDAS_PER_PAGE,
            {
              orcamento: orcamento.identificador,
            },
          );

          logSync("info", "sync.vendas.page", {
            orcamento_id: orcamento.id,
            orcamento_identificador: orcamento.identificador,
            page: vendaPage,
            returned: vendas.length,
          });

          if (vendas.length === 0) {
            break;
          }

          for (const venda of vendas) {
            throwIfCancelRequested();

            const normalized = normalizeVenda(
              venda,
              orcamento.id,
              orcamento.identificador,
              now,
            );
            const vendaAlreadyExists = hasRow(hasVenda, normalized.id);
            if (!vendaAlreadyExists) {
              vendasCreated += 1;
            }
            upsertVenda.run(normalized);
            vendasSynced += 1;
            logSync("info", "sync.venda.processed", {
              id: normalized.id,
              new_record: vendaAlreadyExists ? 0 : 1,
              orcamento_id: normalized.orcamento_id,
              orcamento_identificador: normalized.orcamento_identificador,
            });
            updateSyncStateRecord({
              current_item_id: normalized.id,
              current_stage: "Processando venda",
              vendas_created: vendasCreated,
              vendas_synced: vendasSynced,
            });
          }

          if (vendas.length < env.IDDAS_SYNC_VENDAS_PER_PAGE) {
            break;
          }
        }
      }

      if (summaries.length < env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE) {
        updateSyncStateRecord({
          next_orcamento_page: 1,
        });
        break;
      }

      updateSyncStateRecord({
        next_orcamento_page: orcamentoPage + 1,
      });
    }

    updateSyncStateRecord({
      cancel_requested: 0,
      current_item_id: null,
      current_page: null,
      current_stage: "Concluído",
      error: null,
      last_synced_at: now,
      next_orcamento_page: getSyncStateRecord().next_orcamento_page,
      orcamentos_created: orcamentosCreated,
      orcamentos_synced: orcamentosSynced,
      people_created: peopleCreated,
      people_synced: peopleSynced,
      running_started_at: null,
      status: "completed",
      vendas_created: vendasCreated,
      vendas_synced: vendasSynced,
    });

    logSync("info", "sync.completed", {
      last_synced_at: now,
      orcamentos_created: orcamentosCreated,
      orcamentos_synced: orcamentosSynced,
      people_created: peopleCreated,
      people_synced: peopleSynced,
      vendas_created: vendasCreated,
      vendas_synced: vendasSynced,
    });

    return {
      ok: true as const,
      last_synced_at: now,
      orcamentos_synced: orcamentosSynced,
      people_synced: peopleSynced,
      vendas_synced: vendasSynced,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha inesperada no sync.";

    const cancelled = error instanceof Error && error.message === "SYNC_CANCELLED";

    updateSyncStateRecord({
      cancel_requested: 0,
      current_item_id: null,
      current_page: null,
      current_stage: cancelled ? "Cancelado" : "Falha no sync",
      error: cancelled ? null : message,
      next_orcamento_page: getSyncStateRecord().next_orcamento_page,
      orcamentos_created: orcamentosCreated,
      orcamentos_synced: orcamentosSynced,
      people_created: peopleCreated,
      people_synced: peopleSynced,
      running_started_at: null,
      status: cancelled ? "cancelled" : "failed",
      vendas_created: vendasCreated,
      vendas_synced: vendasSynced,
    });

    logSync(cancelled ? "warn" : "error", "sync.finished-with-error", {
      cancelled,
      message,
      orcamentos_created: orcamentosCreated,
      orcamentos_synced: orcamentosSynced,
      people_created: peopleCreated,
      people_synced: peopleSynced,
      vendas_created: vendasCreated,
      vendas_synced: vendasSynced,
    });

    throw error;
  }
}

export function requestCancelIddasSync() {
  logSync("warn", "sync.cancel-requested");
  updateSyncStateRecord({
    cancel_requested: 1,
    current_stage: "Cancelamento solicitado",
  });

  return getSyncStateRecord();
}

export function isIddasSyncRunning() {
  return Boolean(activeSync);
}

function throwIfCancelRequested() {
  const state = getSyncStateRecord();
  if (state.cancel_requested) {
    throw new Error("SYNC_CANCELLED");
  }
}

function hasRow(statement: typeof hasOrcamento, id: string) {
  return Boolean(statement.get(id));
}

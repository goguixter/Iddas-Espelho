import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readId } from "@/lib/iddas/accessors";
import { fetchIddasDetail, fetchIddasList } from "@/lib/iddas/client";
import {
  getIddasCotacaoRange,
  normalizeCotacaoRange,
} from "@/lib/iddas/date-range";
import {
  extractPersonIdsFromOrcamento,
  normalizeOrcamento,
  normalizeOrcamentoSummary,
  normalizePessoa,
  normalizeSolicitacao,
  normalizeSolicitacaoSummary,
  normalizeSituacao,
  normalizeVenda,
} from "@/lib/iddas/normalizers";
import { logSync } from "@/lib/sync/logger";
import { getSyncStateRecord, updateSyncStateRecord } from "@/lib/sync/store";
import type { SyncScope } from "@/lib/sync/types";

const upsertOrcamentoSummary = db.prepare(`
  INSERT INTO orcamentos (
    id,
    identificador,
    cliente_pessoa_id,
    situacao_codigo,
    situacao_nome,
    situacao_cor,
    passageiro_ids_json,
    passageiro_count,
    raw_summary_json,
    raw_json,
    source_updated_at,
    source_hash,
    last_seen_at,
    detail_synced_at,
    needs_detail,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @identificador,
    @cliente_pessoa_id,
    @situacao_codigo,
    @situacao_nome,
    @situacao_cor,
    '[]',
    0,
    @raw_summary_json,
    @raw_json,
    @source_updated_at,
    @source_hash,
    @last_seen_at,
    NULL,
    @needs_detail,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    identificador = COALESCE(excluded.identificador, orcamentos.identificador),
    cliente_pessoa_id = COALESCE(excluded.cliente_pessoa_id, orcamentos.cliente_pessoa_id),
    situacao_codigo = COALESCE(excluded.situacao_codigo, orcamentos.situacao_codigo),
    situacao_nome = COALESCE(excluded.situacao_nome, orcamentos.situacao_nome),
    situacao_cor = COALESCE(excluded.situacao_cor, orcamentos.situacao_cor),
    raw_summary_json = excluded.raw_summary_json,
    raw_json = CASE
      WHEN orcamentos.detail_synced_at IS NULL THEN excluded.raw_json
      ELSE orcamentos.raw_json
    END,
    source_updated_at = excluded.source_updated_at,
    source_hash = excluded.source_hash,
    last_seen_at = excluded.last_seen_at,
    needs_detail = excluded.needs_detail,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const upsertOrcamentoDetail = db.prepare(`
  INSERT INTO orcamentos (
    id,
    identificador,
    cliente_pessoa_id,
    situacao_codigo,
    situacao_nome,
    situacao_cor,
    passageiro_ids_json,
    passageiro_count,
    raw_summary_json,
    raw_json,
    source_updated_at,
    source_hash,
    last_seen_at,
    detail_synced_at,
    needs_detail,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @identificador,
    @cliente_pessoa_id,
    @situacao_codigo,
    @situacao_nome,
    @situacao_cor,
    @passageiro_ids_json,
    @passageiro_count,
    @raw_summary_json,
    @raw_json,
    @source_updated_at,
    @source_hash,
    @last_seen_at,
    @detail_synced_at,
    0,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    identificador = excluded.identificador,
    cliente_pessoa_id = excluded.cliente_pessoa_id,
    situacao_codigo = excluded.situacao_codigo,
    situacao_nome = excluded.situacao_nome,
    situacao_cor = excluded.situacao_cor,
    passageiro_ids_json = excluded.passageiro_ids_json,
    passageiro_count = excluded.passageiro_count,
    raw_summary_json = CASE
      WHEN orcamentos.raw_summary_json = '{}' THEN excluded.raw_summary_json
      ELSE orcamentos.raw_summary_json
    END,
    raw_json = excluded.raw_json,
    source_updated_at = COALESCE(orcamentos.source_updated_at, excluded.source_updated_at),
    source_hash = COALESCE(orcamentos.source_hash, excluded.source_hash),
    last_seen_at = COALESCE(orcamentos.last_seen_at, excluded.last_seen_at),
    detail_synced_at = excluded.detail_synced_at,
    needs_detail = 0,
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

const upsertSituacao = db.prepare(`
  INSERT INTO situacoes (
    id,
    codigo,
    nome,
    cor,
    ordem,
    situacao_final,
    situacao_padrao,
    raw_json,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @codigo,
    @nome,
    @cor,
    @ordem,
    @situacao_final,
    @situacao_padrao,
    @raw_json,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    codigo = excluded.codigo,
    nome = excluded.nome,
    cor = excluded.cor,
    ordem = excluded.ordem,
    situacao_final = excluded.situacao_final,
    situacao_padrao = excluded.situacao_padrao,
    raw_json = excluded.raw_json,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const upsertSolicitacaoSummary = db.prepare(`
  INSERT INTO solicitacoes (
    id,
    nome,
    email,
    telefone,
    origem,
    destino,
    data_ida,
    data_volta,
    adultos,
    criancas,
    possui_flexibilidade,
    observacao,
    data_solicitacao,
    linked_orcamento_id,
    linked_orcamento_identificador,
    raw_summary_json,
    raw_json,
    source_updated_at,
    source_hash,
    last_seen_at,
    detail_synced_at,
    needs_detail,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @nome,
    @email,
    @telefone,
    @origem,
    @destino,
    @data_ida,
    @data_volta,
    @adultos,
    @criancas,
    @possui_flexibilidade,
    @observacao,
    @data_solicitacao,
    @linked_orcamento_id,
    @linked_orcamento_identificador,
    @raw_summary_json,
    @raw_json,
    @source_updated_at,
    @source_hash,
    @last_seen_at,
    NULL,
    @needs_detail,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    nome = COALESCE(excluded.nome, solicitacoes.nome),
    email = COALESCE(excluded.email, solicitacoes.email),
    telefone = COALESCE(excluded.telefone, solicitacoes.telefone),
    origem = COALESCE(excluded.origem, solicitacoes.origem),
    destino = COALESCE(excluded.destino, solicitacoes.destino),
    data_ida = COALESCE(excluded.data_ida, solicitacoes.data_ida),
    data_volta = COALESCE(excluded.data_volta, solicitacoes.data_volta),
    adultos = COALESCE(excluded.adultos, solicitacoes.adultos),
    criancas = COALESCE(excluded.criancas, solicitacoes.criancas),
    possui_flexibilidade = COALESCE(excluded.possui_flexibilidade, solicitacoes.possui_flexibilidade),
    observacao = COALESCE(excluded.observacao, solicitacoes.observacao),
    data_solicitacao = COALESCE(excluded.data_solicitacao, solicitacoes.data_solicitacao),
    raw_summary_json = excluded.raw_summary_json,
    raw_json = CASE
      WHEN solicitacoes.detail_synced_at IS NULL THEN excluded.raw_json
      ELSE solicitacoes.raw_json
    END,
    source_updated_at = excluded.source_updated_at,
    source_hash = excluded.source_hash,
    last_seen_at = excluded.last_seen_at,
    needs_detail = excluded.needs_detail,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const upsertSolicitacaoDetail = db.prepare(`
  INSERT INTO solicitacoes (
    id,
    nome,
    email,
    telefone,
    origem,
    destino,
    data_ida,
    data_volta,
    adultos,
    criancas,
    possui_flexibilidade,
    observacao,
    data_solicitacao,
    linked_orcamento_id,
    linked_orcamento_identificador,
    raw_summary_json,
    raw_json,
    source_updated_at,
    source_hash,
    last_seen_at,
    detail_synced_at,
    needs_detail,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @nome,
    @email,
    @telefone,
    @origem,
    @destino,
    @data_ida,
    @data_volta,
    @adultos,
    @criancas,
    @possui_flexibilidade,
    @observacao,
    @data_solicitacao,
    @linked_orcamento_id,
    @linked_orcamento_identificador,
    @raw_summary_json,
    @raw_json,
    @source_updated_at,
    @source_hash,
    @last_seen_at,
    @detail_synced_at,
    0,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    nome = excluded.nome,
    email = excluded.email,
    telefone = excluded.telefone,
    origem = excluded.origem,
    destino = excluded.destino,
    data_ida = excluded.data_ida,
    data_volta = excluded.data_volta,
    adultos = excluded.adultos,
    criancas = excluded.criancas,
    possui_flexibilidade = excluded.possui_flexibilidade,
    observacao = excluded.observacao,
    data_solicitacao = excluded.data_solicitacao,
    linked_orcamento_id = COALESCE(solicitacoes.linked_orcamento_id, excluded.linked_orcamento_id),
    linked_orcamento_identificador = COALESCE(solicitacoes.linked_orcamento_identificador, excluded.linked_orcamento_identificador),
    raw_summary_json = CASE
      WHEN solicitacoes.raw_summary_json = '{}' THEN excluded.raw_summary_json
      ELSE solicitacoes.raw_summary_json
    END,
    raw_json = excluded.raw_json,
    source_updated_at = COALESCE(solicitacoes.source_updated_at, excluded.source_updated_at),
    source_hash = COALESCE(solicitacoes.source_hash, excluded.source_hash),
    last_seen_at = COALESCE(solicitacoes.last_seen_at, excluded.last_seen_at),
    detail_synced_at = excluded.detail_synced_at,
    needs_detail = 0,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const hasPessoa = db.prepare(`SELECT 1 FROM pessoas WHERE id = ? LIMIT 1`);
const hasVenda = db.prepare(`SELECT 1 FROM vendas WHERE id = ? LIMIT 1`);

const getOrcamentoMirrorState = db.prepare(`
  SELECT id, source_hash, source_updated_at, detail_synced_at
  FROM orcamentos
  WHERE id = ?
`);

const getSolicitacaoMirrorState = db.prepare(`
  SELECT id, source_hash, source_updated_at, detail_synced_at
  FROM solicitacoes
  WHERE id = ?
`);

const listPendingOrcamentoIds = db.prepare(`
  SELECT id
  FROM orcamentos
  WHERE needs_detail = 1
  ORDER BY COALESCE(last_seen_at, synced_at) DESC, id ASC
`);

const listPendingSolicitacaoIds = db.prepare(`
  SELECT id
  FROM solicitacoes
  WHERE needs_detail = 1
  ORDER BY COALESCE(last_seen_at, synced_at) DESC, id ASC
`);

const enqueueSyncTask = db.prepare(`
  INSERT INTO sync_tasks (
    scope,
    task_type,
    task_key,
    entity_id,
    parent_id,
    payload_json,
    status,
    attempts,
    last_error,
    created_at,
    updated_at
  )
  VALUES (
    @scope,
    @task_type,
    @task_key,
    @entity_id,
    @parent_id,
    @payload_json,
    'pending',
    0,
    NULL,
    @created_at,
    @updated_at
  )
  ON CONFLICT(task_key) DO UPDATE SET
    entity_id = excluded.entity_id,
    parent_id = excluded.parent_id,
    payload_json = excluded.payload_json,
    status = 'pending',
    last_error = NULL,
    updated_at = excluded.updated_at
`);

const listPendingSyncTasksByType = db.prepare(`
  SELECT id, task_type, task_key, entity_id, parent_id, payload_json, attempts
  FROM sync_tasks
  WHERE scope = ? AND status = 'pending' AND task_type = ?
  ORDER BY id ASC
`);

const markSyncTaskFailed = db.prepare(`
  UPDATE sync_tasks
  SET
    status = 'failed',
    attempts = attempts + 1,
    last_error = ?,
    updated_at = ?
  WHERE id = ?
`);

const deleteSyncTask = db.prepare(`
  DELETE FROM sync_tasks
  WHERE id = ?
`);

const reconcileSolicitacoesOrcamentoIdByIdentificador = db.prepare(`
  UPDATE solicitacoes
  SET linked_orcamento_id = (
    SELECT o.id
    FROM orcamentos o
    WHERE o.identificador = solicitacoes.linked_orcamento_identificador
    ORDER BY datetime(o.updated_at) DESC, o.id DESC
    LIMIT 1
  )
  WHERE linked_orcamento_identificador IS NOT NULL
    AND TRIM(linked_orcamento_identificador) <> ''
    AND (
      linked_orcamento_id IS NULL
      OR linked_orcamento_id <> (
        SELECT o.id
        FROM orcamentos o
        WHERE o.identificador = solicitacoes.linked_orcamento_identificador
        ORDER BY datetime(o.updated_at) DESC, o.id DESC
        LIMIT 1
      )
    )
`);

const reconcileSolicitacoesIdentificadorByOrcamentoId = db.prepare(`
  UPDATE solicitacoes
  SET linked_orcamento_identificador = (
    SELECT o.identificador
    FROM orcamentos o
    WHERE o.id = solicitacoes.linked_orcamento_id
    LIMIT 1
  )
  WHERE linked_orcamento_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM orcamentos o
      WHERE o.id = solicitacoes.linked_orcamento_id
        AND o.identificador IS NOT NULL
        AND TRIM(o.identificador) <> ''
    )
    AND (
      linked_orcamento_identificador IS NULL
      OR TRIM(linked_orcamento_identificador) = ''
      OR linked_orcamento_identificador <> (
        SELECT o.identificador
        FROM orcamentos o
        WHERE o.id = solicitacoes.linked_orcamento_id
        LIMIT 1
      )
    )
`);

type SyncResult = {
  last_synced_at: string;
  ok: true;
  orcamentos_synced: number;
  people_synced: number;
  vendas_synced: number;
};

type MirrorStateRow = {
  detail_synced_at: string | null;
  id: string;
  source_hash: string | null;
  source_updated_at: string | null;
};

type SyncTaskType = "pessoa" | "venda_orcamento";

type SyncTaskRow = {
  attempts: number;
  entity_id: string;
  id: number;
  parent_id: string | null;
  payload_json: string;
  task_key: string;
  task_type: SyncTaskType;
};

let activeOrcamentosSync: Promise<SyncResult> | null = null;
let activeSolicitacoesSync: Promise<SyncResult> | null = null;

export async function syncIddasScope(
  scope: Extract<SyncScope, "orcamentos" | "solicitacoes">,
  input?: {
    periodo_cotacao_final?: string;
    periodo_cotacao_inicio?: string;
  },
) {
  return scope === "solicitacoes" ? syncSolicitacoesMirror() : syncIddasMirror(input);
}

export async function syncIddasMirror(input?: {
  periodo_cotacao_final?: string;
  periodo_cotacao_inicio?: string;
}) {
  if (activeOrcamentosSync) {
    logSync("info", "sync.reuse-active-job");
    return activeOrcamentosSync;
  }

  logSync("info", "sync.start-request");
  activeOrcamentosSync = runOrcamentosSync(input);

  try {
    return await activeOrcamentosSync;
  } finally {
    activeOrcamentosSync = null;
  }
}

export async function syncSolicitacoesMirror() {
  if (activeSolicitacoesSync) {
    logSync("info", "sync.solicitacoes.reuse-active-job");
    return activeSolicitacoesSync;
  }

  logSync("info", "sync.solicitacoes.start-request");
  activeSolicitacoesSync = runSolicitacoesSync();

  try {
    return await activeSolicitacoesSync;
  } finally {
    activeSolicitacoesSync = null;
  }
}

async function runOrcamentosSync(input?: {
  periodo_cotacao_final?: string;
  periodo_cotacao_inicio?: string;
}): Promise<SyncResult> {
  const scope: SyncScope = "orcamentos";
  const initialState = getSyncStateRecord(scope);
  const startOrcamentoPage = Math.max(1, initialState.next_orcamento_page);
  const cotacaoRange =
    normalizeCotacaoRange(input ?? {}) ??
    getIddasCotacaoRange(env.IDDAS_SYNC_LOOKBACK_DAYS);
  const now = new Date().toISOString();
  const fetchedPersonIds = new Set<string>();
  let orcamentosCreated = 0;
  let orcamentosCollected = 0;
  let peopleCreated = 0;
  let peopleSynced = 0;
  let vendasCreated = 0;
  let vendasSynced = 0;
  let queuedOrcamentos = 0;

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

    resetScopeState(scope, now, startOrcamentoPage, "Sincronizando situações");

    const situacoes = await fetchIddasList("situacao", 1, 100);
    logSync("info", "sync.situacoes.page", { page: 1, returned: situacoes.length });
    for (const situacao of situacoes) {
      upsertSituacao.run(normalizeSituacao(situacao, now));
    }

    for (
      let orcamentoPage = startOrcamentoPage;
      orcamentoPage < startOrcamentoPage + env.IDDAS_SYNC_MAX_PAGES;
      orcamentoPage += 1
    ) {
      throwIfCancelRequested(scope);

      updateSyncStateRecord(scope, {
        current_item_id: null,
        current_page: orcamentoPage,
        current_stage: "Coletando orçamentos da página",
        next_page: orcamentoPage,
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
        updateSyncStateRecord(scope, {
          next_page: 1,
          next_orcamento_page: 1,
        });
        break;
      }

      for (const summary of summaries) {
        throwIfCancelRequested(scope);

        const orcamentoId = readId(summary);
        if (!orcamentoId) {
          continue;
        }

        const normalized = normalizeOrcamentoSummary(summary, now);
        const existing = getMirrorState(getOrcamentoMirrorState, orcamentoId);
        const isNew = !existing;
        const needsDetail = shouldRefreshDetail(existing, normalized.source_hash, normalized.source_updated_at);

        upsertOrcamentoSummary.run({
          ...normalized,
          needs_detail: needsDetail ? 1 : 0,
        });

        if (isNew) {
          orcamentosCreated += 1;
        }
        if (needsDetail) {
          queuedOrcamentos += 1;
        }

        orcamentosCollected += 1;

        logSync("info", "sync.orcamento.collected", {
          id: normalized.id,
          identificador: normalized.identificador,
          new_record: isNew ? 1 : 0,
          needs_detail: needsDetail ? 1 : 0,
        });
      }

      updateSyncStateRecord(scope, {
        items_created: orcamentosCreated,
        items_synced: orcamentosCollected,
        orcamentos_created: orcamentosCreated,
        orcamentos_synced: orcamentosCollected,
      });

      if (summaries.length < env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE) {
        updateSyncStateRecord(scope, {
          next_page: 1,
          next_orcamento_page: 1,
        });
        break;
      }

      updateSyncStateRecord(scope, {
        next_page: orcamentoPage + 1,
        next_orcamento_page: orcamentoPage + 1,
      });
    }

    const pendingOrcamentoIds = readPendingIds(listPendingOrcamentoIds);
    logSync("info", "sync.orcamentos.pending-detail", {
      pending: pendingOrcamentoIds.length,
      queued_in_collection: queuedOrcamentos,
    });

    for (const orcamentoId of pendingOrcamentoIds) {
      throwIfCancelRequested(scope);

      updateSyncStateRecord(scope, {
        current_item_id: orcamentoId,
        current_stage: "Detalhando orçamento pendente",
      });

      const detail = await fetchIddasDetail("orcamento", orcamentoId);
      const normalized = normalizeOrcamento(detail, now);
      upsertOrcamentoDetail.run(normalized);

      logSync("info", "sync.orcamento.detailed", {
        cliente_pessoa_id: normalized.cliente_pessoa_id,
        id: normalized.id,
        identificador: normalized.identificador,
        passageiros: normalized.passageiro_count,
      });

      for (const personId of extractPersonIdsFromOrcamento(normalized)) {
        enqueueDerivedTask(scope, "pessoa", personId, normalized.id, { personId });
      }

      if (normalized.identificador) {
        enqueueDerivedTask(scope, "venda_orcamento", normalized.id, normalized.id, {
          identificador: normalized.identificador,
          orcamentoId: normalized.id,
        });
      }
    }

    const pendingPessoaTasks = readPendingTasks(scope, "pessoa");
    logSync("info", "sync.pessoas.pending-tasks", {
      pending: pendingPessoaTasks.length,
    });

    for (const task of pendingPessoaTasks) {
      throwIfCancelRequested(scope);

      const personId = task.entity_id;
      if (fetchedPersonIds.has(personId)) {
        deleteSyncTask.run(task.id);
        continue;
      }

      updateSyncStateRecord(scope, {
        current_item_id: personId,
        current_stage: "Atualizando pessoas pendentes",
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
        deleteSyncTask.run(task.id);

        logSync("info", "sync.pessoa.processed", {
          id: personId,
          new_record: pessoaAlreadyExists ? 0 : 1,
        });

        updateSyncStateRecord(scope, {
          people_created: peopleCreated,
          people_synced: peopleSynced,
          related_created: peopleCreated,
          related_synced: peopleSynced,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao buscar pessoa.";

        if (message.includes("IDDAS respondeu 404")) {
          fetchedPersonIds.add(personId);
          deleteSyncTask.run(task.id);
          logSync("warn", "sync.pessoa.not-found", { id: personId });
          continue;
        }

        if (message.includes("IDDAS respondeu 429")) {
          logSync("warn", "sync.pessoa.rate-limited", { id: personId });
          continue;
        }

        markSyncTaskFailed.run(message, now, task.id);
        logSync("error", "sync.pessoa.error", { id: personId, message });
        throw error;
      }
    }

    const pendingVendaTasks = readPendingTasks(scope, "venda_orcamento");
    logSync("info", "sync.vendas.pending-tasks", {
      pending: pendingVendaTasks.length,
    });

    for (const task of pendingVendaTasks) {
      throwIfCancelRequested(scope);

      const payload = parseTaskPayload(task.payload_json);
      const orcamentoId = payload.orcamentoId ?? task.entity_id;
      const orcamentoIdentificador = payload.identificador;

      if (!orcamentoIdentificador) {
        deleteSyncTask.run(task.id);
        continue;
      }

      for (let vendaPage = 1; vendaPage <= env.IDDAS_SYNC_MAX_PAGES; vendaPage += 1) {
        throwIfCancelRequested(scope);

        updateSyncStateRecord(scope, {
          current_item_id: orcamentoId,
          current_page: vendaPage,
          current_stage: `Atualizando vendas pendentes de ${orcamentoIdentificador}`,
        });

        const vendas = await fetchIddasList("venda", vendaPage, env.IDDAS_SYNC_VENDAS_PER_PAGE, {
          orcamento: orcamentoIdentificador,
        });

        logSync("info", "sync.vendas.page", {
          orcamento_id: orcamentoId,
          orcamento_identificador: orcamentoIdentificador,
          page: vendaPage,
          returned: vendas.length,
        });

        if (vendas.length === 0) {
          break;
        }

        for (const venda of vendas) {
          throwIfCancelRequested(scope);

          const vendaNormalized = normalizeVenda(venda, orcamentoId, orcamentoIdentificador, now);
          const vendaAlreadyExists = hasRow(hasVenda, vendaNormalized.id);
          if (!vendaAlreadyExists) {
            vendasCreated += 1;
          }
          upsertVenda.run(vendaNormalized);
          vendasSynced += 1;

          logSync("info", "sync.venda.processed", {
            id: vendaNormalized.id,
            new_record: vendaAlreadyExists ? 0 : 1,
            orcamento_id: vendaNormalized.orcamento_id,
            orcamento_identificador: vendaNormalized.orcamento_identificador,
          });

          updateSyncStateRecord(scope, {
            current_item_id: vendaNormalized.id,
            current_stage: "Atualizando vendas pendentes",
            secondary_created: vendasCreated,
            secondary_synced: vendasSynced,
            vendas_created: vendasCreated,
            vendas_synced: vendasSynced,
          });
        }

        if (vendas.length < env.IDDAS_SYNC_VENDAS_PER_PAGE) {
          break;
        }
      }

      deleteSyncTask.run(task.id);
    }

    updateSyncStateRecord(scope, {
      current_item_id: null,
      current_page: null,
      current_stage: "Reconciliação local de vínculos",
    });

    const reconciliation = runLocalReconciliation();
    logSync("info", "sync.reconciliation.completed", {
      linked_by_id: reconciliation.linkedById,
      linked_by_identificador: reconciliation.linkedByIdentificador,
      scope,
    });

    completeScopeState(scope, {
      error: null,
      itemsCreated: orcamentosCreated,
      itemsSynced: orcamentosCollected,
      now,
      peopleCreated,
      peopleSynced,
      vendasCreated,
      vendasSynced,
    });

    logSync("info", "sync.completed", {
      last_synced_at: now,
      orcamentos_collected: orcamentosCollected,
      orcamentos_created: orcamentosCreated,
      orcamentos_detailed: pendingOrcamentoIds.length,
      people_created: peopleCreated,
      people_synced: peopleSynced,
      vendas_created: vendasCreated,
      vendas_synced: vendasSynced,
    });

    return {
      ok: true,
      last_synced_at: now,
      orcamentos_synced: orcamentosCollected,
      people_synced: peopleSynced,
      vendas_synced: vendasSynced,
    };
  } catch (error) {
    finishScopeWithError(scope, {
      error,
      itemsCreated: orcamentosCreated,
      itemsSynced: orcamentosCollected,
      peopleCreated,
      peopleSynced,
      vendasCreated,
      vendasSynced,
    });
    throw error;
  }
}

async function runSolicitacoesSync(): Promise<SyncResult> {
  const scope: SyncScope = "solicitacoes";
  const now = new Date().toISOString();
  let itemsCreated = 0;
  let itemsCollected = 0;
  let queuedSolicitacoes = 0;

  try {
    resetScopeState(scope, now, 1, "Coletando solicitações");

    for (
      let solicitacaoPage = 1;
      solicitacaoPage <= env.IDDAS_SYNC_MAX_PAGES;
      solicitacaoPage += 1
    ) {
      throwIfCancelRequested(scope);

      updateSyncStateRecord(scope, {
        current_item_id: null,
        current_page: solicitacaoPage,
        current_stage: "Coletando solicitações da página",
        next_page: solicitacaoPage,
      });

      const solicitacoes = await fetchIddasList(
        "solicitacao",
        solicitacaoPage,
        env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE,
      );

      logSync("info", "sync.solicitacoes.page", {
        page: solicitacaoPage,
        returned: solicitacoes.length,
      });

      if (solicitacoes.length === 0) {
        updateSyncStateRecord(scope, { next_page: 1 });
        break;
      }

      for (const summary of solicitacoes) {
        throwIfCancelRequested(scope);

        const solicitacaoId = readId(summary);
        if (!solicitacaoId) {
          continue;
        }

        const normalized = normalizeSolicitacaoSummary(summary, now);
        const existing = getMirrorState(getSolicitacaoMirrorState, solicitacaoId);
        const isNew = !existing;
        const needsDetail = shouldRefreshDetail(existing, normalized.source_hash, normalized.source_updated_at);

        upsertSolicitacaoSummary.run({
          ...normalized,
          needs_detail: needsDetail ? 1 : 0,
        });

        if (isNew) {
          itemsCreated += 1;
        }
        if (needsDetail) {
          queuedSolicitacoes += 1;
        }
        itemsCollected += 1;

        logSync("info", "sync.solicitacao.collected", {
          id: normalized.id,
          new_record: isNew ? 1 : 0,
          needs_detail: needsDetail ? 1 : 0,
        });
      }

      updateSyncStateRecord(scope, {
        items_created: itemsCreated,
        items_synced: itemsCollected,
      });

      if (solicitacoes.length < env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE) {
        updateSyncStateRecord(scope, { next_page: 1 });
        break;
      }

      updateSyncStateRecord(scope, {
        next_page: solicitacaoPage + 1,
      });
    }

    const pendingSolicitacaoIds = readPendingIds(listPendingSolicitacaoIds);
    logSync("info", "sync.solicitacoes.pending-detail", {
      pending: pendingSolicitacaoIds.length,
      queued_in_collection: queuedSolicitacoes,
    });

    for (const solicitacaoId of pendingSolicitacaoIds) {
      throwIfCancelRequested(scope);

      updateSyncStateRecord(scope, {
        current_item_id: solicitacaoId,
        current_stage: "Detalhando solicitação pendente",
      });

      const detail = await fetchIddasDetail("solicitacao", solicitacaoId);
      upsertSolicitacaoDetail.run(normalizeSolicitacao(detail, now));

      logSync("info", "sync.solicitacao.detailed", {
        id: solicitacaoId,
      });
    }

    updateSyncStateRecord(scope, {
      current_item_id: null,
      current_page: null,
      current_stage: "Reconciliação local de vínculos",
    });

    const reconciliation = runLocalReconciliation();
    logSync("info", "sync.reconciliation.completed", {
      linked_by_id: reconciliation.linkedById,
      linked_by_identificador: reconciliation.linkedByIdentificador,
      scope,
    });

    updateSyncStateRecord(scope, {
      cancel_requested: 0,
      current_item_id: null,
      current_page: null,
      current_stage: "Concluído",
      error: null,
      items_created: itemsCreated,
      items_synced: itemsCollected,
      last_synced_at: now,
      next_page: getSyncStateRecord(scope).next_page,
      running_started_at: null,
      status: "completed",
    });

    return {
      ok: true,
      last_synced_at: now,
      orcamentos_synced: itemsCollected,
      people_synced: 0,
      vendas_synced: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada no sync.";
    const cancelled = error instanceof Error && error.message === "SYNC_CANCELLED";

    updateSyncStateRecord(scope, {
      cancel_requested: 0,
      current_item_id: null,
      current_page: null,
      current_stage: cancelled ? "Cancelado" : "Falha no sync",
      error: cancelled ? null : message,
      items_created: itemsCreated,
      items_synced: itemsCollected,
      next_page: getSyncStateRecord(scope).next_page,
      running_started_at: null,
      status: cancelled ? "cancelled" : "failed",
    });

    throw error;
  }
}

export function requestCancelIddasSync(scope: SyncScope) {
  logSync("warn", "sync.cancel-requested", { scope });
  updateSyncStateRecord(scope, {
    cancel_requested: 1,
    current_stage: "Cancelamento solicitado",
  });

  return getSyncStateRecord(scope);
}

export function isIddasSyncRunning(scope: SyncScope) {
  return scope === "orcamentos"
    ? Boolean(activeOrcamentosSync)
    : scope === "solicitacoes"
      ? Boolean(activeSolicitacoesSync)
      : Boolean(activeOrcamentosSync || activeSolicitacoesSync);
}

function resetScopeState(scope: SyncScope, now: string, nextPage: number, stage: string) {
  updateSyncStateRecord(scope, {
    cancel_requested: 0,
    current_item_id: null,
    current_page: nextPage,
    current_stage: stage,
    error: null,
    items_created: 0,
    items_synced: 0,
    last_synced_at: null,
    next_page: nextPage,
    next_orcamento_page: nextPage,
    orcamentos_created: 0,
    orcamentos_synced: 0,
    people_created: 0,
    people_synced: 0,
    related_created: 0,
    related_synced: 0,
    running_started_at: now,
    secondary_created: 0,
    secondary_synced: 0,
    status: "running",
    vendas_created: 0,
    vendas_synced: 0,
  });
}

function completeScopeState(
  scope: SyncScope,
  input: {
    error: string | null;
    itemsCreated: number;
    itemsSynced: number;
    now: string;
    peopleCreated: number;
    peopleSynced: number;
    vendasCreated: number;
    vendasSynced: number;
  },
) {
  updateSyncStateRecord(scope, {
    cancel_requested: 0,
    current_item_id: null,
    current_page: null,
    current_stage: "Concluído",
    error: input.error,
    items_created: input.itemsCreated,
    items_synced: input.itemsSynced,
    last_synced_at: input.now,
    next_page: getSyncStateRecord(scope).next_page,
    next_orcamento_page: getSyncStateRecord(scope).next_orcamento_page,
    orcamentos_created: input.itemsCreated,
    orcamentos_synced: input.itemsSynced,
    people_created: input.peopleCreated,
    people_synced: input.peopleSynced,
    related_created: input.peopleCreated,
    related_synced: input.peopleSynced,
    running_started_at: null,
    secondary_created: input.vendasCreated,
    secondary_synced: input.vendasSynced,
    status: "completed",
    vendas_created: input.vendasCreated,
    vendas_synced: input.vendasSynced,
  });
}

function finishScopeWithError(
  scope: SyncScope,
  input: {
    error: unknown;
    itemsCreated: number;
    itemsSynced: number;
    peopleCreated: number;
    peopleSynced: number;
    vendasCreated: number;
    vendasSynced: number;
  },
) {
  const message =
    input.error instanceof Error ? input.error.message : "Falha inesperada no sync.";
  const cancelled = input.error instanceof Error && input.error.message === "SYNC_CANCELLED";

  updateSyncStateRecord(scope, {
    cancel_requested: 0,
    current_item_id: null,
    current_page: null,
    current_stage: cancelled ? "Cancelado" : "Falha no sync",
    error: cancelled ? null : message,
    items_created: input.itemsCreated,
    items_synced: input.itemsSynced,
    next_page: getSyncStateRecord(scope).next_page,
    next_orcamento_page: getSyncStateRecord(scope).next_orcamento_page,
    orcamentos_created: input.itemsCreated,
    orcamentos_synced: input.itemsSynced,
    people_created: input.peopleCreated,
    people_synced: input.peopleSynced,
    related_created: input.peopleCreated,
    related_synced: input.peopleSynced,
    running_started_at: null,
    secondary_created: input.vendasCreated,
    secondary_synced: input.vendasSynced,
    status: cancelled ? "cancelled" : "failed",
    vendas_created: input.vendasCreated,
    vendas_synced: input.vendasSynced,
  });

  logSync(cancelled ? "warn" : "error", "sync.finished-with-error", {
    cancelled,
    message,
    orcamentos_created: input.itemsCreated,
    orcamentos_synced: input.itemsSynced,
    people_created: input.peopleCreated,
    people_synced: input.peopleSynced,
    vendas_created: input.vendasCreated,
    vendas_synced: input.vendasSynced,
  });
}

function throwIfCancelRequested(scope: SyncScope) {
  const state = getSyncStateRecord(scope);
  if (state.cancel_requested) {
    throw new Error("SYNC_CANCELLED");
  }
}

function hasRow(statement: { get(id: string): unknown }, id: string) {
  return Boolean(statement.get(id));
}

function getMirrorState(statement: { get(id: string): unknown }, id: string) {
  return (statement.get(id) as MirrorStateRow | undefined) ?? null;
}

function shouldRefreshDetail(
  existing: MirrorStateRow | null,
  nextHash: string,
  nextSourceUpdatedAt: string | null,
) {
  if (!existing) {
    return true;
  }

  if (!existing.detail_synced_at) {
    return true;
  }

  if (existing.source_hash !== nextHash) {
    return true;
  }

  return (existing.source_updated_at ?? null) !== (nextSourceUpdatedAt ?? null);
}

function readPendingIds(statement: { all(): unknown[] }) {
  return (statement.all() as Array<{ id: string }>).map((row) => row.id);
}

function enqueueDerivedTask(
  scope: SyncScope,
  taskType: SyncTaskType,
  entityId: string,
  parentId: string | null,
  payload: Record<string, string>,
) {
  const now = new Date().toISOString();
  const taskKey = taskType === "pessoa" ? `pessoa:${entityId}` : `venda_orcamento:${entityId}`;

  enqueueSyncTask.run({
    scope,
    task_type: taskType,
    task_key: taskKey,
    entity_id: entityId,
    parent_id: parentId,
    payload_json: JSON.stringify(payload),
    created_at: now,
    updated_at: now,
  });
}

function readPendingTasks(scope: SyncScope, taskType: SyncTaskType) {
  return listPendingSyncTasksByType.all(scope, taskType) as SyncTaskRow[];
}

function parseTaskPayload(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function runLocalReconciliation() {
  const linkedById = reconcileSolicitacoesOrcamentoIdByIdentificador.run().changes;
  const linkedByIdentificador =
    reconcileSolicitacoesIdentificadorByOrcamentoId.run().changes;

  return {
    linkedById,
    linkedByIdentificador,
  };
}

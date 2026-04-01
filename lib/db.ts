import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "iddas-mirror.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

const globalForDb = globalThis as unknown as {
  iddasDb?: Database.Database;
};

const instance = globalForDb.iddasDb ?? new Database(dbPath);
instance.pragma("journal_mode = WAL");

export const db = instance;

runMigrations();

if (!globalForDb.iddasDb) {
  globalForDb.iddasDb = db;
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orcamentos (
      id TEXT PRIMARY KEY,
      identificador TEXT,
      created_at_source TEXT,
      cliente_pessoa_id TEXT,
      situacao_codigo TEXT,
      situacao_nome TEXT,
      situacao_cor TEXT,
      passageiro_ids_json TEXT NOT NULL DEFAULT '[]',
      passageiro_count INTEGER NOT NULL DEFAULT 0,
      raw_summary_json TEXT NOT NULL DEFAULT '{}',
      raw_json TEXT NOT NULL,
      source_updated_at TEXT,
      source_hash TEXT,
      last_seen_at TEXT,
      detail_synced_at TEXT,
      needs_detail INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orcamentos_identificador
      ON orcamentos (identificador);

    CREATE TABLE IF NOT EXISTS situacoes (
      id TEXT PRIMARY KEY,
      codigo TEXT UNIQUE,
      nome TEXT,
      cor TEXT,
      ordem TEXT,
      situacao_final TEXT,
      situacao_padrao TEXT,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_situacoes_codigo
      ON situacoes (codigo);

    CREATE TABLE IF NOT EXISTS pessoas (
      id TEXT PRIMARY KEY,
      nome TEXT,
      email TEXT,
      cpf TEXT,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vendas (
      id TEXT PRIMARY KEY,
      orcamento_id TEXT,
      orcamento_identificador TEXT,
      status TEXT,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_vendas_orcamento_identificador
      ON vendas (orcamento_identificador);

    CREATE TABLE IF NOT EXISTS solicitacoes (
      id TEXT PRIMARY KEY,
      nome TEXT,
      email TEXT,
      telefone TEXT,
      origem TEXT,
      destino TEXT,
      data_ida TEXT,
      data_volta TEXT,
      adultos TEXT,
      criancas TEXT,
      possui_flexibilidade TEXT,
      observacao TEXT,
      data_solicitacao TEXT,
      linked_orcamento_id TEXT,
      linked_orcamento_identificador TEXT,
      match_status TEXT NOT NULL DEFAULT 'unmatched',
      match_reason TEXT,
      raw_summary_json TEXT NOT NULL DEFAULT '{}',
      raw_json TEXT NOT NULL,
      source_updated_at TEXT,
      source_hash TEXT,
      last_seen_at TEXT,
      detail_synced_at TEXT,
      needs_detail INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_solicitacoes_linked_orcamento_id
      ON solicitacoes (linked_orcamento_id);

    CREATE INDEX IF NOT EXISTS idx_solicitacoes_linked_orcamento_identificador
      ON solicitacoes (linked_orcamento_identificador);

    CREATE INDEX IF NOT EXISTS idx_solicitacoes_data_solicitacao
      ON solicitacoes (data_solicitacao);

    CREATE TABLE IF NOT EXISTS sync_state (
      scope TEXT PRIMARY KEY,
      last_synced_at TEXT,
      items_synced INTEGER NOT NULL DEFAULT 0,
      items_created INTEGER NOT NULL DEFAULT 0,
      related_synced INTEGER NOT NULL DEFAULT 0,
      related_created INTEGER NOT NULL DEFAULT 0,
      secondary_synced INTEGER NOT NULL DEFAULT 0,
      secondary_created INTEGER NOT NULL DEFAULT 0,
      details_synced INTEGER NOT NULL DEFAULT 0,
      items_skipped INTEGER NOT NULL DEFAULT 0,
      queue_pending INTEGER NOT NULL DEFAULT 0,
      reconciled_synced INTEGER NOT NULL DEFAULT 0,
      next_page INTEGER NOT NULL DEFAULT 1,
      orcamentos_synced INTEGER NOT NULL DEFAULT 0,
      people_synced INTEGER NOT NULL DEFAULT 0,
      vendas_synced INTEGER NOT NULL DEFAULT 0,
      orcamentos_created INTEGER NOT NULL DEFAULT 0,
      people_created INTEGER NOT NULL DEFAULT 0,
      vendas_created INTEGER NOT NULL DEFAULT 0,
      next_orcamento_page INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'idle',
      current_stage TEXT,
      current_page INTEGER,
      current_item_id TEXT,
      cancel_requested INTEGER NOT NULL DEFAULT 0,
      running_started_at TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      task_type TEXT NOT NULL,
      task_key TEXT NOT NULL UNIQUE,
      entity_id TEXT NOT NULL,
      parent_id TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_tasks_scope_status_type
      ON sync_tasks (scope, status, task_type);

    CREATE TABLE IF NOT EXISTS orcamentos_projection (
      id TEXT PRIMARY KEY,
      identificador TEXT,
      cliente_pessoa_id TEXT,
      situacao_codigo TEXT,
      situacao_nome TEXT,
      situacao_cor TEXT,
      match_status TEXT,
      match_reason TEXT,
      situacao_ordem TEXT,
      passageiro_count INTEGER NOT NULL DEFAULT 0,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      cliente_nome_db TEXT,
      solicitacao_nome TEXT
    );

    CREATE TABLE IF NOT EXISTS solicitacoes_projection (
      id TEXT PRIMARY KEY,
      nome TEXT,
      email TEXT,
      telefone TEXT,
      origem TEXT,
      destino TEXT,
      data_ida TEXT,
      data_volta TEXT,
      adultos TEXT,
      criancas TEXT,
      possui_flexibilidade TEXT,
      observacao TEXT,
      data_solicitacao TEXT,
      linked_orcamento_id TEXT,
      linked_orcamento_identificador TEXT,
      match_status TEXT,
      match_reason TEXT,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      situacao_nome TEXT,
      situacao_cor TEXT
    );

    CREATE TABLE IF NOT EXISTS vendas_projection (
      id TEXT PRIMARY KEY,
      orcamento_identificador TEXT,
      status TEXT,
      orcamento_id TEXT,
      updated_at TEXT NOT NULL,
      cliente_pessoa_id TEXT,
      orcamento_raw_json TEXT,
      cliente_nome_db TEXT,
      solicitacao_nome TEXT,
      venda_raw_json TEXT NOT NULL
    );
  `);

  ensureColumn("sync_state", "status", "TEXT NOT NULL DEFAULT 'idle'");
  ensureColumn("sync_state", "items_synced", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "items_created", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "related_synced", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "related_created", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "secondary_synced", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "secondary_created", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "details_synced", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "items_skipped", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "queue_pending", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "reconciled_synced", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "next_page", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn("sync_state", "orcamentos_created", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "people_created", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "vendas_created", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "next_orcamento_page", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn("sync_state", "current_stage", "TEXT");
  ensureColumn("sync_state", "current_page", "INTEGER");
  ensureColumn("sync_state", "current_item_id", "TEXT");
  ensureColumn("sync_state", "cancel_requested", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "running_started_at", "TEXT");
  ensureColumn("orcamentos", "situacao_codigo", "TEXT");
  ensureColumn("orcamentos", "situacao_nome", "TEXT");
  ensureColumn("orcamentos", "situacao_cor", "TEXT");
  ensureColumn("orcamentos", "raw_summary_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn("orcamentos", "source_updated_at", "TEXT");
  ensureColumn("orcamentos", "source_hash", "TEXT");
  ensureColumn("orcamentos", "last_seen_at", "TEXT");
  ensureColumn("orcamentos", "detail_synced_at", "TEXT");
  ensureColumn("orcamentos", "needs_detail", "INTEGER NOT NULL DEFAULT 0");
  ensureIndex(
    "idx_orcamentos_situacao_codigo",
    "CREATE INDEX IF NOT EXISTS idx_orcamentos_situacao_codigo ON orcamentos (situacao_codigo)",
  );
  ensureIndex(
    "idx_orcamentos_needs_detail",
    "CREATE INDEX IF NOT EXISTS idx_orcamentos_needs_detail ON orcamentos (needs_detail, last_seen_at)",
  );
  ensureIndex(
    "idx_orcamentos_source_hash",
    "CREATE INDEX IF NOT EXISTS idx_orcamentos_source_hash ON orcamentos (source_hash)",
  );
  ensureIndex(
    "idx_situacoes_codigo",
    "CREATE INDEX IF NOT EXISTS idx_situacoes_codigo ON situacoes (codigo)",
  );
  ensureColumn("solicitacoes", "linked_orcamento_id", "TEXT");
  ensureColumn("solicitacoes", "linked_orcamento_identificador", "TEXT");
  ensureColumn("solicitacoes", "match_status", "TEXT NOT NULL DEFAULT 'unmatched'");
  ensureColumn("solicitacoes", "match_reason", "TEXT");
  ensureColumn("orcamentos", "created_at_source", "TEXT");
  ensureColumn("orcamentos_projection", "match_status", "TEXT");
  ensureColumn("orcamentos_projection", "match_reason", "TEXT");
  ensureColumn("solicitacoes_projection", "match_status", "TEXT");
  ensureColumn("solicitacoes_projection", "match_reason", "TEXT");
  ensureColumn("solicitacoes", "raw_summary_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn("solicitacoes", "source_updated_at", "TEXT");
  ensureColumn("solicitacoes", "source_hash", "TEXT");
  ensureColumn("solicitacoes", "last_seen_at", "TEXT");
  ensureColumn("solicitacoes", "detail_synced_at", "TEXT");
  ensureColumn("solicitacoes", "needs_detail", "INTEGER NOT NULL DEFAULT 0");
  ensureIndex(
    "idx_solicitacoes_linked_orcamento_id",
    "CREATE INDEX IF NOT EXISTS idx_solicitacoes_linked_orcamento_id ON solicitacoes (linked_orcamento_id)",
  );
  ensureIndex(
    "idx_solicitacoes_linked_orcamento_identificador",
    "CREATE INDEX IF NOT EXISTS idx_solicitacoes_linked_orcamento_identificador ON solicitacoes (linked_orcamento_identificador)",
  );
  ensureIndex(
    "idx_solicitacoes_data_solicitacao",
    "CREATE INDEX IF NOT EXISTS idx_solicitacoes_data_solicitacao ON solicitacoes (data_solicitacao)",
  );
  ensureIndex(
    "idx_orcamentos_created_at_source",
    "CREATE INDEX IF NOT EXISTS idx_orcamentos_created_at_source ON orcamentos (created_at_source)",
  );
  ensureIndex(
    "idx_solicitacoes_needs_detail",
    "CREATE INDEX IF NOT EXISTS idx_solicitacoes_needs_detail ON solicitacoes (needs_detail, last_seen_at)",
  );
  ensureIndex(
    "idx_solicitacoes_source_hash",
    "CREATE INDEX IF NOT EXISTS idx_solicitacoes_source_hash ON solicitacoes (source_hash)",
  );
  ensureIndex(
    "idx_sync_tasks_scope_status_type",
    "CREATE INDEX IF NOT EXISTS idx_sync_tasks_scope_status_type ON sync_tasks (scope, status, task_type)",
  );
  ensureIndex(
    "idx_orcamentos_projection_updated_at",
    "CREATE INDEX IF NOT EXISTS idx_orcamentos_projection_updated_at ON orcamentos_projection (updated_at, id)",
  );
  ensureIndex(
    "idx_orcamentos_projection_identificador",
    "CREATE INDEX IF NOT EXISTS idx_orcamentos_projection_identificador ON orcamentos_projection (identificador)",
  );
  ensureIndex(
    "idx_solicitacoes_projection_updated_at",
    "CREATE INDEX IF NOT EXISTS idx_solicitacoes_projection_updated_at ON solicitacoes_projection (updated_at, id)",
  );
  ensureIndex(
    "idx_solicitacoes_projection_linked_orcamento_id",
    "CREATE INDEX IF NOT EXISTS idx_solicitacoes_projection_linked_orcamento_id ON solicitacoes_projection (linked_orcamento_id)",
  );
  ensureIndex(
    "idx_vendas_projection_updated_at",
    "CREATE INDEX IF NOT EXISTS idx_vendas_projection_updated_at ON vendas_projection (updated_at, id)",
  );
  ensureIndex(
    "idx_vendas_projection_orcamento_id",
    "CREATE INDEX IF NOT EXISTS idx_vendas_projection_orcamento_id ON vendas_projection (orcamento_id)",
  );

  db.exec(`
    UPDATE orcamentos
    SET created_at_source = COALESCE(
      created_at_source,
      NULLIF(json_extract(raw_json, '$.created_at'), ''),
      NULLIF(json_extract(raw_summary_json, '$.created_at'), ''),
      NULLIF(json_extract(raw_json, '$.data_orcamento'), ''),
      NULLIF(json_extract(raw_summary_json, '$.data_orcamento'), '')
    )
    WHERE created_at_source IS NULL;

    UPDATE solicitacoes
    SET match_status = COALESCE(match_status, 'unmatched')
    WHERE match_status IS NULL;
  `);

  for (const scope of ["orcamentos", "solicitacoes", "pessoas", "vendas"]) {
    db.prepare(
      `
        INSERT INTO sync_state (
          scope,
          last_synced_at,
          items_synced,
          items_created,
          related_synced,
          related_created,
          secondary_synced,
          secondary_created,
          details_synced,
          items_skipped,
          queue_pending,
          reconciled_synced,
          next_page,
          orcamentos_synced,
          people_synced,
          vendas_synced,
          orcamentos_created,
          people_created,
          vendas_created,
          next_orcamento_page,
          status,
          current_stage,
          current_page,
          current_item_id,
          cancel_requested,
          running_started_at,
          error
        )
        VALUES (@scope, NULL, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 'idle', NULL, NULL, NULL, 0, NULL, NULL)
        ON CONFLICT(scope) DO NOTHING
      `,
    ).run({ scope });
  }

  refreshProjectionTables();
}

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;

  if (!columns.some((entry) => entry.name === column)) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao alterar tabela.";

      if (!message.includes("duplicate column name")) {
        throw error;
      }
    }
  }
}

function ensureIndex(_name: string, sql: string) {
  db.exec(sql);
}

function refreshProjectionTables() {
  refreshOrcamentosProjectionByIds(readAllIds("orcamentos"));
  refreshSolicitacoesProjectionByIds(readAllIds("solicitacoes"));
  refreshVendasProjectionByIds(readAllIds("vendas"));
}

export function refreshOrcamentosProjectionByIds(ids: string[]) {
  replaceProjectionRows({
    deleteSql: "DELETE FROM orcamentos_projection WHERE id IN",
    ids,
    insertSql: `
      INSERT INTO orcamentos_projection (
        id,
        identificador,
        cliente_pessoa_id,
        situacao_codigo,
        situacao_nome,
        situacao_cor,
        match_status,
        match_reason,
        situacao_ordem,
        passageiro_count,
        raw_json,
        updated_at,
        cliente_nome_db,
        solicitacao_nome
      )
      SELECT
        o.id,
        o.identificador,
        o.cliente_pessoa_id,
        o.situacao_codigo,
        COALESCE(s.nome, o.situacao_nome),
        COALESCE(s.cor, o.situacao_cor),
        sl_match.match_status,
        sl_match.match_reason,
        COALESCE(s.ordem, ''),
        o.passageiro_count,
        o.raw_json,
        o.updated_at,
        COALESCE(
          p.nome,
          (
            SELECT sl.nome
            FROM solicitacoes sl
            WHERE sl.linked_orcamento_id = o.id
            ORDER BY datetime(sl.updated_at) DESC, sl.id DESC
            LIMIT 1
          )
        ),
        sl_match.nome
      FROM orcamentos o
      LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
      LEFT JOIN situacoes s ON s.codigo = o.situacao_codigo
      LEFT JOIN solicitacoes sl_match ON sl_match.id = (
        SELECT sl.id
        FROM solicitacoes sl
        WHERE sl.linked_orcamento_id = o.id
        ORDER BY datetime(sl.updated_at) DESC, sl.id DESC
        LIMIT 1
      )
      WHERE o.id IN
    `,
  });
}

export function refreshOrcamentosProjectionByPessoaIds(personIds: string[]) {
  refreshOrcamentosProjectionByIds(readIdsByQuery(
    `
      SELECT id
      FROM orcamentos
      WHERE cliente_pessoa_id IN
    `,
    personIds,
  ));
}

export function refreshOrcamentosProjectionBySolicitacaoIds(solicitacaoIds: string[]) {
  refreshOrcamentosProjectionByIds(readIdsByQuery(
    `
      SELECT DISTINCT linked_orcamento_id AS id
      FROM solicitacoes
      WHERE linked_orcamento_id IS NOT NULL
        AND id IN
    `,
    solicitacaoIds,
  ));
}

export function refreshSolicitacoesProjectionByIds(ids: string[]) {
  replaceProjectionRows({
    deleteSql: "DELETE FROM solicitacoes_projection WHERE id IN",
    ids,
    insertSql: `
      INSERT INTO solicitacoes_projection (
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
        match_status,
        match_reason,
        raw_json,
        updated_at,
        situacao_nome,
        situacao_cor
      )
      SELECT
        sl.id,
        sl.nome,
        sl.email,
        sl.telefone,
        sl.origem,
        sl.destino,
        sl.data_ida,
        sl.data_volta,
        sl.adultos,
        sl.criancas,
        sl.possui_flexibilidade,
        sl.observacao,
        sl.data_solicitacao,
        sl.linked_orcamento_id,
        COALESCE(sl.linked_orcamento_identificador, o.identificador),
        sl.match_status,
        sl.match_reason,
        sl.raw_json,
        sl.updated_at,
        COALESCE(s.nome, o.situacao_nome),
        COALESCE(s.cor, o.situacao_cor)
      FROM solicitacoes sl
      LEFT JOIN orcamentos o ON o.id = sl.linked_orcamento_id
      LEFT JOIN situacoes s ON s.codigo = o.situacao_codigo
      WHERE sl.id IN
    `,
  });
}

export function refreshSolicitacoesProjectionByOrcamentoIds(orcamentoIds: string[]) {
  refreshSolicitacoesProjectionByIds(readIdsByQuery(
    `
      SELECT id
      FROM solicitacoes
      WHERE linked_orcamento_id IN
    `,
    orcamentoIds,
  ));
}

export function refreshVendasProjectionByIds(ids: string[]) {
  replaceProjectionRows({
    deleteSql: "DELETE FROM vendas_projection WHERE id IN",
    ids,
    insertSql: `
      INSERT INTO vendas_projection (
        id,
        orcamento_identificador,
        status,
        orcamento_id,
        updated_at,
        cliente_pessoa_id,
        orcamento_raw_json,
        cliente_nome_db,
        solicitacao_nome,
        venda_raw_json
      )
      SELECT
        v.id,
        v.orcamento_identificador,
        v.status,
        v.orcamento_id,
        v.updated_at,
        o.cliente_pessoa_id,
        o.raw_json,
        COALESCE(
          p.nome,
          (
            SELECT sl.nome
            FROM solicitacoes sl
            WHERE sl.linked_orcamento_id = o.id
            ORDER BY datetime(sl.updated_at) DESC, sl.id DESC
            LIMIT 1
          )
        ),
        (
          SELECT sl.nome
          FROM solicitacoes sl
          WHERE sl.linked_orcamento_id = o.id
          ORDER BY datetime(sl.updated_at) DESC, sl.id DESC
          LIMIT 1
        ),
        v.raw_json
      FROM vendas v
      LEFT JOIN orcamentos o ON o.id = v.orcamento_id
      LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
      WHERE v.id IN
    `,
  });
}

export function refreshVendasProjectionByOrcamentoIds(orcamentoIds: string[]) {
  refreshVendasProjectionByIds(readIdsByQuery(
    `
      SELECT id
      FROM vendas
      WHERE orcamento_id IN
    `,
    orcamentoIds,
  ));
}

export function refreshVendasProjectionByPessoaIds(personIds: string[]) {
  refreshVendasProjectionByIds(readIdsByQuery(
    `
      SELECT v.id
      FROM vendas v
      JOIN orcamentos o ON o.id = v.orcamento_id
      WHERE o.cliente_pessoa_id IN
    `,
    personIds,
  ));
}

export function refreshVendasProjectionBySolicitacaoIds(solicitacaoIds: string[]) {
  const orcamentoIds = readIdsByQuery(
    `
      SELECT DISTINCT linked_orcamento_id AS id
      FROM solicitacoes
      WHERE linked_orcamento_id IS NOT NULL
        AND id IN
    `,
    solicitacaoIds,
  );

  refreshVendasProjectionByOrcamentoIds(orcamentoIds);
}

function replaceProjectionRows(input: {
  deleteSql: string;
  ids: string[];
  insertSql: string;
}) {
  if (input.ids.length === 0) {
    return;
  }

  const placeholders = `(${input.ids.map(() => "?").join(",")})`;

  db.transaction(() => {
    db.prepare(`${input.deleteSql} ${placeholders}`).run(...input.ids);
    db.prepare(`${input.insertSql} ${placeholders}`).run(...input.ids);
  })();
}

function readAllIds(table: "orcamentos" | "solicitacoes" | "vendas") {
  return (db.prepare(`SELECT id FROM ${table}`).all() as Array<{ id: string }>).map(
    (row) => row.id,
  );
}

function readIdsByQuery(sqlPrefix: string, ids: string[]) {
  if (ids.length === 0) {
    return [] as string[];
  }

  const placeholders = `(${ids.map(() => "?").join(",")})`;
  return (db.prepare(`${sqlPrefix} ${placeholders}`).all(...ids) as Array<{ id: string | null }>)
    .map((row) => row.id)
    .filter((value): value is string => Boolean(value));
}

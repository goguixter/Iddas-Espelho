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

    CREATE TABLE IF NOT EXISTS sync_state (
      scope TEXT PRIMARY KEY,
      last_synced_at TEXT,
      items_synced INTEGER NOT NULL DEFAULT 0,
      items_created INTEGER NOT NULL DEFAULT 0,
      related_synced INTEGER NOT NULL DEFAULT 0,
      related_created INTEGER NOT NULL DEFAULT 0,
      secondary_synced INTEGER NOT NULL DEFAULT 0,
      secondary_created INTEGER NOT NULL DEFAULT 0,
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
  `);

  ensureColumn("sync_state", "status", "TEXT NOT NULL DEFAULT 'idle'");
  ensureColumn("sync_state", "items_synced", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "items_created", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "related_synced", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "related_created", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "secondary_synced", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "secondary_created", "INTEGER NOT NULL DEFAULT 0");
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

  for (const scope of ["global", "orcamentos", "solicitacoes"]) {
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
        VALUES (@scope, NULL, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 'idle', NULL, NULL, NULL, 0, NULL, NULL)
        ON CONFLICT(scope) DO NOTHING
      `,
    ).run({ scope });
  }
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

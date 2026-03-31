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
      raw_json TEXT NOT NULL,
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
      raw_json TEXT NOT NULL,
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
  ensureIndex(
    "idx_orcamentos_situacao_codigo",
    "CREATE INDEX IF NOT EXISTS idx_orcamentos_situacao_codigo ON orcamentos (situacao_codigo)",
  );
  ensureIndex(
    "idx_situacoes_codigo",
    "CREATE INDEX IF NOT EXISTS idx_situacoes_codigo ON situacoes (codigo)",
  );
  ensureColumn("solicitacoes", "linked_orcamento_id", "TEXT");
  ensureColumn("solicitacoes", "linked_orcamento_identificador", "TEXT");
  ensureIndex(
    "idx_solicitacoes_linked_orcamento_id",
    "CREATE INDEX IF NOT EXISTS idx_solicitacoes_linked_orcamento_id ON solicitacoes (linked_orcamento_id)",
  );
  ensureIndex(
    "idx_solicitacoes_linked_orcamento_identificador",
    "CREATE INDEX IF NOT EXISTS idx_solicitacoes_linked_orcamento_identificador ON solicitacoes (linked_orcamento_identificador)",
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

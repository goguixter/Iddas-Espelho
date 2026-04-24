import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "iddas-mirror.sqlite");
const pendingImportPath = path.join(dataDir, "iddas-mirror.import.sqlite");
const tempImportPath = path.join(dataDir, "iddas-mirror.import.uploading.sqlite");

export function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function getDbPath() {
  return dbPath;
}

export function getPendingImportPath() {
  return pendingImportPath;
}

export function getDatabaseImportStatus() {
  ensureDataDir();

  const currentExists = fs.existsSync(dbPath);
  const pendingExists = fs.existsSync(pendingImportPath);

  return {
    currentExists,
    currentSizeBytes: currentExists ? fs.statSync(dbPath).size : 0,
    pendingExists,
    pendingSizeBytes: pendingExists ? fs.statSync(pendingImportPath).size : 0,
  };
}

export function stageDatabaseImport(buffer: Buffer) {
  ensureDataDir();

  validateSqliteBuffer(buffer);
  fs.writeFileSync(tempImportPath, buffer);

  try {
    validateSqliteFile(tempImportPath);
    fs.renameSync(tempImportPath, pendingImportPath);
  } catch (error) {
    fs.rmSync(tempImportPath, { force: true });
    throw error;
  }

  return getDatabaseImportStatus();
}

export function promotePendingDatabaseImport() {
  ensureDataDir();

  if (!fs.existsSync(pendingImportPath)) {
    return;
  }

  removeWalArtifacts(dbPath);

  if (fs.existsSync(dbPath)) {
    const backupPath = path.join(
      dataDir,
      `iddas-mirror.before-import-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
    );
    fs.renameSync(dbPath, backupPath);
  }

  fs.renameSync(pendingImportPath, dbPath);
}

function validateSqliteBuffer(buffer: Buffer) {
  const signature = buffer.subarray(0, 16).toString("utf8");
  if (signature !== "SQLite format 3\u0000") {
    throw new Error("O arquivo enviado não é um banco SQLite válido.");
  }
}

function validateSqliteFile(filePath: string) {
  const database = new Database(filePath, {
    fileMustExist: true,
    readonly: true,
  });

  try {
    database.prepare("SELECT name FROM sqlite_master LIMIT 1").get();
  } finally {
    database.close();
  }
}

function removeWalArtifacts(filePath: string) {
  fs.rmSync(`${filePath}-shm`, { force: true });
  fs.rmSync(`${filePath}-wal`, { force: true });
}

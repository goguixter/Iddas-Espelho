import {
  db,
  refreshOrcamentosProjectionByIds,
  refreshOrcamentosProjectionByPessoaIds,
  refreshOrcamentosProjectionBySolicitacaoIds,
  refreshSolicitacoesProjectionByIds,
  refreshSolicitacoesProjectionByOrcamentoIds,
  refreshVendasProjectionByIds,
  refreshVendasProjectionByOrcamentoIds,
  refreshVendasProjectionByPessoaIds,
  refreshVendasProjectionBySolicitacaoIds,
  refreshVoosProjectionByIds,
  refreshVoosProjectionByOrcamentoIds,
} from "@/lib/db";
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
  extractReferencedPeople,
  getSyncErrorMessage,
  isApprovedOrcamento,
  isSyncCancelledError,
  parseTaskPayload,
  readPendingIds,
  shouldRefreshDetail,
  shouldRefreshPessoa as shouldRefreshPessoaSnapshot,
  type MirrorStateRow,
  type PessoaReference,
  type SyncTaskRow,
  type SyncTaskType,
} from "@/lib/iddas/mirror-helpers";
import {
  normalizeOrcamento,
  normalizeOrcamentoSummary,
  normalizeCompanhia,
  normalizePessoa,
  normalizePessoaSummary,
  normalizeSolicitacao,
  normalizeSolicitacaoSummary,
  normalizeSituacao,
  normalizeVenda,
  normalizeVoo,
} from "@/lib/iddas/normalizers";
import { logSync } from "@/lib/sync/logger";
import {
  getSyncStateRecord,
  resetSyncStateRecord,
  updateSyncStateRecord,
} from "@/lib/sync/store";
import type { SyncScope } from "@/lib/sync/types";

const upsertOrcamentoSummary = db.prepare(`
  INSERT INTO orcamentos (
    id,
    identificador,
    created_at_source,
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
    @created_at_source,
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
    created_at_source = COALESCE(excluded.created_at_source, orcamentos.created_at_source),
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
    created_at_source,
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
    @created_at_source,
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
    created_at_source = excluded.created_at_source,
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

const upsertPessoaSummary = db.prepare(`
  INSERT INTO pessoas (
    id,
    nome,
    email,
    cpf,
    celular,
    nascimento,
    sexo,
    rg,
    passaporte,
    tipo_cliente,
    tipo_passageiro,
    tipo_fornecedor,
    tipo_representante,
    endereco,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    cep,
    pais_endereco,
    created_at_source,
    source_updated_at,
    source_hash,
    last_seen_at,
    detail_synced_at,
    needs_detail,
    raw_json,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @nome,
    @email,
    @cpf,
    @celular,
    @nascimento,
    @sexo,
    @rg,
    @passaporte,
    @tipo_cliente,
    @tipo_passageiro,
    @tipo_fornecedor,
    @tipo_representante,
    @endereco,
    @numero,
    @complemento,
    @bairro,
    @cidade,
    @estado,
    @cep,
    @pais_endereco,
    @created_at_source,
    @source_updated_at,
    @source_hash,
    @last_seen_at,
    NULL,
    @needs_detail,
    @raw_json,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    nome = COALESCE(excluded.nome, pessoas.nome),
    email = COALESCE(excluded.email, pessoas.email),
    cpf = COALESCE(excluded.cpf, pessoas.cpf),
    celular = COALESCE(excluded.celular, pessoas.celular),
    nascimento = COALESCE(excluded.nascimento, pessoas.nascimento),
    sexo = COALESCE(excluded.sexo, pessoas.sexo),
    rg = COALESCE(excluded.rg, pessoas.rg),
    passaporte = COALESCE(excluded.passaporte, pessoas.passaporte),
    tipo_cliente = COALESCE(excluded.tipo_cliente, pessoas.tipo_cliente),
    tipo_passageiro = COALESCE(excluded.tipo_passageiro, pessoas.tipo_passageiro),
    tipo_fornecedor = COALESCE(excluded.tipo_fornecedor, pessoas.tipo_fornecedor),
    tipo_representante = COALESCE(excluded.tipo_representante, pessoas.tipo_representante),
    endereco = COALESCE(excluded.endereco, pessoas.endereco),
    numero = COALESCE(excluded.numero, pessoas.numero),
    complemento = COALESCE(excluded.complemento, pessoas.complemento),
    bairro = COALESCE(excluded.bairro, pessoas.bairro),
    cidade = COALESCE(excluded.cidade, pessoas.cidade),
    estado = COALESCE(excluded.estado, pessoas.estado),
    cep = COALESCE(excluded.cep, pessoas.cep),
    pais_endereco = COALESCE(excluded.pais_endereco, pessoas.pais_endereco),
    created_at_source = COALESCE(excluded.created_at_source, pessoas.created_at_source),
    source_updated_at = excluded.source_updated_at,
    source_hash = excluded.source_hash,
    last_seen_at = excluded.last_seen_at,
    needs_detail = excluded.needs_detail,
    raw_json = CASE
      WHEN pessoas.detail_synced_at IS NULL THEN excluded.raw_json
      ELSE pessoas.raw_json
    END,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const upsertPessoa = db.prepare(`
  INSERT INTO pessoas (
    id,
    nome,
    email,
    cpf,
    celular,
    nascimento,
    sexo,
    rg,
    passaporte,
    tipo_cliente,
    tipo_passageiro,
    tipo_fornecedor,
    tipo_representante,
    endereco,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    cep,
    pais_endereco,
    created_at_source,
    source_updated_at,
    source_hash,
    last_seen_at,
    detail_synced_at,
    needs_detail,
    raw_json,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @nome,
    @email,
    @cpf,
    @celular,
    @nascimento,
    @sexo,
    @rg,
    @passaporte,
    @tipo_cliente,
    @tipo_passageiro,
    @tipo_fornecedor,
    @tipo_representante,
    @endereco,
    @numero,
    @complemento,
    @bairro,
    @cidade,
    @estado,
    @cep,
    @pais_endereco,
    @created_at_source,
    @source_updated_at,
    @source_hash,
    @last_seen_at,
    @detail_synced_at,
    0,
    @raw_json,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    nome = excluded.nome,
    email = excluded.email,
    cpf = excluded.cpf,
    celular = excluded.celular,
    nascimento = excluded.nascimento,
    sexo = excluded.sexo,
    rg = excluded.rg,
    passaporte = excluded.passaporte,
    tipo_cliente = excluded.tipo_cliente,
    tipo_passageiro = excluded.tipo_passageiro,
    tipo_fornecedor = excluded.tipo_fornecedor,
    tipo_representante = excluded.tipo_representante,
    endereco = excluded.endereco,
    numero = excluded.numero,
    complemento = excluded.complemento,
    bairro = excluded.bairro,
    cidade = excluded.cidade,
    estado = excluded.estado,
    cep = excluded.cep,
    pais_endereco = excluded.pais_endereco,
    created_at_source = COALESCE(pessoas.created_at_source, excluded.created_at_source),
    source_updated_at = COALESCE(pessoas.source_updated_at, excluded.source_updated_at),
    source_hash = COALESCE(pessoas.source_hash, excluded.source_hash),
    last_seen_at = COALESCE(pessoas.last_seen_at, excluded.last_seen_at),
    detail_synced_at = excluded.detail_synced_at,
    needs_detail = 0,
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

const upsertCompanhia = db.prepare(`
  INSERT INTO companhias (
    id,
    iata,
    companhia,
    nome,
    raw_json,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @iata,
    @companhia,
    @nome,
    @raw_json,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    iata = excluded.iata,
    companhia = excluded.companhia,
    nome = excluded.nome,
    raw_json = excluded.raw_json,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const upsertVoo = db.prepare(`
  INSERT INTO voos (
    id,
    orcamento_id,
    orcamento_identificador,
    titulo_orcamento,
    tipo_trecho,
    voo,
    companhia_id,
    companhia_nome,
    classe,
    aeroporto_origem,
    aeroporto_destino,
    data_embarque,
    hora_embarque,
    data_chegada,
    hora_chegada,
    duracao,
    localizador,
    numero_compra,
    observacao,
    cliente_pessoa_id,
    qtd_paradas,
    bagagem_bolsa,
    bagagem_demao,
    bagagem_despachada,
    raw_json,
    updated_at,
    synced_at
  )
  VALUES (
    @id,
    @orcamento_id,
    @orcamento_identificador,
    @titulo_orcamento,
    @tipo_trecho,
    @voo,
    @companhia_id,
    @companhia_nome,
    @classe,
    @aeroporto_origem,
    @aeroporto_destino,
    @data_embarque,
    @hora_embarque,
    @data_chegada,
    @hora_chegada,
    @duracao,
    @localizador,
    @numero_compra,
    @observacao,
    @cliente_pessoa_id,
    @qtd_paradas,
    @bagagem_bolsa,
    @bagagem_demao,
    @bagagem_despachada,
    @raw_json,
    @updated_at,
    @synced_at
  )
  ON CONFLICT(id) DO UPDATE SET
    orcamento_id = excluded.orcamento_id,
    orcamento_identificador = excluded.orcamento_identificador,
    titulo_orcamento = excluded.titulo_orcamento,
    tipo_trecho = excluded.tipo_trecho,
    voo = excluded.voo,
    companhia_id = excluded.companhia_id,
    companhia_nome = excluded.companhia_nome,
    classe = excluded.classe,
    aeroporto_origem = excluded.aeroporto_origem,
    aeroporto_destino = excluded.aeroporto_destino,
    data_embarque = excluded.data_embarque,
    hora_embarque = excluded.hora_embarque,
    data_chegada = excluded.data_chegada,
    hora_chegada = excluded.hora_chegada,
    duracao = excluded.duracao,
    localizador = excluded.localizador,
    numero_compra = excluded.numero_compra,
    observacao = excluded.observacao,
    cliente_pessoa_id = excluded.cliente_pessoa_id,
    qtd_paradas = excluded.qtd_paradas,
    bagagem_bolsa = excluded.bagagem_bolsa,
    bagagem_demao = excluded.bagagem_demao,
    bagagem_despachada = excluded.bagagem_despachada,
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
    match_status,
    match_reason,
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
    @match_status,
    @match_reason,
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
    match_status = COALESCE(solicitacoes.match_status, excluded.match_status),
    match_reason = COALESCE(solicitacoes.match_reason, excluded.match_reason),
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
    match_status,
    match_reason,
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
    @match_status,
    @match_reason,
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
    match_status = COALESCE(solicitacoes.match_status, excluded.match_status),
    match_reason = COALESCE(solicitacoes.match_reason, excluded.match_reason),
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
const getPessoaSnapshot = db.prepare(`
  SELECT id, nome, email, cpf, celular, nascimento, tipo_cliente, tipo_passageiro, tipo_fornecedor, tipo_representante
  FROM pessoas
  WHERE id = ?
  LIMIT 1
`);

const getPessoaMirrorState = db.prepare(`
  SELECT id, source_hash, source_updated_at, detail_synced_at
  FROM pessoas
  WHERE id = ?
`);

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

const listPendingPessoaIds = db.prepare(`
  SELECT id
  FROM pessoas
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

const countPendingSyncTasks = db.prepare(`
  SELECT COUNT(*) AS total
  FROM sync_tasks
  WHERE scope = ? AND status = 'pending'
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

const deleteSyncTasksByScope = db.prepare(`
  DELETE FROM sync_tasks
  WHERE scope = ?
`);

const deleteSyncTaskByKey = db.prepare(`
  DELETE FROM sync_tasks
  WHERE task_key = ?
`);

const resetOrcamentoNeedsDetail = db.prepare(`
  UPDATE orcamentos
  SET needs_detail = 0
`);

const resetSolicitacaoNeedsDetail = db.prepare(`
  UPDATE solicitacoes
  SET needs_detail = 0
`);

const resetPessoaNeedsDetail = db.prepare(`
  UPDATE pessoas
  SET needs_detail = 0
`);

const reconcileSolicitacoesByCreatedAtWindow = db.prepare(`
  UPDATE solicitacoes
  SET
    linked_orcamento_id = (
      SELECT o.id
      FROM orcamentos o
      WHERE ABS(unixepoch(o.created_at_source) - unixepoch(data_solicitacao)) <= 5
      LIMIT 1
    ),
    linked_orcamento_identificador = (
      SELECT o.identificador
      FROM orcamentos o
      WHERE ABS(unixepoch(o.created_at_source) - unixepoch(data_solicitacao)) <= 5
      LIMIT 1
    ),
    match_status = 'confirmed',
    match_reason = 'created_at_5s'
  WHERE data_solicitacao IS NOT NULL
    AND (
      linked_orcamento_id IS NULL
      OR TRIM(COALESCE(linked_orcamento_id, '')) = ''
    )
    AND (
      SELECT COUNT(*)
      FROM orcamentos o
      WHERE ABS(unixepoch(o.created_at_source) - unixepoch(data_solicitacao)) <= 5
    ) = 1
`);

const flagSolicitacoesCreatedAtConflict = db.prepare(`
  UPDATE solicitacoes
  SET
    match_status = 'manual_review',
    match_reason = 'created_at_conflict'
  WHERE data_solicitacao IS NOT NULL
    AND (
      linked_orcamento_id IS NULL
      OR TRIM(COALESCE(linked_orcamento_id, '')) = ''
    )
    AND (
      SELECT COUNT(*)
      FROM orcamentos o
      WHERE ABS(unixepoch(o.created_at_source) - unixepoch(data_solicitacao)) <= 5
    ) > 1
`);

const flagSolicitacoesCreatedAtMismatch = db.prepare(`
  UPDATE solicitacoes
  SET
    match_status = 'manual_review',
    match_reason = 'created_at_mismatch'
  WHERE data_solicitacao IS NOT NULL
    AND linked_orcamento_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM orcamentos o
      WHERE ABS(unixepoch(o.created_at_source) - unixepoch(data_solicitacao)) <= 5
    )
    AND (
      SELECT COUNT(*)
      FROM orcamentos o
      WHERE ABS(unixepoch(o.created_at_source) - unixepoch(data_solicitacao)) <= 5
    ) = 1
    AND linked_orcamento_id <> (
      SELECT o.id
      FROM orcamentos o
      WHERE ABS(unixepoch(o.created_at_source) - unixepoch(data_solicitacao)) <= 5
      LIMIT 1
    )
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

const markLinkedSolicitacoesConfirmed = db.prepare(`
  UPDATE solicitacoes
  SET
    match_status = 'confirmed',
    match_reason = CASE
      WHEN match_reason = 'created_at_5s' THEN 'created_at_5s'
      ELSE 'linked'
    END
  WHERE linked_orcamento_id IS NOT NULL
    AND match_status <> 'manual_review'
`);

const markUnmatchedSolicitacoes = db.prepare(`
  UPDATE solicitacoes
  SET
    match_status = 'unmatched',
    match_reason = NULL
  WHERE (
      linked_orcamento_id IS NULL
      OR TRIM(COALESCE(linked_orcamento_id, '')) = ''
    )
    AND match_status <> 'manual_review'
`);

type SyncResult = {
  last_synced_at: string;
  ok: true;
  orcamentos_synced: number;
  people_synced: number;
  vendas_synced: number;
};

let activeOrcamentosSync: Promise<SyncResult> | null = null;
let activeSolicitacoesSync: Promise<SyncResult> | null = null;
let activePessoasSync: Promise<SyncResult> | null = null;
let activeVendasSync: Promise<SyncResult> | null = null;

export async function syncIddasScope(
  scope: Extract<SyncScope, "orcamentos" | "solicitacoes" | "pessoas" | "vendas">,
  input?: {
    periodo_cotacao_final?: string;
    periodo_cotacao_inicio?: string;
  },
) {
  switch (scope) {
    case "solicitacoes":
      return syncSolicitacoesMirror();
    case "pessoas":
      return syncPessoasMirror();
    case "vendas":
      return syncVendasMirror();
    default:
      return syncIddasMirror(input);
  }
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

export async function syncPessoasMirror() {
  if (activePessoasSync) {
    logSync("info", "sync.pessoas.reuse-active-job");
    return activePessoasSync;
  }

  logSync("info", "sync.pessoas.start-request");
  activePessoasSync = runPessoasSync();

  try {
    return await activePessoasSync;
  } finally {
    activePessoasSync = null;
  }
}

export async function syncVendasMirror() {
  if (activeVendasSync) {
    logSync("info", "sync.vendas.reuse-active-job");
    return activeVendasSync;
  }

  logSync("info", "sync.vendas.start-request");
  activeVendasSync = runVendasSync();

  try {
    return await activeVendasSync;
  } finally {
    activeVendasSync = null;
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
  let orcamentosCreated = 0;
  let orcamentosCollected = 0;
  let orcamentosDetailed = 0;
  let orcamentosSkipped = 0;
  let queuedOrcamentos = 0;
  let reconciledCount = 0;
  const touchedOrcamentoIds = new Set<string>();
  const touchedVooIds = new Set<string>();
  let voosSynced = 0;
  let companhiasSynced = 0;

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

    updateSyncStateRecord(scope, {
      current_stage: "Sincronizando companhias aéreas",
      current_page: 1,
    });

    for (let companhiaPage = 1; companhiaPage <= env.IDDAS_SYNC_MAX_PAGES; companhiaPage += 1) {
      throwIfCancelRequested(scope);

      const companhias = await fetchIddasList("companhia", companhiaPage, 100);
      logSync("info", "sync.companhias.page", { page: companhiaPage, returned: companhias.length });

      if (companhias.length === 0) {
        break;
      }

      for (const companhia of companhias) {
        upsertCompanhia.run(normalizeCompanhia(companhia, now));
        companhiasSynced += 1;
      }

      if (companhias.length < 100) {
        break;
      }
    }

    updateSyncStateRecord(scope, {
      current_stage: "Sincronizando voos",
      current_page: 1,
      secondary_created: 0,
      secondary_synced: companhiasSynced,
    });

    for (let vooPage = 1; vooPage <= env.IDDAS_SYNC_MAX_PAGES; vooPage += 1) {
      throwIfCancelRequested(scope);

      const voos = await fetchIddasList("voo", vooPage, env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE);
      logSync("info", "sync.voos.page", { page: vooPage, returned: voos.length });

      if (voos.length === 0) {
        break;
      }

      for (const voo of voos) {
        const normalized = normalizeVoo(voo, now);
        upsertVoo.run(normalized);
        voosSynced += 1;
        touchedVooIds.add(normalized.id);
        touchedOrcamentoIds.add(normalized.orcamento_id);
      }

      updateSyncStateRecord(scope, {
        current_page: vooPage,
        related_created: 0,
        related_synced: voosSynced,
      });

      if (voos.length < env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE) {
        break;
      }
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
        } else {
          orcamentosSkipped += 1;
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
        details_synced: orcamentosDetailed,
        items_created: orcamentosCreated,
        items_skipped: orcamentosSkipped,
        items_synced: orcamentosCollected,
        orcamentos_created: orcamentosCreated,
        orcamentos_synced: orcamentosCollected,
        queue_pending: countPendingTasks(scope),
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
      orcamentosDetailed += 1;
      touchedOrcamentoIds.add(normalized.id);

      logSync("info", "sync.orcamento.detailed", {
        cliente_pessoa_id: normalized.cliente_pessoa_id,
        id: normalized.id,
        identificador: normalized.identificador,
        passageiros: normalized.passageiro_count,
      });

      for (const personRef of extractReferencedPeople(detail, normalized)) {
        if (!shouldRefreshPessoa(personRef)) {
          continue;
        }

        enqueueDerivedTask("pessoas", "pessoa", personRef.id, normalized.id, {
          personId: personRef.id,
        });
      }

      if (normalized.identificador && isApprovedOrcamento(normalized)) {
        enqueueDerivedTask("vendas", "venda_orcamento", normalized.id, normalized.id, {
          identificador: normalized.identificador,
          orcamentoId: normalized.id,
        });
      } else {
        deleteSyncTaskByKey.run(`venda_orcamento:${normalized.id}`);
      }

      updateSyncStateRecord(scope, {
        details_synced: orcamentosDetailed,
        queue_pending: countPendingTasks(scope),
      });
    }

    updateSyncStateRecord(scope, {
      current_item_id: null,
      current_page: null,
      current_stage: "Reconciliação local de vínculos",
    });

    const reconciliation = runLocalReconciliation();
    reconciledCount =
      reconciliation.linkedByCreatedAt +
      reconciliation.linkedById +
      reconciliation.linkedByIdentificador +
      reconciliation.conflictsByCreatedAt +
      reconciliation.mismatchesByCreatedAt +
      reconciliation.confirmedLinked +
      reconciliation.unmatched;
    logSync("info", "sync.reconciliation.completed", {
      confirmed_linked: reconciliation.confirmedLinked,
      conflicts_by_created_at: reconciliation.conflictsByCreatedAt,
      linked_by_created_at: reconciliation.linkedByCreatedAt,
      linked_by_id: reconciliation.linkedById,
      linked_by_identificador: reconciliation.linkedByIdentificador,
      mismatches_by_created_at: reconciliation.mismatchesByCreatedAt,
      scope,
      unmatched: reconciliation.unmatched,
    });

    const touchedIds = [...touchedOrcamentoIds];
    refreshOrcamentosProjectionByIds(touchedIds);
    refreshSolicitacoesProjectionByOrcamentoIds(touchedIds);
    refreshVendasProjectionByOrcamentoIds(touchedIds);
    refreshVoosProjectionByIds([...touchedVooIds]);
    refreshVoosProjectionByOrcamentoIds(touchedIds);

    completeScopeState(scope, {
      error: null,
      itemsCreated: orcamentosCreated,
      itemsSynced: orcamentosCollected,
      itemsSkipped: orcamentosSkipped,
      detailsSynced: orcamentosDetailed,
      now,
      peopleCreated: 0,
      peopleSynced: 0,
      queuePending: readPendingIds(listPendingOrcamentoIds).length,
      reconciledSynced: reconciledCount,
      relatedCreated: 0,
      relatedSynced: voosSynced,
      secondaryCreated: 0,
      secondarySynced: companhiasSynced,
      vendasCreated: 0,
      vendasSynced: 0,
    });

    logSync("info", "sync.completed", {
      last_synced_at: now,
      orcamentos_collected: orcamentosCollected,
      orcamentos_created: orcamentosCreated,
      orcamentos_detailed: orcamentosDetailed,
      orcamentos_skipped: orcamentosSkipped,
      voos_synced: voosSynced,
      companhias_synced: companhiasSynced,
      reconciled: reconciledCount,
    });

    return {
      ok: true,
      last_synced_at: now,
      orcamentos_synced: orcamentosCollected,
      people_synced: 0,
      vendas_synced: 0,
    };
  } catch (error) {
    finishScopeWithError(scope, {
      error,
      itemsCreated: orcamentosCreated,
      itemsSynced: orcamentosCollected,
      itemsSkipped: orcamentosSkipped,
      detailsSynced: orcamentosDetailed,
      peopleCreated: 0,
      peopleSynced: 0,
      queuePending: readPendingIds(listPendingOrcamentoIds).length,
      reconciledSynced: reconciledCount,
      relatedCreated: 0,
      relatedSynced: voosSynced,
      secondaryCreated: 0,
      secondarySynced: companhiasSynced,
      vendasCreated: 0,
      vendasSynced: 0,
    });
    throw error;
  }
}

async function runSolicitacoesSync(): Promise<SyncResult> {
  const scope: SyncScope = "solicitacoes";
  const initialState = getSyncStateRecord(scope);
  const startSolicitacaoPage = Math.max(1, initialState.next_page);
  const now = new Date().toISOString();
  let itemsCreated = 0;
  let itemsCollected = 0;
  let itemsDetailed = 0;
  let itemsSkipped = 0;
  let queuedSolicitacoes = 0;
  let reconciledCount = 0;
  const touchedSolicitacaoIds = new Set<string>();

  try {
    resetScopeState(scope, now, startSolicitacaoPage, "Coletando solicitações");

    for (
      let solicitacaoPage = startSolicitacaoPage;
      solicitacaoPage < startSolicitacaoPage + env.IDDAS_SYNC_MAX_PAGES;
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
        } else {
          itemsSkipped += 1;
        }
        itemsCollected += 1;

        logSync("info", "sync.solicitacao.collected", {
          id: normalized.id,
          new_record: isNew ? 1 : 0,
          needs_detail: needsDetail ? 1 : 0,
        });
      }

      updateSyncStateRecord(scope, {
        details_synced: itemsDetailed,
        items_created: itemsCreated,
        items_skipped: itemsSkipped,
        items_synced: itemsCollected,
        queue_pending: readPendingIds(listPendingSolicitacaoIds).length,
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
      itemsDetailed += 1;
      touchedSolicitacaoIds.add(solicitacaoId);

      logSync("info", "sync.solicitacao.detailed", {
        id: solicitacaoId,
      });

      updateSyncStateRecord(scope, {
        details_synced: itemsDetailed,
      });
    }

    updateSyncStateRecord(scope, {
      current_item_id: null,
      current_page: null,
      current_stage: "Reconciliação local de vínculos",
    });

    const reconciliation = runLocalReconciliation();
    reconciledCount =
      reconciliation.linkedByCreatedAt +
      reconciliation.linkedById +
      reconciliation.linkedByIdentificador +
      reconciliation.conflictsByCreatedAt +
      reconciliation.mismatchesByCreatedAt +
      reconciliation.confirmedLinked +
      reconciliation.unmatched;
    logSync("info", "sync.reconciliation.completed", {
      confirmed_linked: reconciliation.confirmedLinked,
      conflicts_by_created_at: reconciliation.conflictsByCreatedAt,
      linked_by_created_at: reconciliation.linkedByCreatedAt,
      linked_by_id: reconciliation.linkedById,
      linked_by_identificador: reconciliation.linkedByIdentificador,
      mismatches_by_created_at: reconciliation.mismatchesByCreatedAt,
      scope,
      unmatched: reconciliation.unmatched,
    });

    const touchedIds = [...touchedSolicitacaoIds];
    refreshSolicitacoesProjectionByIds(touchedIds);
    refreshOrcamentosProjectionBySolicitacaoIds(touchedIds);
    refreshVendasProjectionBySolicitacaoIds(touchedIds);

    updateSyncStateRecord(scope, {
      cancel_requested: 0,
      current_item_id: null,
      current_page: null,
      current_stage: "Concluído",
      details_synced: itemsDetailed,
      error: null,
      items_created: itemsCreated,
      items_skipped: itemsSkipped,
      items_synced: itemsCollected,
      last_synced_at: now,
      next_page: getSyncStateRecord(scope).next_page,
      queue_pending: countPendingTasks(scope),
      reconciled_synced: reconciledCount,
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
    const message = getSyncErrorMessage(error);
    const cancelled = isSyncCancelledError(error);

    updateSyncStateRecord(scope, {
      cancel_requested: 0,
      current_item_id: null,
      current_page: null,
      current_stage: cancelled ? "Cancelado" : "Falha no sync",
      details_synced: itemsDetailed,
      error: cancelled ? null : message,
      items_created: itemsCreated,
      items_skipped: itemsSkipped,
      items_synced: itemsCollected,
      next_page: getSyncStateRecord(scope).next_page,
      queue_pending: countPendingTasks(scope),
      reconciled_synced: reconciledCount,
      running_started_at: null,
      status: cancelled ? "cancelled" : "failed",
    });

    throw error;
  }
}

async function runPessoasSync(): Promise<SyncResult> {
  const scope: SyncScope = "pessoas";
  const now = new Date().toISOString();
  const maxPages = env.IDDAS_SYNC_MAX_PAGES;
  const perPage = env.IDDAS_SYNC_PESSOAS_PER_PAGE;
  const fetchedPersonIds = new Set<string>();
  let itemsCreated = 0;
  let itemsDetailed = 0;
  let itemsCollected = 0;
  let itemsSynced = 0;
  let itemsSkipped = 0;
  const touchedPersonIds = new Set<string>();

  try {
    const startPage = Math.max(1, getSyncStateRecord(scope).next_page || 1);
    resetScopeState(scope, now, startPage, "Coletando pessoas");

    let currentPage = startPage;
    let pagesVisited = 0;
    let reachedEnd = false;

    while (pagesVisited < maxPages) {
      throwIfCancelRequested(scope);
      updateSyncStateRecord(scope, {
        current_page: currentPage,
        current_stage: "Coletando pessoas",
      });

      const items = await fetchIddasList("pessoa", currentPage, perPage);
      pagesVisited += 1;

      logSync("info", "sync.pessoas.page", {
        page: currentPage,
        returned: items.length,
      });

      if (items.length === 0) {
        reachedEnd = true;
        break;
      }

      for (const item of items) {
        throwIfCancelRequested(scope);
        const normalized = normalizePessoaSummary(item, now);
        const existing = getMirrorState(getPessoaMirrorState, normalized.id);
        const needsDetail = shouldRefreshDetail(
          existing,
          normalized.source_hash ?? "",
          normalized.source_updated_at,
        );
        const alreadyExists = hasRow(hasPessoa, normalized.id);

        upsertPessoaSummary.run({
          ...normalized,
          needs_detail: needsDetail ? 1 : 0,
        });

        touchedPersonIds.add(normalized.id);
        itemsCollected += 1;

        if (!alreadyExists) {
          itemsCreated += 1;
        }

        if (needsDetail) {
          fetchedPersonIds.delete(normalized.id);
        } else {
          itemsSkipped += 1;
        }
      }

      updateSyncStateRecord(scope, {
        current_page: currentPage,
        items_created: itemsCreated,
        items_skipped: itemsSkipped,
        items_synced: itemsCollected,
        next_page: currentPage + 1,
      });

      if (items.length < perPage) {
        reachedEnd = true;
        break;
      }

      currentPage += 1;
    }

    updateSyncStateRecord(scope, {
      current_stage: "Detalhando pessoas alteradas",
      next_page: reachedEnd ? 1 : currentPage + 1,
    });

    const pendingPessoaIds = readPendingIds(listPendingPessoaIds);

    for (const personId of pendingPessoaIds) {
      throwIfCancelRequested(scope);

      if (fetchedPersonIds.has(personId)) {
        continue;
      }

      updateSyncStateRecord(scope, {
        current_item_id: personId,
        current_stage: "Atualizando pessoa detalhada",
      });

      try {
        const pessoa = await fetchIddasDetail("pessoa", personId);
        const pessoaAlreadyExists = hasRow(hasPessoa, personId);
        upsertPessoa.run(normalizePessoa(pessoa, now));
        fetchedPersonIds.add(personId);
        touchedPersonIds.add(personId);
        itemsDetailed += 1;
        itemsSynced += 1;

        if (!pessoaAlreadyExists) {
          itemsCreated += 1;
        }

        logSync("info", "sync.pessoa.detail-processed", {
          id: personId,
          new_record: pessoaAlreadyExists ? 0 : 1,
        });

        updateSyncStateRecord(scope, {
          details_synced: itemsDetailed,
          people_created: itemsCreated,
          people_synced: itemsSynced,
          related_created: itemsCreated,
          related_synced: itemsSynced,
        });
      } catch (error) {
        const message = getSyncErrorMessage(error);

        if (message.includes("IDDAS respondeu 404")) {
          fetchedPersonIds.add(personId);
          itemsSkipped += 1;
          logSync("warn", "sync.pessoa.detail-not-found", { id: personId });
          updateSyncStateRecord(scope, {
            items_skipped: itemsSkipped,
          });
          continue;
        }

        if (message.includes("IDDAS respondeu 429")) {
          logSync("warn", "sync.pessoa.detail-rate-limited", { id: personId });
          continue;
        }

        throw error;
      }
    }

    const pendingPessoaTasks = readPendingTasks(scope, "pessoa");
    updateSyncStateRecord(scope, {
      queue_pending: pendingPessoaTasks.length,
      current_page: null,
    });

    logSync("info", "sync.pessoas.pending-tasks", {
      pending: pendingPessoaTasks.length,
    });

    for (const task of pendingPessoaTasks) {
      throwIfCancelRequested(scope);

      const personId = task.entity_id;
      if (fetchedPersonIds.has(personId)) {
        itemsSkipped += 1;
        deleteSyncTask.run(task.id);
        updateSyncStateRecord(scope, {
          items_skipped: itemsSkipped,
          queue_pending: countPendingTasks(scope),
        });
        continue;
      }

      updateSyncStateRecord(scope, {
        current_item_id: personId,
        current_stage: "Atualizando pessoa pendente",
      });

      try {
        const pessoa = await fetchIddasDetail("pessoa", personId);
        const pessoaAlreadyExists = hasRow(hasPessoa, personId);
        if (!pessoaAlreadyExists) {
          itemsCreated += 1;
        }
        upsertPessoa.run(normalizePessoa(pessoa, now));
        fetchedPersonIds.add(personId);
        touchedPersonIds.add(personId);
        itemsDetailed += 1;
        itemsSynced += 1;
        deleteSyncTask.run(task.id);

        logSync("info", "sync.pessoa.processed", {
          id: personId,
          new_record: pessoaAlreadyExists ? 0 : 1,
        });

        updateSyncStateRecord(scope, {
          details_synced: itemsDetailed,
          items_created: itemsCreated,
          items_synced: itemsSynced,
          queue_pending: countPendingTasks(scope),
          related_created: itemsCreated,
          related_synced: itemsSynced,
          people_created: itemsCreated,
          people_synced: itemsSynced,
        });
      } catch (error) {
        const message = getSyncErrorMessage(error);

        if (message.includes("IDDAS respondeu 404")) {
          fetchedPersonIds.add(personId);
          itemsSkipped += 1;
          deleteSyncTask.run(task.id);
          logSync("warn", "sync.pessoa.not-found", { id: personId });
          updateSyncStateRecord(scope, {
            items_skipped: itemsSkipped,
            queue_pending: countPendingTasks(scope),
          });
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

    const touchedIds = [...touchedPersonIds];
    refreshOrcamentosProjectionByPessoaIds(touchedIds);
    refreshVendasProjectionByPessoaIds(touchedIds);

    updateSyncStateRecord(scope, {
      cancel_requested: 0,
      current_item_id: null,
      current_page: null,
      current_stage: "Concluído",
      details_synced: itemsDetailed,
      error: null,
      items_created: itemsCreated,
      items_skipped: itemsSkipped,
      items_synced: itemsCollected,
      last_synced_at: now,
      next_page: reachedEnd ? 1 : currentPage + 1,
      people_created: itemsCreated,
      people_synced: itemsSynced,
      queue_pending: countPendingTasks(scope),
      related_created: itemsCreated,
      related_synced: itemsSynced,
      running_started_at: null,
      status: "completed",
    });

    return {
      ok: true,
      last_synced_at: now,
      orcamentos_synced: 0,
      people_synced: itemsSynced,
      vendas_synced: 0,
    };
  } catch (error) {
    const message = getSyncErrorMessage(error);
    const cancelled = isSyncCancelledError(error);

    updateSyncStateRecord(scope, {
      cancel_requested: 0,
      current_item_id: null,
      current_page: null,
      current_stage: cancelled ? "Cancelado" : "Falha no sync",
      details_synced: itemsSynced,
      error: cancelled ? null : message,
      items_created: itemsCreated,
      items_skipped: itemsSkipped,
      items_synced: itemsSynced,
      next_page: 1,
      people_created: itemsCreated,
      people_synced: itemsSynced,
      queue_pending: countPendingTasks(scope),
      related_created: itemsCreated,
      related_synced: itemsSynced,
      running_started_at: null,
      status: cancelled ? "cancelled" : "failed",
    });

    throw error;
  }
}

async function runVendasSync(): Promise<SyncResult> {
  const scope: SyncScope = "vendas";
  const now = new Date().toISOString();
  let itemsCreated = 0;
  let itemsSynced = 0;
  let itemsSkipped = 0;
  const touchedVendaIds = new Set<string>();

  try {
    resetScopeState(scope, now, 1, "Processando fila de vendas");
    updateSyncStateRecord(scope, {
      current_page: null,
      next_page: 1,
    });

    const pendingVendaTasks = readPendingTasks(scope, "venda_orcamento");
    updateSyncStateRecord(scope, {
      queue_pending: pendingVendaTasks.length,
    });

    logSync("info", "sync.vendas.pending-tasks", {
      pending: pendingVendaTasks.length,
    });

    for (const task of pendingVendaTasks) {
      throwIfCancelRequested(scope);

      const payload = parseTaskPayload(task.payload_json);
      const orcamentoId = payload.orcamentoId ?? task.entity_id;
      const orcamentoIdentificador = payload.identificador;

      if (!orcamentoIdentificador) {
        itemsSkipped += 1;
        deleteSyncTask.run(task.id);
        updateSyncStateRecord(scope, {
          items_skipped: itemsSkipped,
          queue_pending: countPendingTasks(scope),
        });
        continue;
      }

      for (let vendaPage = 1; vendaPage <= env.IDDAS_SYNC_MAX_PAGES; vendaPage += 1) {
        throwIfCancelRequested(scope);

        updateSyncStateRecord(scope, {
          current_item_id: orcamentoId,
          current_page: vendaPage,
          current_stage: `Atualizando vendas de ${orcamentoIdentificador}`,
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
            itemsCreated += 1;
          }
          upsertVenda.run(vendaNormalized);
          touchedVendaIds.add(vendaNormalized.id);
          itemsSynced += 1;

          logSync("info", "sync.venda.processed", {
            id: vendaNormalized.id,
            new_record: vendaAlreadyExists ? 0 : 1,
            orcamento_id: vendaNormalized.orcamento_id,
            orcamento_identificador: vendaNormalized.orcamento_identificador,
          });

          updateSyncStateRecord(scope, {
            current_item_id: vendaNormalized.id,
            current_stage: "Atualizando venda pendente",
            details_synced: itemsSynced,
            items_created: itemsCreated,
            items_synced: itemsSynced,
            queue_pending: countPendingTasks(scope),
            secondary_created: itemsCreated,
            secondary_synced: itemsSynced,
            vendas_created: itemsCreated,
            vendas_synced: itemsSynced,
          });
        }

        if (vendas.length < env.IDDAS_SYNC_VENDAS_PER_PAGE) {
          break;
        }
      }

      deleteSyncTask.run(task.id);
      updateSyncStateRecord(scope, {
        queue_pending: countPendingTasks(scope),
      });
    }

    refreshVendasProjectionByIds([...touchedVendaIds]);

    updateSyncStateRecord(scope, {
      cancel_requested: 0,
      current_item_id: null,
      current_page: null,
      current_stage: "Concluído",
      details_synced: itemsSynced,
      error: null,
      items_created: itemsCreated,
      items_skipped: itemsSkipped,
      items_synced: itemsSynced,
      last_synced_at: now,
      next_page: 1,
      queue_pending: countPendingTasks(scope),
      running_started_at: null,
      secondary_created: itemsCreated,
      secondary_synced: itemsSynced,
      status: "completed",
      vendas_created: itemsCreated,
      vendas_synced: itemsSynced,
    });

    return {
      ok: true,
      last_synced_at: now,
      orcamentos_synced: 0,
      people_synced: 0,
      vendas_synced: itemsSynced,
    };
  } catch (error) {
    const message = getSyncErrorMessage(error);
    const cancelled = isSyncCancelledError(error);

    updateSyncStateRecord(scope, {
      cancel_requested: 0,
      current_item_id: null,
      current_page: null,
      current_stage: cancelled ? "Cancelado" : "Falha no sync",
      details_synced: itemsSynced,
      error: cancelled ? null : message,
      items_created: itemsCreated,
      items_skipped: itemsSkipped,
      items_synced: itemsSynced,
      next_page: getSyncStateRecord(scope).next_page,
      queue_pending: countPendingTasks(scope),
      running_started_at: null,
      secondary_created: itemsCreated,
      secondary_synced: itemsSynced,
      status: cancelled ? "cancelled" : "failed",
      vendas_created: itemsCreated,
      vendas_synced: itemsSynced,
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

export function resetIddasSyncScope(scope: SyncScope) {
  if (isIddasSyncRunning(scope)) {
    throw new Error("Pare o job antes de resetar o estado.");
  }

  if (scope === "orcamentos") {
    resetOrcamentoNeedsDetail.run();
    deleteSyncTasksByScope.run("pessoas");
    deleteSyncTasksByScope.run("vendas");
  }

  if (scope === "solicitacoes") {
    resetSolicitacaoNeedsDetail.run();
  }

  if (scope === "pessoas") {
    resetPessoaNeedsDetail.run();
  }

  deleteSyncTasksByScope.run(scope);

  return resetSyncStateRecord(scope);
}

export function isIddasSyncRunning(scope: SyncScope) {
  return scope === "orcamentos"
    ? Boolean(activeOrcamentosSync)
    : scope === "solicitacoes"
      ? Boolean(activeSolicitacoesSync)
      : scope === "pessoas"
        ? Boolean(activePessoasSync)
        : scope === "vendas"
          ? Boolean(activeVendasSync)
          : Boolean(
              activeOrcamentosSync ||
                activeSolicitacoesSync ||
                activePessoasSync ||
                activeVendasSync,
            );
}

function resetScopeState(scope: SyncScope, now: string, nextPage: number, stage: string) {
  updateSyncStateRecord(scope, {
    cancel_requested: 0,
    current_item_id: null,
    current_page: nextPage,
    current_stage: stage,
    details_synced: 0,
    error: null,
    items_created: 0,
    items_skipped: 0,
    items_synced: 0,
    last_synced_at: null,
    next_page: nextPage,
    next_orcamento_page: nextPage,
    orcamentos_created: 0,
    orcamentos_synced: 0,
    people_created: 0,
    people_synced: 0,
    queue_pending: countPendingTasks(scope),
    reconciled_synced: 0,
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
    detailsSynced: number;
    error: string | null;
    itemsCreated: number;
    itemsSkipped: number;
    itemsSynced: number;
    now: string;
    peopleCreated: number;
    peopleSynced: number;
    queuePending: number;
    reconciledSynced: number;
    relatedCreated?: number;
    relatedSynced?: number;
    secondaryCreated?: number;
    secondarySynced?: number;
    vendasCreated: number;
    vendasSynced: number;
  },
) {
  updateSyncStateRecord(scope, {
    cancel_requested: 0,
    current_item_id: null,
    current_page: null,
    current_stage: "Concluído",
    details_synced: input.detailsSynced,
    error: input.error,
    items_created: input.itemsCreated,
    items_skipped: input.itemsSkipped,
    items_synced: input.itemsSynced,
    last_synced_at: input.now,
    next_page: getSyncStateRecord(scope).next_page,
    next_orcamento_page: getSyncStateRecord(scope).next_orcamento_page,
    orcamentos_created: input.itemsCreated,
    orcamentos_synced: input.itemsSynced,
    people_created: input.peopleCreated,
    people_synced: input.peopleSynced,
    queue_pending: input.queuePending,
    reconciled_synced: input.reconciledSynced,
    related_created: input.relatedCreated ?? input.peopleCreated,
    related_synced: input.relatedSynced ?? input.peopleSynced,
    running_started_at: null,
    secondary_created: input.secondaryCreated ?? input.vendasCreated,
    secondary_synced: input.secondarySynced ?? input.vendasSynced,
    status: "completed",
    vendas_created: input.vendasCreated,
    vendas_synced: input.vendasSynced,
  });
}

function finishScopeWithError(
  scope: SyncScope,
  input: {
    detailsSynced: number;
    error: unknown;
    itemsCreated: number;
    itemsSkipped: number;
    itemsSynced: number;
    peopleCreated: number;
    peopleSynced: number;
    queuePending: number;
    reconciledSynced: number;
    relatedCreated?: number;
    relatedSynced?: number;
    secondaryCreated?: number;
    secondarySynced?: number;
    vendasCreated: number;
    vendasSynced: number;
  },
) {
  const message = getSyncErrorMessage(input.error);
  const cancelled = isSyncCancelledError(input.error);

  updateSyncStateRecord(scope, {
    cancel_requested: 0,
    current_item_id: null,
    current_page: null,
    current_stage: cancelled ? "Cancelado" : "Falha no sync",
    details_synced: input.detailsSynced,
    error: cancelled ? null : message,
    items_created: input.itemsCreated,
    items_skipped: input.itemsSkipped,
    items_synced: input.itemsSynced,
    next_page: getSyncStateRecord(scope).next_page,
    next_orcamento_page: getSyncStateRecord(scope).next_orcamento_page,
    orcamentos_created: input.itemsCreated,
    orcamentos_synced: input.itemsSynced,
    people_created: input.peopleCreated,
    people_synced: input.peopleSynced,
    queue_pending: input.queuePending,
    reconciled_synced: input.reconciledSynced,
    related_created: input.relatedCreated ?? input.peopleCreated,
    related_synced: input.relatedSynced ?? input.peopleSynced,
    running_started_at: null,
    secondary_created: input.secondaryCreated ?? input.vendasCreated,
    secondary_synced: input.secondarySynced ?? input.vendasSynced,
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

function shouldRefreshPessoa(reference: PessoaReference) {
  const existing = getPessoaSnapshot.get(reference.id) as
    | {
        celular: string | null;
        cpf: string | null;
        email: string | null;
        id: string;
        nascimento: string | null;
        nome: string | null;
        tipo_cliente: string | null;
        tipo_fornecedor: string | null;
        tipo_passageiro: string | null;
        tipo_representante: string | null;
      }
    | undefined;

  return shouldRefreshPessoaSnapshot(existing, reference);
}

function runLocalReconciliation() {
  const linkedByCreatedAt = reconcileSolicitacoesByCreatedAtWindow.run().changes;
  const linkedById = reconcileSolicitacoesOrcamentoIdByIdentificador.run().changes;
  const linkedByIdentificador =
    reconcileSolicitacoesIdentificadorByOrcamentoId.run().changes;
  const conflictsByCreatedAt = flagSolicitacoesCreatedAtConflict.run().changes;
  const mismatchesByCreatedAt = flagSolicitacoesCreatedAtMismatch.run().changes;
  const confirmedLinked = markLinkedSolicitacoesConfirmed.run().changes;
  const unmatched = markUnmatchedSolicitacoes.run().changes;

  return {
    confirmedLinked,
    conflictsByCreatedAt,
    linkedByCreatedAt,
    linkedById,
    linkedByIdentificador,
    mismatchesByCreatedAt,
    unmatched,
  };
}

function countPendingTasks(scope: SyncScope) {
  const row = countPendingSyncTasks.get(scope) as { total: number };
  return row.total;
}

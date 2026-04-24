import { createHash } from "node:crypto";
import {
  readFirstObjectArrayItem,
  readNestedString,
  readObjectArray,
  safeParseObject,
  toObject,
  type UnknownObject,
} from "@/lib/object-utils";
import {
  db,
  refreshOrcamentosProjectionByIds,
  refreshOrcamentosProjectionByPessoaIds,
  refreshOrcamentosProjectionBySolicitacaoIds,
  refreshSolicitacoesProjectionByIds,
  refreshSolicitacoesProjectionByOrcamentoIds,
  refreshVendasProjectionByPessoaIds,
  refreshVendasProjectionBySolicitacaoIds,
  refreshVoosProjectionByOrcamentoIds,
} from "@/lib/db";
import { readString } from "@/lib/iddas/accessors";
import { getLatestIddasWebhookDeliveryByEntity } from "@/lib/documents/repository";

type IddasWebhookApplyResult = {
  entityId: string | null;
  entityType: string;
  orcamentoId: string | null;
  status: "deferred" | "processed";
};

type IddasWebhookObject = UnknownObject;

const upsertOrcamentoFromWebhook = db.prepare(`
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
    NULL,
    '[]',
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
    created_at_source = COALESCE(orcamentos.created_at_source, excluded.created_at_source),
    cliente_pessoa_id = COALESCE(excluded.cliente_pessoa_id, orcamentos.cliente_pessoa_id),
    situacao_codigo = excluded.situacao_codigo,
    situacao_nome = excluded.situacao_nome,
    raw_summary_json = excluded.raw_summary_json,
    raw_json = excluded.raw_json,
    source_updated_at = excluded.source_updated_at,
    source_hash = excluded.source_hash,
    last_seen_at = excluded.last_seen_at,
    detail_synced_at = excluded.detail_synced_at,
    needs_detail = 0,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const upsertSolicitacaoFromWebhook = db.prepare(`
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
    linked_orcamento_id = COALESCE(excluded.linked_orcamento_id, solicitacoes.linked_orcamento_id),
    linked_orcamento_identificador = COALESCE(excluded.linked_orcamento_identificador, solicitacoes.linked_orcamento_identificador),
    match_status = excluded.match_status,
    match_reason = excluded.match_reason,
    raw_summary_json = excluded.raw_summary_json,
    raw_json = excluded.raw_json,
    source_updated_at = excluded.source_updated_at,
    source_hash = excluded.source_hash,
    last_seen_at = excluded.last_seen_at,
    detail_synced_at = excluded.detail_synced_at,
    needs_detail = 0,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const upsertPessoaFromWebhook = db.prepare(`
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
    NULL,
    NULL,
    NULL,
    NULL,
    @endereco,
    @numero,
    @complemento,
    @bairro,
    @cidade,
    @estado,
    @cep,
    NULL,
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
    endereco = excluded.endereco,
    numero = excluded.numero,
    complemento = excluded.complemento,
    bairro = excluded.bairro,
    cidade = excluded.cidade,
    estado = excluded.estado,
    cep = excluded.cep,
    created_at_source = COALESCE(pessoas.created_at_source, excluded.created_at_source),
    source_updated_at = excluded.source_updated_at,
    source_hash = excluded.source_hash,
    last_seen_at = excluded.last_seen_at,
    detail_synced_at = excluded.detail_synced_at,
    needs_detail = 0,
    raw_json = excluded.raw_json,
    updated_at = excluded.updated_at,
    synced_at = excluded.synced_at
`);

const deleteVoosByOrcamentoId = db.prepare(`
  DELETE FROM voos
  WHERE orcamento_id = ?
`);

const upsertVooFromWebhook = db.prepare(`
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
    NULL,
    @companhia_nome,
    @classe,
    @aeroporto_origem,
    @aeroporto_destino,
    @data_embarque,
    @hora_embarque,
    @data_chegada,
    @hora_chegada,
    NULL,
    @localizador,
    @numero_compra,
    NULL,
    @cliente_pessoa_id,
    @qtd_paradas,
    @bagagem_bolsa,
    @bagagem_demao,
    @bagagem_despachada,
    @raw_json,
    @updated_at,
    @synced_at
  )
`);

const getOrcamentoIdByIdentificador = db.prepare(`
  SELECT id
  FROM orcamentos
  WHERE identificador = ?
  ORDER BY datetime(updated_at) DESC, id DESC
  LIMIT 1
`);

const getPessoaIdByCpf = db.prepare(`
  SELECT id
  FROM pessoas
  WHERE cpf = ?
  ORDER BY datetime(updated_at) DESC, id DESC
  LIMIT 1
`);

const getPessoaIdByEmail = db.prepare(`
  SELECT id
  FROM pessoas
  WHERE lower(email) = lower(?)
  ORDER BY datetime(updated_at) DESC, id DESC
  LIMIT 1
`);

export function applyIddasWebhook(payload: unknown): IddasWebhookApplyResult {
  const body = toObject(payload);

  if (!body) {
    throw new Error("Payload do webhook do IDDAS inválido.");
  }

  const eventName = readString(body.evento)?.toUpperCase();

  switch (eventName) {
    case "COTACAO":
      return applyCotacaoWebhook(body);
    case "SOLICITACAO_COTACAO":
      return applySolicitacaoWebhook(body);
    case "CADASTRO_PESSOA":
      return applyPessoaWebhook(body);
    default:
      return {
        entityId: readString(body.id) ?? readString(body.identificador),
        entityType: "unknown",
        orcamentoId: readString(body.id_orcamento),
        status: "processed",
      };
  }
}

function applyCotacaoWebhook(body: IddasWebhookObject): IddasWebhookApplyResult {
  const identificador = requireValue(readString(body.identificador), "cotacao.identificador");
  const orcamentoId = readString(body.id_orcamento) ?? readExistingOrcamentoId(identificador);

  if (!orcamentoId) {
    return {
      entityId: identificador,
      entityType: "cotacao",
      orcamentoId: null,
      status: "deferred",
    };
  }

  persistCotacaoSnapshot(body, orcamentoId, identificador);

  return {
    entityId: identificador,
    entityType: "cotacao",
    orcamentoId,
    status: "processed",
  };
}

function applySolicitacaoWebhook(body: IddasWebhookObject): IddasWebhookApplyResult {
  const now = new Date().toISOString();
  const solicitationId = requireValue(readString(body.id), "solicitacao.id");
  const orcamentoId = readString(body.id_orcamento);
  const identificador = readString(body.identificador);

  if (orcamentoId) {
    const cotacaoDelivery = identificador
      ? getLatestIddasWebhookDeliveryByEntity("cotacao", identificador)
      : undefined;

    if (cotacaoDelivery) {
      const cotacaoPayload = safeParseObject(cotacaoDelivery.payload_json);

      if (cotacaoPayload) {
        persistCotacaoSnapshot(cotacaoPayload, orcamentoId, identificador);
      }
    }
  }

  upsertSolicitacaoFromWebhook.run(
    normalizeSolicitacaoWebhook(body, now, orcamentoId, identificador),
  );

  refreshSolicitacoesProjectionByIds([solicitationId]);

  if (orcamentoId) {
    refreshOrcamentosProjectionByIds([orcamentoId]);
    refreshSolicitacoesProjectionByOrcamentoIds([orcamentoId]);
  } else {
    refreshOrcamentosProjectionBySolicitacaoIds([solicitationId]);
  }

  refreshVendasProjectionBySolicitacaoIds([solicitationId]);

  return {
    entityId: solicitationId,
    entityType: "solicitacao",
    orcamentoId,
    status: "processed",
  };
}

function applyPessoaWebhook(body: IddasWebhookObject): IddasWebhookApplyResult {
  const now = new Date().toISOString();
  const pessoaId = requireValue(readString(body.id), "pessoa.id");

  upsertPessoaFromWebhook.run(normalizePessoaWebhook(body, now));
  refreshOrcamentosProjectionByPessoaIds([pessoaId]);
  refreshVendasProjectionByPessoaIds([pessoaId]);

  return {
    entityId: pessoaId,
    entityType: "pessoa",
    orcamentoId: null,
    status: "processed",
  };
}

function persistCotacaoSnapshot(
  body: IddasWebhookObject,
  orcamentoId: string,
  identificador: string | null,
) {
  const now = new Date().toISOString();
  const normalized = normalizeCotacaoWebhook(body, now, orcamentoId, identificador);

  db.transaction(() => {
    upsertOrcamentoFromWebhook.run(normalized.orcamento);
    deleteVoosByOrcamentoId.run(orcamentoId);

    for (const voo of normalized.voos) {
      upsertVooFromWebhook.run(voo);
    }
  })();

  refreshOrcamentosProjectionByIds([orcamentoId]);
  refreshSolicitacoesProjectionByOrcamentoIds([orcamentoId]);
  refreshVoosProjectionByOrcamentoIds([orcamentoId]);
}

function normalizeCotacaoWebhook(
  body: IddasWebhookObject,
  syncedAt: string,
  orcamentoId: string,
  identificador: string | null,
) {
  const rawJson = JSON.stringify(body);
  const sourceUpdatedAt = readString(body.data_hora_evento) ?? syncedAt;
  const cliente = readFirstObjectArrayItem(body.cliente);
  const clientePessoaId = inferPessoaIdFromWebhookClient(cliente);
  const voos = readObjectArray(body.voo).map((voo, index) =>
    normalizeCotacaoVooWebhook(
      voo,
      index,
      syncedAt,
      orcamentoId,
      identificador,
      readString(body.titulo),
      clientePessoaId,
    ),
  );

  return {
    orcamento: {
      id: orcamentoId,
      identificador,
      created_at_source: sourceUpdatedAt,
      cliente_pessoa_id: clientePessoaId,
      situacao_codigo: readNestedString(body, ["situacao", "codigo"]),
      situacao_nome: readNestedString(body, ["situacao", "descricao"]),
      passageiro_count: computePassageiroCount(body),
      raw_summary_json: rawJson,
      raw_json: rawJson,
      source_hash: hashPayload(rawJson),
      source_updated_at: sourceUpdatedAt,
      last_seen_at: syncedAt,
      detail_synced_at: syncedAt,
      updated_at: sourceUpdatedAt,
      synced_at: syncedAt,
    },
    voos,
  };
}

function normalizeCotacaoVooWebhook(
  voo: IddasWebhookObject,
  index: number,
  syncedAt: string,
  orcamentoId: string,
  identificador: string | null,
  titulo: string | null,
  clientePessoaId: string | null,
) {
  const origem = extractAirportName(readString(voo.origem));
  const destino = extractAirportName(readString(voo.destino));
  const dataEmbarque = splitDateTime(readString(voo.data_embarque));
  const dataChegada = splitDateTime(readString(voo.data_chegada));
  const rawJson = JSON.stringify(voo);

  return {
    id: hashPayload(
      JSON.stringify({
        destino,
        index,
        origem,
        orcamentoId,
        rawJson,
      }),
    ),
    orcamento_id: orcamentoId,
    orcamento_identificador: identificador,
    titulo_orcamento: titulo,
    tipo_trecho: readString(voo.tipo),
    voo: readString(voo.voo),
    companhia_nome: readString(voo.companhia),
    classe: readString(voo.classe),
    aeroporto_origem: origem,
    aeroporto_destino: destino,
    data_embarque: dataEmbarque.date,
    hora_embarque: dataEmbarque.time,
    data_chegada: dataChegada.date,
    hora_chegada: dataChegada.time,
    localizador: readString(voo.localizador),
    numero_compra: readString(voo.numerocompra),
    cliente_pessoa_id: clientePessoaId,
    qtd_paradas: readString(voo.paradas),
    bagagem_bolsa: readString(voo.mochila),
    bagagem_demao: readString(voo.bagagem_mao),
    bagagem_despachada: readString(voo.bagagem_despachada),
    raw_json: rawJson,
    updated_at: readString(voo.data_embarque) ?? syncedAt,
    synced_at: syncedAt,
  };
}

function normalizeSolicitacaoWebhook(
  body: IddasWebhookObject,
  syncedAt: string,
  orcamentoId: string | null,
  identificador: string | null,
) {
  const rawJson = JSON.stringify(body);
  const sourceUpdatedAt = readString(body.data_solicitacao) ?? syncedAt;

  return {
    id: requireValue(readString(body.id), "solicitacao.id"),
    nome: readString(body.nome),
    email: readString(body.email),
    telefone: readString(body.celular),
    origem: readString(body.origem),
    destino: readString(body.destino),
    data_ida: readString(body.data_ida),
    data_volta: readString(body.data_volta),
    adultos: readString(body.pas_adulto),
    criancas: readString(body.pas_crianca),
    possui_flexibilidade: readString(body.flexibilidade_data),
    observacao: readString(body.observacao),
    data_solicitacao: sourceUpdatedAt,
    linked_orcamento_id: orcamentoId,
    linked_orcamento_identificador: identificador,
    match_status: orcamentoId ? "confirmed" : "unmatched",
    match_reason: orcamentoId ? "iddas_webhook" : null,
    raw_summary_json: rawJson,
    raw_json: rawJson,
    source_updated_at: sourceUpdatedAt,
    source_hash: hashPayload(rawJson),
    last_seen_at: syncedAt,
    detail_synced_at: syncedAt,
    updated_at: sourceUpdatedAt,
    synced_at: syncedAt,
  };
}

function normalizePessoaWebhook(body: IddasWebhookObject, syncedAt: string) {
  const rawJson = JSON.stringify(body);
  const sourceUpdatedAt = readString(body.data_cadastro) ?? syncedAt;

  return {
    id: requireValue(readString(body.id), "pessoa.id"),
    nome: readString(body.nome),
    email: readString(body.email),
    cpf: readString(body.cpf),
    celular: readString(body.celular),
    nascimento: readString(body.nascimento),
    sexo: readString(body.sexo),
    rg: readString(body.rg),
    passaporte: readString(body.passaporte),
    endereco: readString(body.endereco),
    numero: readString(body.numero),
    complemento: readString(body.complemento),
    bairro: readString(body.bairro),
    cidade: readString(body.cidade),
    estado: readString(body.uf),
    cep: readString(body.cep),
    created_at_source: sourceUpdatedAt,
    source_updated_at: sourceUpdatedAt,
    source_hash: hashPayload(rawJson),
    last_seen_at: syncedAt,
    detail_synced_at: syncedAt,
    raw_json: rawJson,
    updated_at: sourceUpdatedAt,
    synced_at: syncedAt,
  };
}

function inferPessoaIdFromWebhookClient(cliente: IddasWebhookObject | null) {
  if (!cliente) {
    return null;
  }

  const cpf = readString(cliente.cpf);
  if (cpf) {
    const row = getPessoaIdByCpf.get(cpf) as { id: string } | undefined;
    if (row?.id) {
      return row.id;
    }
  }

  const email = readString(cliente.email);
  if (email) {
    const row = getPessoaIdByEmail.get(email) as { id: string } | undefined;
    if (row?.id) {
      return row.id;
    }
  }

  return null;
}

function readExistingOrcamentoId(identificador: string) {
  const row = getOrcamentoIdByIdentificador.get(identificador) as { id: string } | undefined;
  return row?.id ?? null;
}

function computePassageiroCount(body: IddasWebhookObject) {
  return (
    parseInt(readString(body.pas_adulto) ?? "0", 10) +
    parseInt(readString(body.pas_crianca) ?? "0", 10) +
    parseInt(readString(body.pas_bebe) ?? "0", 10)
  );
}

function splitDateTime(value: string | null) {
  if (!value) {
    return { date: null, time: null };
  }

  const [date, time] = value.trim().split(/\s+/);
  return {
    date: date?.trim() || null,
    time: time?.trim() || null,
  };
}

function extractAirportName(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(.*?)(?:\s*\([A-Z0-9]{3,4}\))?$/);
  return match?.[1]?.trim() || value;
}

function hashPayload(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requireValue(value: string | null, field: string) {
  if (!value) {
    throw new Error(`Campo obrigatório ausente no webhook do IDDAS: ${field}`);
  }

  return value;
}

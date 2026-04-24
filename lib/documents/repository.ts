import { db } from "@/lib/db";
import type {
  DocumentSignatureEventRecord,
  DocumentSignatureRequestRecord,
} from "@/lib/clicksign/types";
import type {
  DocumentTemplateRecord,
  DocumentHistoryRecord,
  DocumentRecord,
  OrcamentoDocumentSource,
  RecentFornecedorDocumentOption,
  PessoaDocumentSource,
  RecentPessoaDocumentOption,
  RecentOrcamentoDocumentOption,
} from "@/lib/documents/types";

const DOCUMENT_SIGNATURE_REQUEST_SELECT = `
  SELECT
    id,
    document_record_id,
    provider,
    provider_envelope_id,
    provider_document_id,
    status,
    signers_json,
    signature_links_json,
    last_error,
    raw_response_json,
    created_at,
    updated_at,
    sent_at,
    signed_at
  FROM document_signature_requests
`;

const DOCUMENT_HISTORY_SELECT = `
  SELECT
    dr.id,
    dr.template_key,
    dr.template_version,
    dr.entity_type,
    dr.entity_id,
    dr.title,
    dr.payload_json,
    dr.html_snapshot,
    dr.created_at,
    dr.updated_at,
    dsr.status AS signature_status,
      dsr.last_error AS signature_last_error,
      dsr.provider_document_id AS signature_provider_document_id,
      dsr.provider_envelope_id AS signature_provider_envelope_id,
      dsr.raw_response_json AS signature_raw_response_json,
    dsr.signers_json AS signature_signers_json,
    dsr.sent_at AS signature_sent_at,
    dsr.signed_at AS signature_signed_at
  FROM document_records dr
  LEFT JOIN document_signature_requests dsr ON dsr.id = (
    SELECT inner_dsr.id
    FROM document_signature_requests inner_dsr
    WHERE inner_dsr.document_record_id = dr.id
    ORDER BY datetime(inner_dsr.created_at) DESC, inner_dsr.id DESC
    LIMIT 1
  )
`;

export function listDocumentTemplates() {
  return db
    .prepare(
      `
        SELECT key, title, description, version, is_active, updated_at
        FROM document_templates
        ORDER BY updated_at DESC, key ASC
      `,
    )
    .all() as DocumentTemplateRecord[];
}

export function updateDocumentTemplateState(key: string, isActive: boolean) {
  db.prepare(
    `
      UPDATE document_templates
      SET is_active = ?, updated_at = ?
      WHERE key = ?
    `,
  ).run(isActive ? 1 : 0, new Date().toISOString(), key);
}

export function getDocumentTemplate(key: string) {
  return db
    .prepare(
      `
        SELECT key, title, description, version, is_active, updated_at
        FROM document_templates
        WHERE key = ?
      `,
    )
    .get(key) as DocumentTemplateRecord | undefined;
}

export function listDocumentRecords(limit = 20) {
  const rows = db
    .prepare(
      `
        ${DOCUMENT_HISTORY_SELECT}
        ORDER BY datetime(dr.created_at) DESC, dr.id DESC
        LIMIT ?
      `,
    )
    .all(limit) as Array<
      DocumentRecord & {
        signature_last_error: string | null;
        signature_provider_document_id: string | null;
        signature_provider_envelope_id: string | null;
        signature_raw_response_json: string | null;
        signature_signers_json: string | null;
        signature_sent_at: string | null;
        signature_signed_at: string | null;
        signature_status: string | null;
      }
    >;

  return rows.map((row) => ({
    ...row,
    signatureLastError: row.signature_last_error,
    signatureProviderDocumentId: row.signature_provider_document_id,
    signatureProviderEnvelopeId: row.signature_provider_envelope_id,
    signatureRawResponseJson: row.signature_raw_response_json,
    signatureSignersJson: row.signature_signers_json,
    signatureSentAt: row.signature_sent_at,
    signatureSignedAt: row.signature_signed_at,
    signatureStatus: row.signature_status,
  })) as DocumentHistoryRecord[];
}

export function countDocumentRecords() {
  const row = db
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM document_records
      `,
    )
    .get() as { total: number };

  return row.total;
}

export function getDocumentRecord(id: number) {
  return db
    .prepare(
      `
        SELECT
          id,
          template_key,
          template_version,
          entity_type,
          entity_id,
          title,
          payload_json,
          html_snapshot,
          created_at,
          updated_at
        FROM document_records
        WHERE id = ?
      `,
    )
    .get(id) as DocumentRecord | undefined;
}

export function deleteDocumentRecord(id: number) {
  return db
    .prepare(
      `
        DELETE FROM document_records
        WHERE id = ?
      `,
    )
    .run(id);
}

export function insertDocumentRecord(input: Omit<DocumentRecord, "id">) {
  const result = db
    .prepare(
      `
        INSERT INTO document_records (
          template_key,
          template_version,
          entity_type,
          entity_id,
          title,
          payload_json,
          html_snapshot,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      input.template_key,
      input.template_version,
      input.entity_type,
      input.entity_id,
      input.title,
      input.payload_json,
      input.html_snapshot,
      input.created_at,
      input.updated_at,
    );

  return Number(result.lastInsertRowid);
}

export function getLatestDocumentSignatureRequest(documentRecordId: number) {
  return getDocumentSignatureRequestWhere(
    "document_record_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1",
    documentRecordId,
  );
}

export function getDocumentSignatureRequestById(id: number) {
  return getDocumentSignatureRequestWhere("id = ?", id);
}

export function getLatestDocumentSignatureRequestByEnvelopeId(providerEnvelopeId: string) {
  return getDocumentSignatureRequestWhere(
    "provider_envelope_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1",
    providerEnvelopeId,
  );
}

export function getLatestDocumentSignatureRequestByDocumentProviderId(
  providerDocumentId: string,
) {
  return getDocumentSignatureRequestWhere(
    "provider_document_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1",
    providerDocumentId,
  );
}

export function insertDocumentSignatureRequest(
  input: Omit<DocumentSignatureRequestRecord, "id">,
) {
  const result = db
    .prepare(
      `
        INSERT INTO document_signature_requests (
          document_record_id,
          provider,
          provider_envelope_id,
          provider_document_id,
          status,
          signers_json,
          signature_links_json,
          last_error,
          raw_response_json,
          created_at,
          updated_at,
          sent_at,
          signed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      input.document_record_id,
      input.provider,
      input.provider_envelope_id,
      input.provider_document_id,
      input.status,
      input.signers_json,
      input.signature_links_json,
      input.last_error,
      input.raw_response_json,
      input.created_at,
      input.updated_at,
      input.sent_at,
      input.signed_at,
    );

  return Number(result.lastInsertRowid);
}

export function updateDocumentSignatureRequest(
  id: number,
  input: Partial<Omit<DocumentSignatureRequestRecord, "id" | "document_record_id" | "provider" | "created_at">>,
) {
  const current = db
    .prepare(
      `
        SELECT *
        FROM document_signature_requests
        WHERE id = ?
      `,
    )
    .get(id) as DocumentSignatureRequestRecord | undefined;

  if (!current) {
    return;
  }

  db.prepare(
    `
      UPDATE document_signature_requests
      SET
        provider_envelope_id = ?,
        provider_document_id = ?,
        status = ?,
        signers_json = ?,
        signature_links_json = ?,
        last_error = ?,
        raw_response_json = ?,
        updated_at = ?,
        sent_at = ?,
        signed_at = ?
      WHERE id = ?
    `,
  ).run(
    resolvePatchValue(input.provider_envelope_id, current.provider_envelope_id),
    resolvePatchValue(input.provider_document_id, current.provider_document_id),
    resolvePatchValue(input.status, current.status),
    resolvePatchValue(input.signers_json, current.signers_json),
    resolvePatchValue(input.signature_links_json, current.signature_links_json),
    resolvePatchValue(input.last_error, current.last_error),
    resolvePatchValue(input.raw_response_json, current.raw_response_json),
    resolvePatchValue(input.updated_at, current.updated_at),
    resolvePatchValue(input.sent_at, current.sent_at),
    resolvePatchValue(input.signed_at, current.signed_at),
    id,
  );
}

export function upsertDocumentSignatureEvent(input: DocumentSignatureEventRecord) {
  db.prepare(
    `
      INSERT INTO document_signature_events (
        id,
        signature_request_id,
        provider_event_type,
        provider_created_at,
        payload_json,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        signature_request_id = excluded.signature_request_id,
        provider_event_type = excluded.provider_event_type,
        provider_created_at = excluded.provider_created_at,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `,
  ).run(
    input.id,
    input.signature_request_id,
    input.provider_event_type,
    input.provider_created_at,
    input.payload_json,
    input.created_at,
    input.updated_at,
  );
}

export function insertClicksignWebhookDelivery(input: {
  created_at: string;
  event_name: string | null;
  payload_json: string;
  processing_error: string | null;
  processing_status: string;
  provider_document_id: string | null;
  provider_envelope_id: string | null;
  signature_header: string | null;
  signature_valid: boolean;
  updated_at: string;
}) {
  const result = db
    .prepare(
      `
        INSERT INTO clicksign_webhook_deliveries (
          provider_document_id,
          provider_envelope_id,
          signature_header,
          signature_valid,
          event_name,
          payload_json,
          processing_status,
          processing_error,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      input.provider_document_id,
      input.provider_envelope_id,
      input.signature_header,
      input.signature_valid ? 1 : 0,
      input.event_name,
      input.payload_json,
      input.processing_status,
      input.processing_error,
      input.created_at,
      input.updated_at,
    );

  return Number(result.lastInsertRowid);
}

export function insertIddasWebhookDelivery(input: {
  created_at: string;
  event_name: string | null;
  headers_json: string;
  payload_json: string;
  processing_error: string | null;
  processing_status: string;
  provider_entity_id: string | null;
  provider_entity_type: string | null;
  provider_occurred_at: string | null;
  provider_orcamento_id: string | null;
  provider_status_code: string | null;
  provider_status_label: string | null;
  updated_at: string;
}) {
  const result = db
    .prepare(
      `
        INSERT INTO iddas_webhook_deliveries (
          event_name,
          provider_entity_type,
          provider_entity_id,
          provider_orcamento_id,
          provider_occurred_at,
          provider_status_code,
          provider_status_label,
          headers_json,
          payload_json,
          processing_status,
          processing_error,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      input.event_name,
      input.provider_entity_type,
      input.provider_entity_id,
      input.provider_orcamento_id,
      input.provider_occurred_at,
      input.provider_status_code,
      input.provider_status_label,
      input.headers_json,
      input.payload_json,
      input.processing_status,
      input.processing_error,
      input.created_at,
      input.updated_at,
    );

  return Number(result.lastInsertRowid);
}

export function updateIddasWebhookDelivery(
  id: number,
  input: {
    processing_error?: string | null;
    processing_status?: string;
    updated_at: string;
  },
) {
  const current = db
    .prepare(
      `
        SELECT *
        FROM iddas_webhook_deliveries
        WHERE id = ?
      `,
    )
    .get(id) as
    | {
        processing_error: string | null;
        processing_status: string;
      }
    | undefined;

  if (!current) {
    return;
  }

  db.prepare(
    `
      UPDATE iddas_webhook_deliveries
      SET
        processing_status = ?,
        processing_error = ?,
        updated_at = ?
      WHERE id = ?
    `,
  ).run(
    input.processing_status ?? current.processing_status,
    input.processing_error === undefined ? current.processing_error : input.processing_error,
    input.updated_at,
    id,
  );
}

export function getLatestIddasWebhookDeliveryByEntity(
  entityType: string,
  entityId: string,
) {
  return db
    .prepare(
      `
        SELECT *
        FROM iddas_webhook_deliveries
        WHERE provider_entity_type = ?
          AND provider_entity_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
    )
    .get(entityType, entityId) as
    | {
        event_name: string | null;
        headers_json: string;
        id: number;
        payload_json: string;
        processing_error: string | null;
        processing_status: string;
        provider_entity_id: string | null;
        provider_entity_type: string | null;
        provider_occurred_at: string | null;
        provider_orcamento_id: string | null;
        provider_status_code: string | null;
        provider_status_label: string | null;
      }
    | undefined;
}

export function updateClicksignWebhookDelivery(
  id: number,
  input: {
    processing_error?: string | null;
    processing_status?: string;
    signature_valid?: boolean;
    updated_at: string;
  },
) {
  const current = db
    .prepare(
      `
        SELECT *
        FROM clicksign_webhook_deliveries
        WHERE id = ?
      `,
    )
    .get(id) as
    | {
        processing_error: string | null;
        processing_status: string;
        signature_valid: number;
      }
    | undefined;

  if (!current) {
    return;
  }

  db.prepare(
    `
      UPDATE clicksign_webhook_deliveries
      SET
        signature_valid = ?,
        processing_status = ?,
        processing_error = ?,
        updated_at = ?
      WHERE id = ?
    `,
  ).run(
    input.signature_valid === undefined ? current.signature_valid : input.signature_valid ? 1 : 0,
    input.processing_status ?? current.processing_status,
    input.processing_error === undefined ? current.processing_error : input.processing_error,
    input.updated_at,
    id,
  );
}

function resolvePatchValue<T>(nextValue: T | undefined, currentValue: T) {
  return nextValue === undefined ? currentValue : nextValue;
}

function getDocumentSignatureRequestWhere(whereClause: string, value: number | string) {
  return db
    .prepare(
      `
        ${DOCUMENT_SIGNATURE_REQUEST_SELECT}
        WHERE ${whereClause}
      `,
    )
    .get(value) as DocumentSignatureRequestRecord | undefined;
}

export function searchOrcamentoDocumentOptions(query: string, limit = 12) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [] as RecentOrcamentoDocumentOption[];
  }

  const like = `%${normalizedQuery}%`;

  return db
    .prepare(
      `
        SELECT
          vw.id,
          vw.identificador,
          COALESCE(vw.cliente_nome_db, vw.solicitacao_nome) AS cliente_nome,
          vw.situacao_nome,
          vw.situacao_cor
        FROM orcamentos_projection vw
        WHERE
          LOWER(TRIM(COALESCE(vw.situacao_nome, ''))) = 'aprovado'
          AND (
            vw.id LIKE ?
            OR COALESCE(vw.identificador, '') LIKE ?
            OR COALESCE(vw.cliente_nome_db, vw.solicitacao_nome, '') LIKE ?
          )
        ORDER BY datetime(vw.updated_at) DESC, vw.id DESC
        LIMIT ?
      `,
    )
    .all(like, like, like, limit) as RecentOrcamentoDocumentOption[];
}

export function getRecentPessoaDocumentOptions(limit = 20) {
  return db
    .prepare(
      `
        SELECT id, nome, cpf, cidade
        FROM pessoas
        ORDER BY datetime(updated_at) DESC, id DESC
        LIMIT ?
      `,
    )
    .all(limit) as RecentPessoaDocumentOption[];
}

export function searchPessoaDocumentOptions(query: string, limit = 20) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return getRecentPessoaDocumentOptions(limit);
  }

  const like = `%${normalizedQuery}%`;
  const digits = normalizedQuery.replace(/\D/g, "");
  const cpfLike = digits ? `%${digits}%` : like;

  return db
    .prepare(
      `
        SELECT id, nome, cpf, cidade
        FROM pessoas
        WHERE
          COALESCE(nome, '') LIKE ?
          OR REPLACE(REPLACE(REPLACE(COALESCE(cpf, ''), '.', ''), '-', ''), '/', '') LIKE ?
        ORDER BY datetime(updated_at) DESC, id DESC
        LIMIT ?
      `,
    )
    .all(like, cpfLike, limit) as RecentPessoaDocumentOption[];
}

export function searchFornecedorDocumentOptions(query: string, limit = 12) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [] as RecentFornecedorDocumentOption[];
  }
  const digits = normalizedQuery.replace(/\D/g, "");
  const like = `%${normalizedQuery}%`;
  const digitsLike = digits ? `%${digits}%` : like;

  const pessoas = db
    .prepare(
      `
        SELECT
          id,
          COALESCE(nome, 'Sem nome') AS nome,
          cpf AS hint,
          'pessoa' AS tipo,
          updated_at
        FROM pessoas
        WHERE tipo_fornecedor = 'S'
          AND (
            COALESCE(nome, '') LIKE ?
            OR REPLACE(REPLACE(REPLACE(COALESCE(cpf, ''), '.', ''), '-', ''), '/', '') LIKE ?
          )
        ORDER BY datetime(updated_at) DESC, id DESC
        LIMIT ?
      `,
    )
    .all(like, digitsLike, limit) as Array<
      RecentFornecedorDocumentOption & { updated_at: string }
    >;

  const companhias = db
    .prepare(
      `
        SELECT
          id,
          COALESCE(companhia, nome, 'Sem companhia') AS nome,
          iata AS hint,
          'companhia' AS tipo,
          updated_at
        FROM companhias
        WHERE
          COALESCE(companhia, '') LIKE ?
          OR COALESCE(nome, '') LIKE ?
          OR COALESCE(iata, '') LIKE ?
        ORDER BY datetime(updated_at) DESC, id DESC
        LIMIT ?
      `,
    )
    .all(like, like, like, limit) as Array<
      RecentFornecedorDocumentOption & { updated_at: string }
    >;

  return [...companhias, ...pessoas]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, limit)
    .map((item) => ({
      hint: item.hint,
      id: item.id,
      nome: item.nome,
      tipo: item.tipo,
    }));
}

export function getOrcamentoDocumentSource(
  orcamentoId: string,
): OrcamentoDocumentSource | null {
  const row = db
    .prepare(
      `
        SELECT
          o.id,
          o.identificador,
          o.created_at_source,
          o.raw_json,
          p.nome AS pessoa_nome,
          p.email AS pessoa_email,
          p.cpf AS pessoa_cpf,
          p.nascimento AS pessoa_nascimento,
          p.endereco AS pessoa_endereco,
          p.numero AS pessoa_numero,
          p.bairro AS pessoa_bairro,
          p.cidade AS pessoa_cidade,
          p.estado AS pessoa_estado,
          p.cep AS pessoa_cep,
          (
            SELECT group_concat(company_name, ' | ')
            FROM (
              SELECT DISTINCT COALESCE(inner_comp.companhia, inner_comp.nome, inner_v.companhia_nome) AS company_name
              FROM voos inner_v
              LEFT JOIN companhias inner_comp ON inner_comp.id = inner_v.companhia_id
              WHERE inner_v.orcamento_id = o.id
                AND NULLIF(COALESCE(inner_comp.companhia, inner_comp.nome, inner_v.companhia_nome), '') IS NOT NULL
              ORDER BY COALESCE(inner_comp.companhia, inner_comp.nome, inner_v.companhia_nome) ASC
            )
          ) AS voo_fornecedores,
          COALESCE(comp.companhia, comp.nome, first_voo.companhia_nome) AS voo_fornecedor,
          first_voo.localizador AS voo_localizador,
          sl.nome AS solicitacao_nome,
          sl.email AS solicitacao_email,
          sl.telefone AS solicitacao_telefone,
          sl.data_solicitacao,
          COALESCE(
            p.nome,
            NULLIF(json_extract(o.raw_json, '$.nome_cliente'), ''),
            NULLIF(json_extract(o.raw_json, '$.cliente_nome'), ''),
            sl.nome
          ) AS cliente_nome,
          COALESCE(
            p.email,
            NULLIF(json_extract(o.raw_json, '$.email_cliente'), ''),
            sl.email
          ) AS cliente_email,
          COALESCE(
            NULLIF(json_extract(o.raw_json, '$.telefone_cliente'), ''),
            sl.telefone
          ) AS cliente_telefone,
          COALESCE(
            p.cpf,
            NULLIF(json_extract(o.raw_json, '$.cpf_cliente'), '')
          ) AS cliente_cpf
        FROM orcamentos o
        LEFT JOIN pessoas p ON p.id = o.cliente_pessoa_id
        LEFT JOIN voos first_voo ON first_voo.id = (
          SELECT inner_v.id
          FROM voos inner_v
          WHERE inner_v.orcamento_id = o.id
          ORDER BY date(COALESCE(inner_v.data_embarque, '9999-12-31')) ASC,
                   time(COALESCE(inner_v.hora_embarque, '23:59:59')) ASC,
                   inner_v.id ASC
          LIMIT 1
        )
        LEFT JOIN companhias comp ON comp.id = first_voo.companhia_id
        LEFT JOIN solicitacoes sl ON sl.id = (
          SELECT inner_sl.id
          FROM solicitacoes inner_sl
          WHERE inner_sl.linked_orcamento_id = o.id
          ORDER BY datetime(inner_sl.updated_at) DESC, inner_sl.id DESC
          LIMIT 1
        )
        WHERE o.id = ?
      `,
    )
    .get(orcamentoId) as
    | {
        cliente_cpf: string | null;
        pessoa_bairro: string | null;
        pessoa_cidade: string | null;
        pessoa_cep: string | null;
        pessoa_nascimento: string | null;
        cliente_email: string | null;
        pessoa_endereco: string | null;
        pessoa_estado: string | null;
        cliente_nome: string | null;
        pessoa_numero: string | null;
        cliente_telefone: string | null;
        created_at_source: string | null;
        id: string;
        identificador: string | null;
        pessoa_cpf: string | null;
        pessoa_email: string | null;
        pessoa_nome: string | null;
        voo_fornecedor: string | null;
        voo_fornecedores: string | null;
        voo_localizador: string | null;
        raw_json: string;
        data_solicitacao: string | null;
        solicitacao_email: string | null;
        solicitacao_nome: string | null;
        solicitacao_telefone: string | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    clienteBairro: row.pessoa_bairro,
    clienteCep: row.pessoa_cep,
    clienteCidade: row.pessoa_cidade,
    clienteCpf: row.cliente_cpf,
    clienteEmail: row.cliente_email,
    clienteEndereco: row.pessoa_endereco,
    clienteEstado: row.pessoa_estado,
    clienteNascimento: row.pessoa_nascimento,
    clienteNome: row.cliente_nome ?? "Cliente",
    clienteNumero: row.pessoa_numero,
    clienteTelefone: row.cliente_telefone,
    createdAt: row.created_at_source,
    id: row.id,
    identificador: row.identificador,
    pessoaCpf: row.pessoa_cpf,
    pessoaEmail: row.pessoa_email,
    pessoaNome: row.pessoa_nome,
    raw: parseNullableRawJson(row.raw_json),
    solicitacaoData: row.data_solicitacao,
    solicitacaoEmail: row.solicitacao_email,
    solicitacaoNome: row.solicitacao_nome,
    solicitacaoTelefone: row.solicitacao_telefone,
    vooFornecedor: row.voo_fornecedor,
    vooFornecedores: parseGroupedValues(row.voo_fornecedores),
    vooLocalizador: row.voo_localizador,
  };
}

export function getPessoaDocumentSource(pessoaId: string): PessoaDocumentSource | null {
  const row = db
    .prepare(
      `
        SELECT
          id,
          nome,
          email,
          cpf,
          celular,
          nascimento,
          endereco,
          numero,
          complemento,
          bairro,
          cidade,
          estado,
          cep,
          passaporte,
          created_at_source,
          raw_json
        FROM pessoas
        WHERE id = ?
      `,
    )
    .get(pessoaId) as
    | {
        bairro: string | null;
        celular: string | null;
        cep: string | null;
        cidade: string | null;
        complemento: string | null;
        cpf: string | null;
        created_at_source: string | null;
        email: string | null;
        endereco: string | null;
        estado: string | null;
        id: string;
        nascimento: string | null;
        nome: string | null;
        numero: string | null;
        passaporte: string | null;
        raw_json: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    bairro: row.bairro,
    celular: row.celular,
    cep: row.cep,
    cidade: row.cidade,
    complemento: row.complemento,
    cpf: row.cpf,
    createdAt: row.created_at_source,
    email: row.email,
    endereco: row.endereco,
    estado: row.estado,
    id: row.id,
    nascimento: row.nascimento,
    nome: row.nome,
    numero: row.numero,
    passaporte: row.passaporte,
    raw: parseNullableRawJson(row.raw_json),
  };
}

function parseNullableRawJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function parseGroupedValues(value: string | null) {
  return (value ?? "")
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);
}

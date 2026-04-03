import { db } from "@/lib/db";
import type { DocumentSignatureRequestRecord } from "@/lib/clicksign/types";
import type {
  DocumentTemplateRecord,
  DocumentRecord,
  OrcamentoDocumentSource,
  RecentFornecedorDocumentOption,
  PessoaDocumentSource,
  RecentPessoaDocumentOption,
  RecentOrcamentoDocumentOption,
} from "@/lib/documents/types";

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
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT ?
      `,
    )
    .all(limit) as DocumentRecord[];
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
  return db
    .prepare(
      `
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
        WHERE document_record_id = ?
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT 1
      `,
    )
    .get(documentRecordId) as DocumentSignatureRequestRecord | undefined;
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
    input.provider_envelope_id ?? current.provider_envelope_id,
    input.provider_document_id ?? current.provider_document_id,
    input.status ?? current.status,
    input.signers_json ?? current.signers_json,
    input.signature_links_json ?? current.signature_links_json,
    input.last_error ?? current.last_error,
    input.raw_response_json ?? current.raw_response_json,
    input.updated_at ?? current.updated_at,
    input.sent_at ?? current.sent_at,
    input.signed_at ?? current.signed_at,
    id,
  );
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
          vw.id LIKE ?
          OR COALESCE(vw.identificador, '') LIKE ?
          OR COALESCE(vw.cliente_nome_db, vw.solicitacao_nome, '') LIKE ?
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

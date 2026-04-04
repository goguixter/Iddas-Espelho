import { normalizeDocumentNumber } from "@/lib/documents/formatters";
import type { ClicksignSignerInput } from "@/lib/clicksign/types";

const DEFAULT_COMMUNICATE_EVENTS = {
  document_signed: "email",
  signature_reminder: "email",
  signature_request: "email",
} as const;

const NOTIFICATION_DATA = {
  attributes: {},
  type: "notifications",
} as const;

export function buildEnvelopePayload(title: string) {
  return {
    data: {
      type: "envelopes",
      attributes: {
        auto_close: true,
        block_after_refusal: false,
        deadline_at: buildEnvelopeDeadlineAt(),
        default_message: buildDefaultEnvelopeMessage(title),
        default_subject: buildDefaultEnvelopeSubject(title),
        locale: "pt-BR",
        name: title,
        remind_interval: 3,
      },
    },
  };
}

export function buildDocumentPayload(title: string, base64: string) {
  return {
    data: {
      type: "documents",
      attributes: {
        content_base64: base64,
        filename: `${sanitizeFilename(title)}.pdf`,
      },
    },
  };
}

export function buildSignerPayload(signer: ClicksignSignerInput) {
  return {
    data: {
      type: "signers",
      attributes: {
        birthday: normalizeBirthday(signer.birthday),
        communicate_events: DEFAULT_COMMUNICATE_EVENTS,
        documentation: normalizeDocumentNumber(signer.documentation),
        email: signer.email,
        group: 1,
        has_documentation: signer.has_documentation ?? Boolean(signer.documentation),
        location_required_enabled: false,
        name: signer.name,
        refusable: false,
      },
    },
  };
}

export function buildQualificationRequirementPayload(
  documentId: string,
  signerId: string,
  role: ClicksignSignerInput["qualificationRole"],
) {
  return {
    data: {
      type: "requirements",
      attributes: {
        action: "agree",
        role,
      },
      relationships: {
        document: {
          data: { id: documentId, type: "documents" },
        },
        signer: {
          data: { id: signerId, type: "signers" },
        },
      },
    },
  };
}

export function buildAuthRequirementPayload(documentId: string, signerId: string) {
  return {
    data: {
      type: "requirements",
      attributes: {
        action: "provide_evidence",
        auth: "email",
      },
      relationships: {
        document: {
          data: { id: documentId, type: "documents" },
        },
        signer: {
          data: { id: signerId, type: "signers" },
        },
      },
    },
  };
}

export function buildEnvelopeStatusPayload(envelopeId: string) {
  return {
    data: {
      type: "envelopes",
      id: envelopeId,
      attributes: {
        status: "running",
      },
    },
  };
}

export function buildNotificationPayload() {
  return {
    data: NOTIFICATION_DATA,
  };
}

export function normalizeBirthday(value: string | null | undefined) {
  const raw = value?.trim();

  if (!raw) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");
    return `${year}-${month}-${day}`;
  }

  return raw;
}

function buildEnvelopeDeadlineAt() {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  return deadline.toISOString();
}

function buildDefaultEnvelopeSubject(title: string) {
  const subject = `Assinatura pendente: ${title}`.trim();
  return subject.slice(0, 100);
}

function buildDefaultEnvelopeMessage(title: string) {
  return `Olá, este documento foi disponibilizado para assinatura: ${title}. Por favor, revise e conclua a assinatura.`;
}

function sanitizeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

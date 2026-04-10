import { normalizeDocumentNumber } from "@/lib/documents/formatters";
import type { ClicksignSignerInput } from "@/lib/clicksign/types";

const DEFAULT_COMMUNICATE_EVENTS = {
  document_signed: "email",
  signature_reminder: "email",
  signature_request: "email",
} as const;

export function buildEnvelopePayload(title: string) {
  return {
    data: {
      type: "envelopes",
      attributes: {
        auto_close: true,
        block_after_refusal: false,
        deadline_at: buildEnvelopeDeadlineAt(),
        default_message: buildDefaultEnvelopeMessage(),
        default_subject: buildDefaultEnvelopeSubject(),
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

export function buildDocumentStatusPayload(
  documentId: string,
  status: "canceled",
) {
  return {
    data: {
      type: "documents",
      attributes: {
        status,
      },
      id: documentId,
    },
  };
}

export function buildNotificationPayload() {
  return {
    data: {
      type: "notifications",
      attributes: {
        message: "Seu contrato de viagem está disponível para assinatura digital.",
        email_customization: {
          subject: "Seu contrato de viagem está pronto para assinatura ✈️",
          head: "Finalize sua viagem com segurança",
          greeting: "Olá, tudo bem? 😊",
          principal:
            "Seu contrato já está disponível para assinatura, com todas as condições da sua viagem devidamente formalizadas. Para dar continuidade ao seu atendimento e garantir sua reserva, basta realizar a assinatura digital no link abaixo. O processo é rápido, seguro e pode ser feito diretamente pelo celular ou computador.",
          button: "Assinar contrato agora",
          final:
            "Após a assinatura, nossa equipe seguirá com todo o acompanhamento da sua viagem, garantindo uma experiência tranquila do início ao embarque. Se precisar de qualquer suporte, estamos à disposição 🤝✈️",
          align: "center",
          show_token: false,
          show_qrcode: false,
          show_details: true,
        },
      },
    },
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

function buildDefaultEnvelopeSubject() {
  return "Seu contrato de viagem está pronto para assinatura ✈️";
}

function buildDefaultEnvelopeMessage() {
  return [
    "Olá, tudo bem? 😊",
    "",
    "Preparamos o seu contrato referente à sua viagem com a Confins do Mundo Viagens.",
    "",
    "Para dar andamento na sua reserva e garantir todas as condições alinhadas, basta realizar a assinatura digital no link enviado neste e-mail.",
    "",
    "O processo é rápido, seguro e pode ser feito diretamente pelo celular ou computador.",
    "",
    "Caso tenha qualquer dúvida antes de assinar, fico à disposição para te auxiliar 😊",
    "",
    "Seguimos acompanhando toda a sua viagem de perto, desde agora até o seu embarque ✈️",
  ].join("\n");
}

function sanitizeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

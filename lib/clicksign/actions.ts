export type DocumentSignatureActionState = {
  providerDocumentId?: string | null;
  providerEnvelopeId?: string | null;
  sentAt?: string | null;
  status?: string | null;
} | null | undefined;

export function buildDocumentSignatureActionState(input: {
  providerDocumentId?: string | null;
  providerEnvelopeId?: string | null;
  sentAt?: string | null;
  status?: string | null;
} | null | undefined): DocumentSignatureActionState {
  if (!input) {
    return null;
  }

  return {
    providerDocumentId: input.providerDocumentId ?? null,
    providerEnvelopeId: input.providerEnvelopeId ?? null,
    sentAt: input.sentAt ?? null,
    status: input.status ?? null,
  };
}

export function canSendDocumentToClicksign(input: DocumentSignatureActionState) {
  return !isDocumentSignatureLocked(input);
}

export function canCancelDocumentSignature(input: DocumentSignatureActionState) {
  const status = normalizeStatus(input?.status);
  return (
    Boolean(input?.providerEnvelopeId) &&
    Boolean(input?.providerDocumentId) &&
    !["canceled", "refused", "signed", "closed", "deleted"].includes(status)
  );
}

export function canDeleteDraftDocumentSignature(input: DocumentSignatureActionState) {
  const status = normalizeStatus(input?.status);
  return (
    Boolean(input?.providerEnvelopeId) &&
    Boolean(input?.providerDocumentId) &&
    ["processing", "failed", "created"].includes(status)
  );
}

export function isDocumentSignatureLocked(input: DocumentSignatureActionState) {
  if (!input) {
    return false;
  }

  if (input.sentAt || input.providerEnvelopeId || input.providerDocumentId) {
    return true;
  }

  return ["processing", "sent", "running", "signed", "canceled", "refused", "closed", "deleted"]
    .includes(normalizeStatus(input.status));
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase();
}

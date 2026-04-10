import {
  buildDocumentSignatureActionState,
} from "@/lib/clicksign/actions";
import { deriveClicksignSignatureState } from "@/lib/clicksign/state";

type DocumentSignatureSummaryInput = {
  currentStatus?: string | null;
  documentCreatedAt?: string | null;
  rawResponseJson?: string | null;
  signersJson?: string | null;
};

export function buildDocumentSignatureSummary(
  documentCreatedAt: string | null | undefined,
  signersJson: string | null | undefined,
  rawResponseJson: string | null | undefined,
  currentStatus?: string | null,
) {
  return deriveClicksignSignatureState({
    currentStatus,
    documentCreatedAt,
    rawResponseJson,
    signersJson,
  });
}

export function buildDocumentSignatureViewModel(input: {
  documentCreatedAt?: string | null;
  request?: {
    lastError?: string | null;
    providerDocumentId?: string | null;
    providerEnvelopeId?: string | null;
    rawResponseJson?: string | null;
    sentAt?: string | null;
    signersJson?: string | null;
    status?: string | null;
  } | null;
}) {
  const request = input.request ?? null;
  const summary = buildSummaryFromInput({
    currentStatus: request?.status,
    documentCreatedAt: input.documentCreatedAt,
    rawResponseJson: request?.rawResponseJson,
    signersJson: request?.signersJson,
  });

  return {
    actionState: buildDocumentSignatureActionState({
      providerDocumentId: request?.providerDocumentId,
      providerEnvelopeId: request?.providerEnvelopeId,
      sentAt: request?.sentAt,
      status: request?.status,
    }),
    error: request?.lastError ?? null,
    signedNames: summary.signers.filter((item) => item.signed).map((item) => item.name),
    summary,
  };
}

function buildSummaryFromInput(input: DocumentSignatureSummaryInput) {
  return deriveClicksignSignatureState({
    currentStatus: input.currentStatus,
    documentCreatedAt: input.documentCreatedAt,
    rawResponseJson: input.rawResponseJson,
    signersJson: input.signersJson,
  });
}

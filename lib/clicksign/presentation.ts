import { deriveClicksignSignatureState } from "@/lib/clicksign/state";

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

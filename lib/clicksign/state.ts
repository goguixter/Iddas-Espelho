import type {
  DocumentSignatureSignerStatus,
  DocumentSignatureTimelineItem,
} from "@/lib/documents/types";

type ClicksignRawState = {
  documentId?: string | null;
  documentSnapshot?: Record<string, unknown> | null;
  envelopeId?: string | null;
  lastWebhook?: Record<string, unknown> | null;
  send?: Record<string, unknown> | null;
  webhookEvents?: Record<string, unknown>[];
};

type NormalizedEvent = {
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  eventName: string;
  occurredAt: string | null;
  signerUrl: string | null;
};

const VISIBLE_TIMELINE_EVENTS = new Set([
  "add_signer",
  "auto_close",
  "cancel",
  "close",
  "custom",
  "deadline",
  "document_closed",
  "document_created",
  "refusal",
  "sign",
  "signature_started",
  "upload",
]);

export function deriveClicksignSignatureState({
  currentStatus,
  documentCreatedAt,
  rawResponseJson,
  signersJson,
}: {
  currentStatus?: string | null;
  documentCreatedAt?: string | null;
  rawResponseJson?: string | null;
  signersJson?: string | null;
}) {
  const state = parseClicksignRawState(rawResponseJson);
  const normalizedEvents = collectNormalizedEvents(state);
  const documentStatus = extractDocumentStatus(state) ?? normalizeString(currentStatus);
  const persistedSigners = parseStoredSigners(signersJson);
  const snapshotSigners = extractDocumentSigners(state);
  const signers = mergeSignerStatuses(persistedSigners, snapshotSigners);
  const signatureLinks = collectSignatureLinks(state, normalizedEvents);
  const signedEmails = new Set(
    normalizedEvents
      .filter((item) => item.eventName === "sign" && item.actorEmail)
      .map((item) => item.actorEmail as string),
  );

  const signerStatuses = mergeSignerStatuses(
    signers.map((item) => ({
      ...item,
      signed: signedEmails.has(item.email.toLowerCase()),
    })),
    normalizedEvents
      .filter((item) => item.eventName === "sign" && item.actorEmail && item.actorName)
      .map((item) => ({
        email: item.actorEmail!.toLowerCase(),
        name: item.actorName!,
        signed: true,
      })),
  );

  const sentAt = normalizedEvents
    .filter((item) => item.eventName === "upload" || item.eventName === "add_signer" || item.eventName === "custom")
    .map((item) => item.occurredAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;

  const signedAt = normalizedEvents
    .filter((item) => item.eventName === "sign")
    .map((item) => item.occurredAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  const timeline = buildTimeline(documentCreatedAt, normalizedEvents);
  const effectiveStatus = resolveSignatureStatus({
    currentStatus,
    documentStatus,
    eventNames: new Set(normalizedEvents.map((item) => item.eventName)),
    signedAll:
      signerStatuses.length > 0 &&
      signerStatuses.every((item) => item.signed),
    signedCount: signerStatuses.filter((item) => item.signed).length,
  });

  return {
    documentStatus,
    sentAt,
    signatureLinks,
    signedAt,
    signers: signerStatuses,
    status: effectiveStatus,
    timeline,
  };
}

export function mergeClicksignRawState(
  currentRawResponseJson: string | null | undefined,
  patch: {
    documentId?: string | null;
    documentSnapshot?: Record<string, unknown> | null;
    envelopeId?: string | null;
    lastWebhook?: Record<string, unknown> | null;
    send?: Record<string, unknown> | null;
    webhookEvent?: Record<string, unknown> | null;
  },
) {
  const current = parseClicksignRawState(currentRawResponseJson);
  const nextWebhookEvents = dedupeObjects([
    ...(current.webhookEvents ?? []),
    ...(patch.webhookEvent ? [patch.webhookEvent] : []),
  ]);

  const next: ClicksignRawState = {
    documentId: patch.documentId ?? current.documentId ?? null,
    documentSnapshot: patch.documentSnapshot ?? current.documentSnapshot ?? null,
    envelopeId: patch.envelopeId ?? current.envelopeId ?? null,
    lastWebhook: patch.lastWebhook ?? current.lastWebhook ?? null,
    send: patch.send ?? current.send ?? null,
    webhookEvents: nextWebhookEvents,
  };

  return JSON.stringify(next);
}

function buildTimeline(
  documentCreatedAt: string | null | undefined,
  normalizedEvents: NormalizedEvent[],
) {
  const timeline: DocumentSignatureTimelineItem[] = [];

  if (normalizeString(documentCreatedAt)) {
    timeline.push({
      actorName: null,
      actorRole: "system",
      eventName: "document_created",
      occurredAt: normalizeDateTime(documentCreatedAt),
    });
  }

  for (const event of normalizedEvents) {
    if (!VISIBLE_TIMELINE_EVENTS.has(event.eventName)) {
      continue;
    }

    timeline.push({
      actorName: event.actorName,
      actorRole: event.actorRole ?? event.actorEmail,
      eventName: event.eventName,
      occurredAt: event.occurredAt,
    });
  }

  return dedupeTimeline(timeline).sort(compareTimelineAsc);
}

function collectSignatureLinks(
  state: ClicksignRawState,
  normalizedEvents: NormalizedEvent[],
) {
  const links: Record<string, string> = {};

  for (const signer of extractDocumentSigners(state)) {
    const key = signer.email.toLowerCase();
    if (signer.url) {
      links[key] = signer.url;
    }
  }

  for (const event of normalizedEvents) {
    if (event.actorEmail && event.signerUrl) {
      links[event.actorEmail.toLowerCase()] = event.signerUrl;
    }
  }

  return links;
}

function collectNormalizedEvents(state: ClicksignRawState) {
  return dedupeNormalizedEvents([
    ...normalizePayloadEvents(state.lastWebhook),
    ...normalizePayloadArray(state.webhookEvents),
    ...normalizePayloadEvents(state.documentSnapshot),
  ]);
}

function normalizePayloadArray(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((item) => normalizePayloadEvents(item));
}

function normalizePayloadEvents(payload: unknown) {
  const object = toObject(payload);
  if (!object) {
    return [];
  }

  const documentEvents = normalizeEventsArray(readObject(object, "document")?.events);
  const directEvents =
    documentEvents.length > 0 ? [] : normalizeEventCollection(object.event);
  return dedupeNormalizedEvents([...directEvents, ...documentEvents]);
}

function normalizeEventsArray(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .flatMap((item) => normalizeEventCollection(item))
    .filter((value): value is NormalizedEvent => Boolean(value));
}

function normalizeEventCollection(input: unknown) {
  const event = toObject(input);
  if (!event) {
    return [];
  }

  const eventName = normalizeString(event.name);
  if (!eventName) {
    return [];
  }

  const data = readObject(event, "data");
  const signer = readObject(data, "signer");
  const signers = readObjectArray(data, "signers");
  const user = readObject(data, "user");
  const occurredAt = normalizeDateTime(event.occurred_at);

  if (eventName === "add_signer" && signers.length > 0) {
    return signers
      .map((item) => normalizeSignerEvent(item, eventName, occurredAt))
      .filter((value): value is NormalizedEvent => value !== null);
  }

  return [{
    actorEmail: normalizeString(signer?.email)?.toLowerCase() ?? null,
    actorName: normalizeString(signer?.name) ?? normalizeString(user?.name),
    actorRole: normalizeString(signer?.sign_as),
    eventName,
    occurredAt,
    signerUrl: normalizeString(signer?.url),
  } satisfies NormalizedEvent];
}

function normalizeSignerEvent(
  input: Record<string, unknown>,
  eventName: string,
  occurredAt: string | null,
) {
  const email = normalizeString(input.email)?.toLowerCase();
  const name = normalizeString(input.name);

  if (!email && !name) {
    return null;
  }

  return {
    actorEmail: email ?? null,
    actorName: name ?? null,
    actorRole: normalizeString(input.sign_as),
    eventName,
    occurredAt,
    signerUrl: normalizeString(input.url),
  } satisfies NormalizedEvent;
}

function extractDocumentStatus(state: ClicksignRawState) {
  const lastWebhookDocument = readObject(state.lastWebhook, "document");

  return (
    normalizeString(state.documentSnapshot?.status) ??
    normalizeString(lastWebhookDocument?.status)
  );
}

function extractDocumentSigners(state: ClicksignRawState) {
  const lastWebhookDocument = readObject(state.lastWebhook, "document");
  const candidates = [
    ...normalizeDocumentSigners(state.documentSnapshot?.signers),
    ...normalizeDocumentSigners(lastWebhookDocument?.signers),
  ];

  return mergeDocumentSigners(candidates);
}

function normalizeDocumentSigners(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized = input
    .map((item) => {
      const signer = toObject(item);
      const email = normalizeString(signer?.email);
      const name = normalizeString(signer?.name);

      if (!email || !name) {
        return null;
      }

      return {
        email: email.toLowerCase(),
        name,
        signed: false,
        url: normalizeString(signer?.url),
      };
    });

  return normalized.filter(
    (
      value,
    ): value is DocumentSignatureSignerStatus & {
      url: string | null;
    } => value !== null,
  );
}

function parseStoredSigners(signersJson: string | null | undefined): DocumentSignatureSignerStatus[] {
  try {
    const parsed = JSON.parse(signersJson ?? "[]") as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized: Array<DocumentSignatureSignerStatus | null> = parsed
      .map((item) => {
        const email = normalizeString(item.email);
        const name = normalizeString(item.name);
        if (!email || !name) {
          return null;
        }

        return {
          email: email.toLowerCase(),
          name,
          signed: false,
        };
      });

    return normalized.filter((value): value is DocumentSignatureSignerStatus => value !== null);
  } catch {
    return [];
  }
}

function mergeSignerStatuses(
  primary: DocumentSignatureSignerStatus[],
  secondary: DocumentSignatureSignerStatus[],
) {
  const map = new Map<string, DocumentSignatureSignerStatus>();

  for (const signer of [...primary, ...secondary]) {
    const key = signer.email.toLowerCase();
    const current = map.get(key);
    map.set(key, {
      email: signer.email,
      name: signer.name,
      signed: signer.signed || current?.signed || false,
    });
  }

  return Array.from(map.values());
}

function mergeDocumentSigners(
  signers: Array<
    DocumentSignatureSignerStatus & {
      url: string | null;
    }
  >,
) {
  const map = new Map<
    string,
    DocumentSignatureSignerStatus & {
      url: string | null;
    }
  >();

  for (const signer of signers) {
    const key = signer.email.toLowerCase();
    const current = map.get(key);
    map.set(key, {
      email: signer.email,
      name: signer.name,
      signed: signer.signed || current?.signed || false,
      url: signer.url ?? current?.url ?? null,
    });
  }

  return Array.from(map.values());
}

function resolveSignatureStatus({
  currentStatus,
  documentStatus,
  eventNames,
  signedAll,
  signedCount,
}: {
  currentStatus?: string | null;
  documentStatus?: string | null;
  eventNames: Set<string>;
  signedAll: boolean;
  signedCount: number;
}) {
  const normalizedDocumentStatus = (documentStatus ?? "").toLowerCase();
  const normalizedCurrentStatus = (currentStatus ?? "").toLowerCase();

  if (!normalizedDocumentStatus && !eventNames.size) {
    return normalizedCurrentStatus || "created";
  }

  if (normalizedDocumentStatus === "cancelled" || normalizedDocumentStatus === "canceled") {
    return "canceled";
  }

  if (normalizedDocumentStatus === "closed") {
    return "signed";
  }

  if (eventNames.has("refusal")) {
    return "refused";
  }

  if (eventNames.has("cancel")) {
    return "canceled";
  }

  if (eventNames.has("auto_close") || eventNames.has("document_closed")) {
    return "signed";
  }

  if (eventNames.has("deadline")) {
    return signedCount > 0 ? "signed" : "canceled";
  }

  if (signedAll) {
    return "signed";
  }

  if (normalizedDocumentStatus === "running") {
    return signedCount > 0 || eventNames.has("signature_started") || eventNames.has("sign")
      ? "running"
      : "sent";
  }

  if (normalizedDocumentStatus === "draft") {
    return eventNames.has("upload") || eventNames.has("add_signer") ? "processing" : "created";
  }

  if (eventNames.has("signature_started") || eventNames.has("sign")) {
    return "running";
  }

  if (
    eventNames.has("upload") ||
    eventNames.has("add_signer") ||
    eventNames.has("custom") ||
    eventNames.has("update_deadline") ||
    eventNames.has("update_auto_close") ||
    eventNames.has("update_locale")
  ) {
    return "sent";
  }

  return normalizedCurrentStatus || "created";
}

function parseClicksignRawState(rawResponseJson: string | null | undefined) {
  try {
    const parsed = JSON.parse(rawResponseJson ?? "{}") as unknown;
    return (toObject(parsed) ?? {}) as ClicksignRawState;
  } catch {
    return {};
  }
}

function dedupeTimeline(items: DocumentSignatureTimelineItem[]) {
  const seen = new Set<string>();
  const result: DocumentSignatureTimelineItem[] = [];

  for (const item of items) {
    const key = `${item.eventName}|${item.occurredAt ?? ""}|${item.actorName ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function dedupeNormalizedEvents(items: NormalizedEvent[]) {
  const seen = new Set<string>();
  const result: NormalizedEvent[] = [];

  for (const item of items) {
    const key = `${item.eventName}|${item.occurredAt ?? ""}|${item.actorName ?? ""}|${item.actorEmail ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function dedupeObjects(items: Record<string, unknown>[]) {
  const seen = new Set<string>();
  const result: Record<string, unknown>[] = [];

  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function compareTimelineAsc(left: DocumentSignatureTimelineItem, right: DocumentSignatureTimelineItem) {
  return (left.occurredAt ?? "").localeCompare(right.occurredAt ?? "");
}

function toObject(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function readObject(input: unknown, key: string) {
  const object = toObject(input);
  return toObject(object?.[key]);
}

function readObjectArray(input: unknown, key: string) {
  const object = toObject(input);
  const value = object?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDateTime(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return date.toISOString();
}

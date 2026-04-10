import type { DocumentRecord } from "@/lib/documents/types";

export function getDocumentEntityLabel(record: Pick<DocumentRecord, "entity_id" | "entity_type">) {
  if (record.entity_type === "orcamento") {
    return `Orçamento ${record.entity_id}`;
  }

  if (record.entity_type === "manual") {
    if (record.entity_id && record.entity_id !== "manual") {
      return `Documento manual • Contratante ${record.entity_id}`;
    }

    return "Documento manual";
  }

  return record.entity_id;
}

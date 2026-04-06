export type ClicksignSignerInput = {
  birthday?: string | null;
  documentation?: string | null;
  email: string;
  has_documentation?: boolean;
  name: string;
  qualificationRole: "contractee" | "contractor";
};

export type DocumentSignatureRequestRecord = {
  created_at: string;
  document_record_id: number;
  id: number;
  last_error: string | null;
  provider: string;
  provider_document_id: string | null;
  provider_envelope_id: string | null;
  raw_response_json: string;
  signature_links_json: string;
  signed_at: string | null;
  signers_json: string;
  sent_at: string | null;
  status: string;
  updated_at: string;
};

export type DocumentSignatureEventRecord = {
  created_at: string;
  id: string;
  payload_json: string;
  provider_created_at: string | null;
  provider_event_type: string;
  signature_request_id: number;
  updated_at: string;
};

/** Shared types between frontend and backend verification flow. */

export type Verdict = "CONSISTENT" | "SUSPICIOUS" | "INCONCLUSIVE";

export interface SourceReport {
  name: string;
  url: string;
  reachable: boolean;
  found: boolean;
  reported: Record<string, string>;
}

export interface JudgeReport {
  role: string;
  label: string;
  verdict: Verdict;
  summary: string;
  reasoning: string;
}

export interface VerificationResult {
  barcode: string;
  verdict: Verdict;
  product_name: string;
  brand: string;
  manufacturer: string;
  attributes: {
    quantity: string;
    category: string;
    notes: string;
  };
  evidence_summary: string;
  consensus_summary: string;
  explanation: string;
  sources: SourceReport[];
  judges: Record<string, JudgeReport>;
  created_at?: number;
}

export interface VerifyResponseOk {
  ok: true;
  mode: "REAL_STUDIONET" | "DEVELOPMENT_DEMO";
  result: VerificationResult;
  tx_hash?: string;
}

export interface VerifyResponseErr {
  ok: false;
  error: string;
  code:
    | "invalid_barcode"
    | "rate_limited"
    | "not_configured"
    | "contract_error"
    | "timeout"
    | "backend_unavailable";
}

export type VerifyResponse = VerifyResponseOk | VerifyResponseErr;

/** Local scan history entry (stored in localStorage). */
export interface HistoryEntry {
  id: string;
  barcode: string;
  productName: string;
  verdict: Verdict;
  timestamp: number;
  mode: "REAL_STUDIONET" | "DEVELOPMENT_DEMO";
}

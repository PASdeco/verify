import "server-only";

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { VerificationResult } from "@/types/verification";

/**
 * Server-only GenLayer contract client.
 *
 * The relayer private key lives ONLY here (loaded from env at server
 * start). Nothing in this module is ever imported by client code.
 * The frontend can request exactly one operation: verify a barcode.
 */

export interface VerifierConfig {
  rpc: string;
  privateKey: `0x${string}`;
  contractAddress: `0x${string}`;
}

export function verifierConfigured(): boolean {
  return Boolean(
    process.env.RELAYER_PRIVATE_KEY && process.env.GENLAYER_CONTRACT_ADDRESS
  );
}

function getConfig(): VerifierConfig {
  const privateKey = process.env.RELAYER_PRIVATE_KEY as
    | `0x${string}`
    | undefined;
  const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS as
    | `0x${string}`
    | undefined;
  if (!privateKey || !contractAddress) {
    throw new ConfigError();
  }
  return {
    rpc: process.env.GENLAYER_RPC || "",
    privateKey,
    contractAddress,
  };
}

export class ConfigError extends Error {
  constructor() {
    super("GenLayer verifier is not configured");
  }
}

export class ContractRevertError extends Error {
  constructor(
    message: string,
    public readonly revertReason: string
  ) {
    super(message);
  }
}

/** Normalized shape returned by the contract's write + view paths. */
interface RawContractResult {
  barcode?: string;
  verdict?: string;
  product_name?: string;
  brand?: string;
  manufacturer?: string;
  attributes?: Record<string, unknown>;
  evidence_summary?: string;
  consensus_summary?: string;
  explanation?: string;
  sources?: unknown;
  judges?: unknown;
  created_at?: number;
}

const VALID_VERDICTS = ["CONSISTENT", "SUSPICIOUS", "INCONCLUSIVE"];

function normalize(raw: RawContractResult, fallbackBarcode: string): VerificationResult {
  return {
    barcode: String(raw.barcode ?? fallbackBarcode),
    verdict:
      raw.verdict && VALID_VERDICTS.includes(String(raw.verdict))
        ? (raw.verdict as VerificationResult["verdict"])
        : "INCONCLUSIVE",
    product_name: String(raw.product_name ?? ""),
    brand: String(raw.brand ?? ""),
    manufacturer: String(raw.manufacturer ?? ""),
    attributes: {
      quantity: String(raw.attributes?.quantity ?? ""),
      category: String(raw.attributes?.category ?? ""),
      notes: String(raw.attributes?.notes ?? ""),
    },
    evidence_summary: String(raw.evidence_summary ?? ""),
    consensus_summary: String(raw.consensus_summary ?? ""),
    explanation: String(raw.explanation ?? ""),
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    judges:
      raw.judges && typeof raw.judges === "object"
        ? (raw.judges as VerificationResult["judges"])
        : {},
    created_at: typeof raw.created_at === "number" ? raw.created_at : undefined,
  };
}

async function getClient() {
  const cfg = getConfig();
  return createClient({
    chain: studionet,
    account: createAccount(cfg.privateKey),
  });
}

/**
 * Submit a verification through the funded relayer and wait for consensus.
 * Studionet jury runs are SLOW — use a generous wait ceiling.
 */
export async function submitVerification(
  barcode: string
): Promise<{ result: VerificationResult; txHash?: string }> {
  const client = await getClient();
  const cfg = getConfig();

  // If this barcode was verified before, read the stored result instead of
  // re-running the (expensive, slow) investigation pipeline.
  try {
    const existing = (await client.readContract({
      address: cfg.contractAddress,
      functionName: "get_verification",
      args: [barcode],
    })) as unknown as RawContractResult;

    if (existing && existing.verdict) {
      return { result: normalize(existing, barcode) };
    }
  } catch (err) {
    // Expected when no stored verification exists — fall through to write.
    if (!(err instanceof Error) || !/No stored verification|EXPECTED|revert/i.test(err.message)) {
      logContractError("read get_verification failed unexpectedly", err);
    }
  }

  let txHash: string;
  try {
    txHash = await client.writeContract({
      address: cfg.contractAddress,
      functionName: "verify_product",
      args: [barcode],
      value: 0n,
    });
  } catch (err) {
    logContractError("writeContract verify_product failed", err);
    throw new ContractRevertError(
      "The verification could not be submitted.",
      err instanceof Error ? err.message : String(err)
    );
  }

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash as unknown as Parameters<typeof client.waitForTransactionReceipt>[0]["hash"],
    status: TransactionStatus.ACCEPTED,
    interval: 3000,
    retries: 300, // ~15 min ceiling: studionet consensus runs take minutes
  });

  if (receipt.txExecutionResultName === "FINISHED_WITH_ERROR") {
    const reason = String(
      (receipt as Record<string, unknown>).revert_reason ?? "unknown revert"
    );
    throw new ContractRevertError("Verification reverted on-chain.", reason);
  }

  const result = (await client.readContract({
    address: cfg.contractAddress,
    functionName: "get_verification",
    args: [barcode],
  })) as unknown as RawContractResult;

  return { result: normalize(result, barcode), txHash };
}

/** Secure server-side logging — never logs secrets or key material. */
function logContractError(context: string, err: unknown) {
  console.error(
    `[verify:contract] ${context}:`,
    err instanceof Error ? err.message : err
  );
}

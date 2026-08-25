import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidGtin, normalizeBarcode } from "@/lib/utils";
import { rateLimitAllowed } from "@/server/rate-limit";
import {
  verifierConfigured,
  submitVerification,
  ConfigError,
  ContractRevertError,
} from "@/server/genlayer-verifier";
import { demoVerification } from "@/server/demo-verifier";

/**
 * POST /api/verify — the ONLY contract-facing endpoint.
 * The frontend can never specify contract address, method, or calldata.
 */
export async function POST(req: NextRequest) {
  // --- Rate limiting (relayer abuse protection) ---
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!rateLimitAllowed(ip)) {
    return NextResponse.json(
      {
        ok: false,
        code: "rate_limited",
        error: "Too many verifications right now. Please wait a minute and try again.",
      },
      { status: 429 }
    );
  }

  // --- Input validation ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be JSON with a barcode field.");
  }

  const barcodeRaw = (body as { barcode?: unknown })?.barcode;
  if (typeof barcodeRaw !== "string" || barcodeRaw.trim().length === 0) {
    return badRequest("A product barcode is required.");
  }
  const barcode = normalizeBarcode(barcodeRaw);
  if (!isValidGtin(barcode)) {
    return badRequest(
      "That doesn't look like a valid product barcode. Use digits only, 6-18 characters."
    );
  }

  // --- Mode selection ---
  const mode =
    process.env.VERIFY_MODE === "REAL_STUDIONET"
      ? "REAL_STUDIONET"
      : "DEVELOPMENT_DEMO";

  if (mode === "DEVELOPMENT_DEMO") {
    // Simulated result — always explicitly labelled in the response AND UI.
    return NextResponse.json({
      ok: true,
      mode,
      result: demoVerification(barcode),
    });
  }

  // --- REAL_STUDIONET path ---
  if (!verifierConfigured()) {
    logSecurely("REAL_STUDIONET requested but relayer env vars are missing");
    return NextResponse.json(
      {
        ok: false,
        code: "not_configured",
        error:
          "Verification is temporarily unavailable. The service isn't fully configured.",
      },
      { status: 503 }
    );
  }

  try {
    const { result, txHash } = await submitVerification(barcode);
    return NextResponse.json({ ok: true, mode, result, tx_hash: txHash });
  } catch (err) {
    if (err instanceof ContractRevertError) {
      // Map expected contract reverts to human-readable errors.
      if (/6-18 digits|must be/i.test(err.revertReason)) {
        return badRequest("That doesn't look like a valid product barcode.");
      }
      logSecurely(`contract revert: ${err.revertReason}`);
      return NextResponse.json(
        {
          ok: false,
          code: "contract_error",
          error:
            "The investigation couldn't be completed this time. Please try again.",
        },
        { status: 502 }
      );
    }
    if (err instanceof ConfigError) {
      return NextResponse.json(
        {
          ok: false,
          code: "not_configured",
          error:
            "Verification is temporarily unavailable. The service isn't fully configured.",
        },
        { status: 503 }
      );
    }
    logSecurely(
      `unexpected error: ${err instanceof Error ? err.message : String(err)}`
    );
    return NextResponse.json(
      {
        ok: false,
        code: "backend_unavailable",
        error: "Verification couldn't be completed right now. Please try again.",
      },
      { status: 500 }
    );
  }
}

/** Server-side logging that never echoes secrets or raw request data. */
function logSecurely(message: string) {
  console.error(`[verify:api] ${message}`);
}

function badRequest(error: string) {
  return NextResponse.json(
    { ok: false, code: "invalid_barcode", error },
    { status: 400 }
  );
}

export function GET() {
  return NextResponse.json(
    { ok: false, code: "invalid_barcode", error: "Use POST with a JSON body." },
    { status: 405 }
  );
}

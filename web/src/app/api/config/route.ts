import { NextResponse } from "next/server";

/**
 * GET /api/config — non-secret network info for the Settings/About screen.
 * Exposes nothing sensitive: mode, network name, and the public contract
 * address. Never touches the relayer key.
 */
export async function GET() {
  const configured = Boolean(process.env.GENLAYER_CONTRACT_ADDRESS);
  return NextResponse.json({
    mode:
      process.env.VERIFY_MODE === "REAL_STUDIONET"
        ? "REAL_STUDIONET"
        : "DEVELOPMENT_DEMO",
    network: process.env.GENLAYER_NETWORK || "studionet",
    contract_address: configured
      ? process.env.GENLAYER_CONTRACT_ADDRESS
      : null,
  });
}

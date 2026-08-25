import type { VerifyResponse } from "@/types/verification";

/**
 * Frontend verification client.
 * Talks ONLY to our backend /api/verify. Never to GenLayer directly —
 * the backend relayer owns all contract interaction.
 */
export async function requestVerification(
  barcode: string,
  signal?: AbortSignal
): Promise<VerifyResponse> {
  let res: Response;
  try {
    res = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return { ok: false, code: "backend_unavailable", error: "The verification service could not be reached." };
  }

  try {
    return (await res.json()) as VerifyResponse;
  } catch {
    return { ok: false, code: "backend_unavailable", error: "The verification service returned an unreadable response." };
  }
}

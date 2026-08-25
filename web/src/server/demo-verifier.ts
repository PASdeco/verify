import "server-only";

import type { VerificationResult } from "@/types/verification";

/**
 * DEVELOPMENT_DEMO verification service.
 * Returns clearly-labelled simulated results so the UI can be developed
 * and demonstrated without StudioNet. The API layer tags every demo
 * response with mode=DEVELOPMENT_DEMO and the UI shows an explicit banner.
 * NEVER silently substituted for real results.
 */

const DEMO_PRODUCTS: Record<string, Partial<VerificationResult>> = {
  "5449000000996": {
    verdict: "CONSISTENT",
    product_name: "Coca-Cola Original Taste",
    brand: "Coca-Cola",
    manufacturer: "The Coca-Cola Company",
    attributes: { quantity: "500 ml", category: "Beverages", notes: "" },
    evidence_summary:
      "Two public catalogues returned matching records for this barcode; reported brand, size and category agree.",
    explanation:
      "The barcode and available product information are consistent across the sources investigated in this simulation.",
  },
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function demoVerification(barcode: string): VerificationResult {
  const known = DEMO_PRODUCTS[barcode];
  if (known) {
    return withSources({ ...base(barcode), ...known }, true);
  }
  const roll = hashString(barcode) % 3;
  const verdict: VerificationResult["verdict"] =
    roll === 0 ? "CONSISTENT" : roll === 1 ? "INCONCLUSIVE" : "SUSPICIOUS";
  return withSources(
    {
      ...base(barcode),
      verdict,
      product_name: verdict === "SUSPICIOUS" ? "Unknown Product" : "",
      evidence_summary:
        verdict === "SUSPICIOUS"
          ? "Simulated conflict: catalogue records disagree about the product identity for this barcode."
          : "Simulated result: insufficient reliable information found for this barcode.",
      explanation:
        verdict === "SUSPICIOUS"
          ? "In this simulation, the barcode information does not fully match the product records found."
          : "In this simulation there isn't enough reliable information to reach a determination.",
    },
    false
  );
}

function base(barcode: string): VerificationResult {
  return {
    barcode,
    verdict: "INCONCLUSIVE",
    product_name: "",
    brand: "",
    manufacturer: "",
    attributes: { quantity: "", category: "", notes: "" },
    evidence_summary: "",
    consensus_summary:
      "Simulated panel: all three judge perspectives converged on the same conclusion.",
    explanation: "",
    sources: [],
    judges: {},
    created_at: Math.floor(Date.now() / 1000),
  };
}

function withSources(result: VerificationResult, found: boolean): VerificationResult {
  result.sources = [
    {
      name: "Open Food Facts (simulated)",
      url: `https://world.openfoodfacts.org/api/v2/product/${result.barcode}.json`,
      reachable: true,
      found,
      reported: found
        ? {
            product_name: result.product_name || "Demo Product",
            brands: result.brand || "Demo Brand",
            quantity: result.attributes.quantity,
          }
        : {},
    },
    {
      name: "Open Products Facts (simulated)",
      url: `https://world.openproductsfacts.org/api/v2/product/${result.barcode}.json`,
      reachable: true,
      found,
      reported: found
        ? {
            product_name: `${result.product_name || "Demo Product"} ${result.attributes.quantity}`.trim(),
            brands: result.brand || "Demo Brand",
          }
        : {},
    },
    {
      name: "Open Beauty Facts (simulated)",
      url: `https://world.openbeautyfacts.org/api/v2/product/${result.barcode}.json`,
      reachable: true,
      found: false,
      reported: {},
    },
  ];
  result.judges = {
    identity: {
      role: "identity",
      label: "Product Identity Judge",
      verdict: result.verdict,
      summary: "Simulated judge output.",
      reasoning: "This is development demo data, not a real validator run.",
    },
    consistency: {
      role: "consistency",
      label: "Cross-Source Consistency Judge",
      verdict: result.verdict,
      summary: "Simulated judge output.",
      reasoning: "This is development demo data, not a real validator run.",
    },
    reliability: {
      role: "reliability",
      label: "Source Reliability Judge",
      verdict: result.verdict,
      summary: "Simulated judge output.",
      reasoning: "This is development demo data, not a real validator run.",
    },
  };
  return result;
}

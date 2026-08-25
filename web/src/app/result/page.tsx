"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CircleCheck,
  TriangleAlert,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import type { VerificationResult } from "@/types/verification";
import { VERDICT_META } from "@/lib/verdict";

function ResultInner() {
  const params = useSearchParams();
  const barcode = params.get("barcode") ?? "";
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [missing, setMissing] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(`verify.result.${barcode}`);
    if (!raw) {
      setMissing(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setResult(parsed.result as VerificationResult);
      setDemo(parsed.mode === "DEVELOPMENT_DEMO");
    } catch {
      setMissing(true);
    }
  }, [barcode]);

  if (missing) {
    return (
      <div className="fade-up text-center pt-16">
        <h1 className="verdict-title">No result found</h1>
        <p className="mt-4" style={{ color: "var(--text-muted)" }}>
          This verification result isn&apos;t available anymore.
        </p>
        <Link href="/scan" className="btn btn-primary mt-8 w-full">
          Scan a barcode
        </Link>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-3 pt-6">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-40 w-full" />
        <div className="skeleton h-32 w-full" />
      </div>
    );
  }

  const meta = VERDICT_META[result.verdict];
  const Icon =
    result.verdict === "CONSISTENT"
      ? CircleCheck
      : result.verdict === "SUSPICIOUS"
        ? TriangleAlert
        : HelpCircle;

  return (
    <div className="fade-up">
      {demo && (
        <p
          role="note"
          className="chip v-suspicious-chip mb-4 w-full justify-center"
        >
          Development demo — simulated result
        </p>
      )}

      {/* Verdict */}
      <section className="text-center pt-4 pb-8">
        <Icon
          size={52}
          className={`mx-auto ${result.verdict === "CONSISTENT" ? "v-consistent" : result.verdict === "SUSPICIOUS" ? "v-suspicious" : "v-inconclusive"}`}
          aria-hidden
        />
        <h1 className="h-section mt-4">{meta.headingPrefix}</h1>
        <p
          role="status"
          className={`verdict-title ${result.verdict === "CONSISTENT" ? "v-consistent" : result.verdict === "SUSPICIOUS" ? "v-suspicious" : "v-inconclusive"}`}
        >
          {result.verdict}
        </p>

        {(result.product_name || result.brand) && (
          <>
            <p className="mt-3 text-lg font-medium">
              {[result.product_name, result.attributes?.quantity]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {!result.product_name && result.brand && (
              <p className="text-lg font-medium">{result.brand}</p>
            )}
          </>
        )}
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Barcode: {result.barcode}
        </p>

        <p className="mt-5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {result.explanation || result.evidence_summary}
        </p>
      </section>

      {/* Product information */}
      {(result.brand || result.manufacturer || result.attributes?.quantity || result.attributes?.category) && (
        <section aria-labelledby="product-info" className="card p-5 mt-2">
          <h2 id="product-info" className="h-section mb-3">
            Product information
          </h2>
          <dl className="space-y-2.5 text-sm">
            {[
              ["Brand", result.brand],
              ["Manufacturer", result.manufacturer],
              ["Size", result.attributes?.quantity],
              ["Category", result.attributes?.category],
            ]
              .filter(([, v]) => !!v)
              .map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-4">
                  <dt style={{ color: "var(--text-muted)" }}>{label}</dt>
                  <dd className="font-medium text-right">{value}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      {/* Consensus */}
      {result.consensus_summary && (
        <section aria-labelledby="consensus" className="card p-5 mt-3">
          <h2 id="consensus" className="h-section mb-2">
            Jury consensus
          </h2>
          <p className="text-sm leading-relaxed">{result.consensus_summary}</p>
        </section>
      )}

      <Link
        href={`/evidence?barcode=${encodeURIComponent(barcode)}`}
        className="btn btn-primary mt-6 w-full"
      >
        View evidence
        <ChevronRight size={18} aria-hidden />
      </Link>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultInner />
    </Suspense>
  );
}

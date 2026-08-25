"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck, CircleX, MinusCircle, ChevronDown } from "lucide-react";
import type { VerificationResult, SourceReport } from "@/types/verification";

function EvidenceInner() {
  const params = useSearchParams();
  const barcode = params.get("barcode") ?? "";
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [missing, setMissing] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const raw = sessionStorage.getItem(`verify.result.${barcode}`);
    if (!raw) {
      setMissing(true);
      return;
    }
    try {
      setResult((JSON.parse(raw).result) as VerificationResult);
    } catch {
      setMissing(true);
    }
  }, [barcode]);

  function toggle(key: string) {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  }

  if (missing) {
    return (
      <div className="fade-up text-center pt-16">
        <h1 className="verdict-title">No evidence available</h1>
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
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="fade-up">
      <h1 className="verdict-title">Verification evidence</h1>

      <section className="card p-5 mt-5" aria-labelledby="ev-barcode">
        <h2 id="ev-barcode" className="h-section mb-2">Barcode</h2>
        <p className="font-mono text-sm tracking-wide">{result.barcode}</p>
        {(result.product_name || result.brand) && (
          <>
            <h2 className="h-section mt-4 mb-2">Product identified</h2>
            <p className="text-sm font-medium">
              {[result.product_name, result.attributes?.quantity]
                .filter(Boolean)
                .join(" · ") || result.brand}
            </p>
          </>
        )}
      </section>

      {/* Sources checked */}
      <section className="mt-6" aria-labelledby="ev-sources">
        <h2 id="ev-sources" className="h-section mb-3">Sources checked</h2>
        <ul className="space-y-2">
          {result.sources.map((src: SourceReport) => (
            <li key={src.url} className="flex items-center gap-3 text-sm">
              {src.found ? (
                <CircleCheck size={17} className="v-consistent shrink-0" aria-label="Record found" />
              ) : src.reachable ? (
                <MinusCircle size={17} className="v-inconclusive shrink-0" aria-label="No record found" />
              ) : (
                <CircleX size={17} className="v-suspicious shrink-0" aria-label="Source unreachable" />
              )}
              <span>{src.name}</span>
              <span style={{ color: "var(--text-muted)" }}>
                {src.found
                  ? "record found"
                  : src.reachable
                    ? "no matching record"
                    : "unreachable"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Source comparison */}
      <section className="mt-8" aria-labelledby="ev-comparison">
        <h2 id="ev-comparison" className="h-section mb-3">Source comparison</h2>
        <div className="space-y-3">
          {result.sources.filter((s) => s.found).length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No source returned a product record for this barcode.
            </p>
          )}
          {result.sources
            .filter((s) => s.found)
            .map((src) => {
              const key = `src-${src.url}`;
              const open = !!openSections[key];
              return (
                <div key={key} className="card overflow-hidden">
                  <button
                    onClick={() => toggle(key)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left"
                  >
                    <span className="font-medium text-sm">{src.name}</span>
                    <ChevronDown
                      size={18}
                      aria-hidden
                      style={{
                        color: "var(--text-muted)",
                        transform: open ? "rotate(180deg)" : "none",
                        transition: "transform 150ms ease",
                      }}
                    />
                  </button>
                  {open && (
                    <dl className="px-4 pb-4 space-y-2 text-sm fade-up">
                      {Object.entries(src.reported).map(([field, value]) => (
                        <div key={field} className="flex justify-between gap-4">
                          <dt
                            className="capitalize"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {field.replace(/_/g, " ")}
                          </dt>
                          <dd className="font-medium text-right">{value}</dd>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1 v-consistent">
                        <CircleCheck size={15} aria-hidden />
                        <span className="font-medium">Matches</span>
                      </div>
                    </dl>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      {/* Jury conclusion */}
      <section className="mt-8" aria-labelledby="ev-jury">
        <h2 id="ev-jury" className="h-section mb-3">Jury conclusion</h2>

        {result.consensus_summary && (
          <p className="card p-4 text-sm leading-relaxed">
            {result.consensus_summary}
          </p>
        )}

        {/* Individual judges — only actual returned data */}
        <div className="mt-3 space-y-3">
          {Object.values(result.judges ?? {}).map((judge) => {
            const key = `judge-${judge.role}`;
            const open = !!openSections[key];
            return (
              <div key={key} className="card overflow-hidden">
                <button
                  onClick={() => toggle(key)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left"
                >
                  <span className="text-sm">
                    <span className="font-medium block">{judge.label}</span>
                    <span
                      className={
                        judge.verdict === "CONSISTENT"
                          ? "v-consistent"
                          : judge.verdict === "SUSPICIOUS"
                            ? "v-suspicious"
                            : "v-inconclusive"
                      }
                    >
                      {judge.verdict === "CONSISTENT" ? "\u2713 " : judge.verdict === "SUSPICIOUS" ? "\u26A0 " : "? "}
                      {judge.verdict.charAt(0) + judge.verdict.slice(1).toLowerCase()}
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    aria-hidden
                    style={{
                      color: "var(--text-muted)",
                      transform: open ? "rotate(180deg)" : "none",
                      transition: "transform 150ms ease",
                    }}
                  />
                </button>
                {open && (
                  <div className="px-4 pb-4 text-sm fade-up space-y-2">
                    {judge.summary && <p>{judge.summary}</p>}
                    {judge.reasoning && (
                      <p style={{ color: "var(--text-muted)" }}>{judge.reasoning}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {result.evidence_summary && (
          <>
            <h2 className="h-section mt-6 mb-2">Contract explanation</h2>
            <p className="card p-4 text-sm leading-relaxed">
              {result.evidence_summary}
            </p>
          </>
        )}
      </section>

      <Link href="/scan" className="btn btn-secondary mt-8 w-full">
        Scan another product
      </Link>
    </div>
  );
}

export default function EvidencePage() {
  return (
    <Suspense fallback={null}>
      <EvidenceInner />
    </Suspense>
  );
}

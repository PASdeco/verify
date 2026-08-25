"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, Loader2 } from "lucide-react";
import { requestVerification } from "@/lib/api-client";
import { INVESTIGATION_STAGES } from "@/lib/verdict";
import type { VerificationResult } from "@/types/verification";

function VerifyingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const barcode = params.get("barcode") ?? "";

  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!barcode) {
      router.replace("/scan");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const controller = new AbortController();
    // Generous ceiling: GenLayer consensus runs can take many minutes.
    const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);

    // Advance the stage indicator on a timer — it reflects that work is
    // ongoing, not fabricated validator activity.
    const ticker = setInterval(
      () => setStage((s) => Math.min(s + 1, INVESTIGATION_STAGES.length - 1)),
      6000
    );

    requestVerification(barcode, controller.signal)
      .then((res) => {
        clearTimeout(timeout);
        clearInterval(ticker);
        if (res.ok) {
          sessionStorage.setItem(
            `verify.result.${res.result.barcode}`,
            JSON.stringify(res)
          );
          router.replace(`/result?barcode=${encodeURIComponent(res.result.barcode)}`);
        } else {
          setError(res.error || "Verification couldn't be completed right now.");
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        clearInterval(ticker);
        setError("Verification couldn't be completed right now. Please try again.");
      });

    return () => {
      controller.abort();
      clearTimeout(timeout);
      clearInterval(ticker);
    };
  }, [barcode, router]);

  if (error) {
    return (
      <div className="fade-up text-center pt-16">
        <h1 className="verdict-title">Something went wrong</h1>
        <p role="alert" className="mt-4" style={{ color: "var(--text-muted)" }}>
          {error}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary w-full"
          >
            Try again
          </button>
          <Link href="/scan" className="btn btn-secondary w-full">
            Enter another barcode
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up text-center pt-12">
      {/* Animated GenLayer-inspired visualization */}
      <div className="relative mx-auto w-28 h-28 pulse-ring rounded-full flex items-center justify-center"
        style={{ background: "var(--accent-soft)" }}
        aria-hidden
      >
        <Loader2 size={44} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>

      <h1 className="verdict-title mt-8">GenLayer is investigating</h1>
      <p className="mt-2" style={{ color: "var(--text-muted)" }}>
        Investigating barcode {barcode}…
      </p>

      <ul className="mt-10 text-left max-w-xs mx-auto space-y-3" aria-live="polite">
        {INVESTIGATION_STAGES.map((label, i) => (
          <li key={label} className="flex items-center gap-3 text-sm">
            {i <= stage ? (
              <CircleCheck size={18} style={{ color: "var(--accent)" }} aria-hidden />
            ) : (
              <span
                className="inline-block w-[18px] h-[18px] rounded-full border-2 opacity-40"
                style={{ borderColor: "var(--border)" }}
                aria-hidden
              />
            )}
            <span style={{ color: i <= stage ? "var(--text)" : "var(--text-muted)" }}>
              {label}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
        This can take a few minutes. Consensus is worth the wait.
      </p>
    </div>
  );
}

export default function VerifyingPage() {
  return (
    <Suspense fallback={null}>
      <VerifyingInner />
    </Suspense>
  );
}

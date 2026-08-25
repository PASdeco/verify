"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScanLine, ChevronRight, CircleCheck, TriangleAlert, HelpCircle } from "lucide-react";
import { loadHistory } from "@/lib/history";
import type { HistoryEntry } from "@/types/verification";

const verdictMeta = {
  CONSISTENT: { icon: CircleCheck, cls: "v-consistent-chip", label: "Consistent" },
  SUSPICIOUS: { icon: TriangleAlert, cls: "v-suspicious-chip", label: "Suspicious" },
  INCONCLUSIVE: { icon: HelpCircle, cls: "v-inconclusive-chip", label: "Inconclusive" },
} as const;

export default function HomePage() {
  const [recent, setRecent] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    setRecent(loadHistory().slice(0, 3));
  }, []);

  return (
    <div className="fade-up">
      <section className="text-center pt-10 pb-12">
        <h1 className="display-xl">VERIFY</h1>
        <p
          className="mt-3 text-lg"
          style={{ color: "var(--text-muted)" }}
        >
          Know what you&apos;re buying.
        </p>
        <Link href="/scan" className="btn btn-primary mt-8 w-full">
          <ScanLine size={20} aria-hidden />
          Scan Barcode
        </Link>
      </section>

      <section aria-labelledby="recent-heading" className="mt-2">
        <h2 id="recent-heading" className="h-section mb-3">
          Recent scans
        </h2>

        {recent === null ? (
          <div className="space-y-2">
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        ) : recent.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="font-medium">No scans yet</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Scan your first product to begin.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((entry) => {
              const meta = verdictMeta[entry.verdict];
              const Icon = meta.icon;
              return (
                <li key={entry.id}>
                  <Link
                    href={`/result?barcode=${encodeURIComponent(entry.barcode)}`}
                    className="card card-pressable flex items-center gap-3 p-4"
                  >
                    <span
                      className={`chip ${meta.cls}`}
                      aria-hidden
                    >
                      <Icon size={15} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">
                        {entry.productName}
                      </span>
                      <span
                        className="block text-sm truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {entry.barcode}
                      </span>
                    </span>
                    <ChevronRight size={18} style={{ color: "var(--text-muted)" }} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p
        className="mt-12 text-center text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        Powered by GenLayer — verified through an Intelligent Contract.
      </p>
    </div>
  );
}

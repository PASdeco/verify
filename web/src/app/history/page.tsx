"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CircleCheck,
  TriangleAlert,
  HelpCircle,
  Trash2,
  ChevronRight,
} from "lucide-react";
import {
  loadHistory,
  removeHistoryEntry,
  clearHistory,
  groupByDay,
} from "@/lib/history";
import type { HistoryEntry } from "@/types/verification";

const verdictIcon = {
  CONSISTENT: CircleCheck,
  SUSPICIOUS: TriangleAlert,
  INCONCLUSIVE: HelpCircle,
} as const;

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  function handleDelete(id: string) {
    removeHistoryEntry(id);
    setEntries(loadHistory());
  }

  function handleClear() {
    clearHistory();
    setEntries([]);
    setConfirmClear(false);
  }

  if (entries === null) {
    return (
      <div className="space-y-2 pt-4">
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-16 w-full" />
      </div>
    );
  }

  const groups = groupByDay(entries);

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between">
        <h1 className="verdict-title">Scan history</h1>
        {entries.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="btn btn-secondary !min-h-[38px] !px-3 text-sm"
          >
            <Trash2 size={15} aria-hidden />
            Clear
          </button>
        )}
      </div>

      {confirmClear && (
        <div role="alertdialog" aria-label="Clear history" className="card p-4 mt-4">
          <p className="text-sm font-medium">Clear all scan history?</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            This removes every stored scan from this device. It cannot be undone.
          </p>
          <div className="flex gap-3 mt-3">
            <button onClick={handleClear} className="btn btn-primary flex-1 !min-h-[44px] text-sm">
              Clear history
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="btn btn-secondary flex-1 !min-h-[44px] text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="card p-6 text-center mt-6">
          <p className="font-medium">No scans yet</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Scan your first product to begin.
          </p>
          <Link href="/scan" className="btn btn-primary mt-5">
            Scan barcode
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="h-section mb-2">{group.label}</h2>
              <ul className="space-y-2">
                {group.entries.map((entry) => {
                  const Icon = verdictIcon[entry.verdict];
                  return (
                    <li key={entry.id} className="card flex items-center gap-3 p-4">
                      <Link
                        href={`/result?barcode=${encodeURIComponent(entry.barcode)}`}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <span className={`chip ${entry.verdict === "CONSISTENT" ? "v-consistent-chip" : entry.verdict === "SUSPICIOUS" ? "v-suspicious-chip" : "v-inconclusive-chip"}`}>
                          <Icon size={14} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
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
                        <ChevronRight size={17} style={{ color: "var(--text-muted)" }} aria-hidden />
                      </Link>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        aria-label={`Delete scan ${entry.barcode}`}
                        className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                      >
                        <Trash2 size={16} style={{ color: "var(--text-muted)" }} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

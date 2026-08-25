import type {
  HistoryEntry,
  VerificationResult,
} from "@/types/verification";

const HISTORY_KEY = "verify.history.v1";
const MAX_ENTRIES = 100;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export function addHistoryEntry(result: VerificationResult): HistoryEntry {
  const entry: HistoryEntry = {
    id: `${result.barcode}-${Date.now()}`,
    barcode: result.barcode,
    productName:
      result.product_name ||
      result.brand ||
      `Barcode ${result.barcode}`,
    verdict: result.verdict,
    timestamp: Date.now(),
    mode: "REAL_STUDIONET",
  };
  const entries = [entry, ...loadHistory()].slice(0, MAX_ENTRIES);
  saveHistory(entries);
  return entry;
}

export function removeHistoryEntry(id: string) {
  saveHistory(loadHistory().filter((e) => e.id !== id));
}

export function clearHistory() {
  window.localStorage.removeItem(HISTORY_KEY);
}

/** Group entries under Today / Yesterday / date headings. */
export function groupByDay(
  entries: HistoryEntry[]
): { label: string; entries: HistoryEntry[] }[] {
  const groups: Record<string, HistoryEntry[]> = {};
  const now = new Date();
  for (const e of entries) {
    const d = new Date(e.timestamp);
    const daysAgo = Math.floor(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
        new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
        86_400_000
    );
    const label =
      daysAgo === 0
        ? "Today"
        : daysAgo === 1
          ? "Yesterday"
          : d.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });
    (groups[label] ??= []).push(e);
  }
  return Object.entries(groups).map(([label, entries]) => ({
    label,
    entries,
  }));
}

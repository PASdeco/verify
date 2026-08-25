"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemePicker } from "@/components/theme-picker";
import { clearHistory, loadHistory } from "@/lib/history";

interface NetworkInfo {
  mode: string;
  network: string;
  contract_address: string | null;
}

export default function SettingsPage() {
  const [scanCount, setScanCount] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);

  useEffect(() => {
    setScanCount(loadHistory().length);
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then(setNetwork)
      .catch(() => setNetwork(null));
  }, []);

  return (
    <div className="fade-up">
      <h1 className="verdict-title">Settings</h1>

      {/* Appearance */}
      <section className="mt-8" aria-labelledby="appearance">
        <h2 id="appearance" className="h-section mb-3">Appearance</h2>
        <ThemePicker />
      </section>

      {/* Data */}
      <section className="mt-8" aria-labelledby="data">
        <h2 id="data" className="h-section mb-3">Data</h2>
        <div className="card p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm">Scan history</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {scanCount} scan{scanCount === 1 ? "" : "s"} stored on this device
            </p>
          </div>
          {scanCount > 0 && !confirmClear && (
            <button
              onClick={() => setConfirmClear(true)}
              className="btn btn-secondary !min-h-[40px] !px-3 text-sm shrink-0"
            >
              Clear
            </button>
          )}
        </div>
        {confirmClear && (
          <div role="alertdialog" aria-label="Clear history" className="card p-4 mt-2">
            <p className="text-sm">Remove all {scanCount} scans from this device?</p>
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => {
                  clearHistory();
                  setScanCount(0);
                  setConfirmClear(false);
                }}
                className="btn btn-primary flex-1 !min-h-[44px] text-sm"
              >
                Clear
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
      </section>

      {/* About */}
      <section className="mt-8" aria-labelledby="about">
        <h2 id="about" className="h-section mb-3">About</h2>
        <div className="card p-5 text-sm space-y-3 leading-relaxed">
          <p>
            <span className="font-semibold">VERIFY</span> — Know what
            you&apos;re buying. Scan a product barcode and a GenLayer
            Intelligent Contract investigates publicly available product
            information with independent validator consensus.
          </p>
          <p style={{ color: "var(--text-muted)" }}>
            VERIFY checks whether product information is{" "}
            <em>consistent</em> across credible public sources. A barcode is an
            identifier — it is not cryptographic proof that a physical item is
            genuine.
          </p>
        </div>

        {/* Developer / network info */}
        <div className="card p-5 mt-3 text-sm space-y-2">
          <h3 className="h-section mb-1">Network</h3>
          {network ? (
            <>
              <div className="flex justify-between gap-4">
                <span style={{ color: "var(--text-muted)" }}>Mode</span>
                <span className="font-mono text-xs">{network.mode}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: "var(--text-muted)" }}>Network</span>
                <span className="font-mono text-xs">{network.network}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: "var(--text-muted)" }}>Contract</span>
                <span className="font-mono text-xs break-all text-right">
                  {network.contract_address ?? "not deployed yet"}
                </span>
              </div>
            </>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>
              Network information unavailable.
            </p>
          )}
          <p className="pt-2" style={{ color: "var(--text-muted)" }}>
            Powered by{" "}
            <Link
              href="https://www.genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)" }}
            >
              GenLayer
            </Link>{" "}
            Intelligent Contracts.
          </p>
        </div>
      </section>
    </div>
  );
}

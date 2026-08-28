"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Keyboard, Flashlight, FlashlightOff } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { isValidGtin, normalizeBarcode } from "@/lib/utils";

const SCANNER_REGION_ID = "verify-scanner-region";

export default function ScanPage() {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraState, setCameraState] = useState<
    "idle" | "starting" | "scanning" | "denied" | "unavailable"
  >("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState("");
  const lockRef = useRef(false);

  const onDetected = useCallback(
    (code: string) => {
      if (lockRef.current) return;
      lockRef.current = true;
      stopCamera();
      // Subtle haptic feedback where supported.
      navigator.vibrate?.(60);
      router.push(`/verifying?barcode=${encodeURIComponent(code)}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router]
  );

  const stopCamera = useCallback(() => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {});
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraState("starting");
    try {
      const scanner = new Html5Qrcode(SCANNER_REGION_ID, {
        formatsToSupport: undefined, // default covers EAN/UPC/Code128
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // native detector = far better 1D hit rate
        },
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 280, height: 160 }, aspectRatio: 1.3333 },
        (decoded) => onDetected(decoded),
        () => {} // per-frame miss — ignore
      );
      setCameraState("scanning");
    } catch (err) {
      const msg = String(err ?? "");
      if (/permission|NotAllowed/i.test(msg)) {
        setCameraState("denied");
      } else {
        setCameraState("unavailable");
      }
    }
  }, [onDetected]);

  async function toggleTorch() {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      // Torch unsupported on this device — toggle is best-effort.
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeBarcode(manual);
    if (!code) {
      setManualError("Enter a barcode first.");
      return;
    }
    if (!isValidGtin(code)) {
      setManualError(
        "That doesn't look like a valid product barcode. Use digits only, 6-18 characters."
      );
      return;
    }
    setManualError("");
    onDetected(code);
  }

  return (
    <div className="fade-up">
      <h1 className="verdict-title">Scan barcode</h1>
      <p className="mt-2" style={{ color: "var(--text-muted)" }}>
        Align the barcode inside the frame.
      </p>

      {/* Camera preview */}
      <div
        className="relative mt-6 overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-subtle)",
          aspectRatio: "4 / 3",
        }}
      >
        <div id={SCANNER_REGION_ID} className="w-full h-full [&>video]:object-cover" />

        {/* Scanning frame overlay */}
        {(cameraState === "scanning" || cameraState === "starting") && (
          <>
            <div
              className="pointer-events-none absolute inset-x-10 top-1/2 -translate-y-1/2 rounded-xl border-2"
              style={{ borderColor: "var(--accent)", height: "34%" }}
            />
            {cameraState === "scanning" && (
              <div
                className="pointer-events-none absolute inset-x-12 h-0.5 animate-scanline rounded"
                style={{ background: "var(--accent)" }}
              />
            )}
          </>
        )}

        {cameraState === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <ScanLine size={40} style={{ color: "var(--accent)" }} aria-hidden />
            <button onClick={startCamera} className="btn btn-primary">
              Start camera
            </button>
          </div>
        )}

        {cameraState === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p style={{ color: "var(--text-muted)" }}>Starting camera…</p>
          </div>
        )}

        {cameraState === "denied" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-medium">Camera access was denied</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Allow camera access in your browser settings, or enter the
              barcode manually below.
            </p>
            <button onClick={startCamera} className="btn btn-secondary">
              Try again
            </button>
          </div>
        )}

        {cameraState === "unavailable" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-medium">Camera isn&apos;t available</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Your device or browser doesn&apos;t support camera scanning here.
              Enter the barcode manually below.
            </p>
          </div>
        )}
      </div>

      {/* Flashlight */}
      {cameraState === "scanning" && (
        <button
          onClick={toggleTorch}
          className="btn btn-secondary mt-4 w-full"
          aria-pressed={torchOn}
        >
          {torchOn ? (
            <FlashlightOff size={18} aria-hidden />
          ) : (
            <Flashlight size={18} aria-hidden />
          )}
          {torchOn ? "Turn off light" : "Turn on light"}
        </button>
      )}

      {/* Manual entry fallback */}
      <section className="mt-8" aria-labelledby="manual-heading">
        <h2 id="manual-heading" className="h-section mb-3 flex items-center gap-2">
          <Keyboard size={15} aria-hidden />
          Enter barcode manually
        </h2>
        <form onSubmit={submitManual} noValidate>
          <label htmlFor="barcode-input" className="sr-only">
            Product barcode (digits)
          </label>
          <input
            id="barcode-input"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 5449000000996"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            aria-invalid={!!manualError}
            aria-describedby={manualError ? "barcode-error" : undefined}
          />
          {manualError && (
            <p
              id="barcode-error"
              role="alert"
              className="mt-2 text-sm v-suspicious"
            >
              {manualError}
            </p>
          )}
          <button type="submit" className="btn btn-primary mt-3 w-full">
            Verify this barcode
          </button>
        </form>
      </section>
    </div>
  );
}

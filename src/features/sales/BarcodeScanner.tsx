import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Modal } from "@/components/ui/Modal";

/**
 * Scanner barcode via KAMERA (@zxing/browser). Alternatif dari scanner
 * Bluetooth/HID (yang masuk sebagai ketikan ke kotak cari).
 *
 * Saat terbuka: minta kamera, decode terus-menerus, panggil onDetect sekali
 * lalu tutup. Kamera selalu dilepas saat modal ditutup (cleanup controls).
 */
export function BarcodeScanner({
  open,
  onClose,
  onDetect,
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setError("");
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined, // default kamera (biasanya belakang di HP)
          videoRef.current ?? undefined,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              controlsRef.current?.stop();
              onDetect(result.getText());
            }
          },
        );
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch (e) {
        setError(
          e instanceof Error && /permission|denied|notallowed/i.test(e.message)
            ? "Akses kamera ditolak. Izinkan kamera di browser."
            : "Tidak bisa membuka kamera.",
        );
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetect]);

  return (
    <Modal open={open} onClose={onClose} title="Scan Barcode" size="sm">
      <div className="p-4">
        {error ? (
          <div className="rounded bg-danger/10 p-4 text-center text-sm text-danger">
            {error}
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg bg-ink">
              <video
                ref={videoRef}
                className="aspect-square w-full object-cover"
                muted
                playsInline
              />
            </div>
            <p className="mt-3 text-center text-sm text-ink-soft">
              Arahkan kamera ke barcode barang.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

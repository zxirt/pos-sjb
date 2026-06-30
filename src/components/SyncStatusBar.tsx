import { useLiveQuery } from "dexie-react-hooks";
import { Cloud, CloudOff, RefreshCw, Check } from "lucide-react";
import { db } from "@/db/db";
import { SYNC_TABLES } from "@/db/types";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/cn";

/**
 * Bar status sinkronisasi.
 * Fase 0: menampilkan online/offline + jumlah baris belum-tersinkron (dirty).
 * Tombol "Sinkron sekarang" sebagai pemicu manual cadangan — di Fase 5
 * disambungkan ke sync engine (sync utama berjalan otomatis & terus-menerus).
 */
export function SyncStatusBar() {
  const online = useOnlineStatus();

  // Hitung total baris dirty di semua tabel sync.
  const unsynced = useLiveQuery(async () => {
    let total = 0;
    for (const t of SYNC_TABLES) {
      const table = (db as unknown as Record<string, { where: (i: string) => { equals: (v: number) => { count: () => Promise<number> } } }>)[t];
      if (table) total += await table.where("dirty").equals(1).count();
    }
    return total;
  }, []);

  const count = unsynced ?? 0;
  const allSynced = online && count === 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2 text-sm",
        online ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn",
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        {online ? <Cloud size={16} /> : <CloudOff size={16} />}
        <span>{online ? "Online" : "Offline"}</span>
        {allSynced ? (
          <span className="flex items-center gap-1 text-good">
            <Check size={14} /> Tersinkron
          </span>
        ) : count > 0 ? (
          <span className="opacity-80">· {count} belum tersinkron</span>
        ) : null}
      </div>
      <button
        type="button"
        disabled={!online}
        className="flex items-center gap-1.5 rounded px-2 py-1 font-semibold hover:bg-white/50 disabled:opacity-40"
        title="Sinkron manual (cadangan)"
      >
        <RefreshCw size={14} /> Sinkron
      </button>
    </div>
  );
}

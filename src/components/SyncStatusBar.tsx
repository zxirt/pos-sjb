import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, Check, Loader2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/cn";
import { getSyncEngine } from "@/lib/sync";
import { getSyncStatus, subscribeSyncStatus } from "@/lib/sync/state";
import type { SyncStatus } from "@/lib/sync/types";

export function SyncStatusBar() {
  const online = useOnlineStatus();
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribeSyncStatus((s) => {
      setStatus({
        isOnline: s.isOnline,
        isSyncing: s.isSyncing,
        lastSyncAt: s.lastSyncAt,
        syncError: s.syncError,
        dirtyCount: s.dirtyCount,
        totalDirty: Object.values(s.dirtyCount).reduce((a, b) => a + b, 0),
      });
    });
    return unsub;
  }, []);

  const handleSync = async () => {
    const engine = getSyncEngine();
    if (!engine || syncing) return;
    setSyncing(true);
    await engine.syncNow();
    setSyncing(false);
  };

  const count = status.totalDirty;
  const allSynced = online && count === 0;
  const isSyncing = status.isSyncing || syncing;

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
        {isSyncing ? (
          <span className="flex items-center gap-1">
            <Loader2 size={14} className="animate-spin" /> Menyinkron...
          </span>
        ) : allSynced ? (
          <span className="flex items-center gap-1 text-good">
            <Check size={14} /> Tersinkron
          </span>
        ) : count > 0 ? (
          <span className="opacity-80">· {count} belum tersinkron</span>
        ) : null}
        {status.syncError && (
          <span className="text-danger" title={status.syncError}>
            · Galat
          </span>
        )}
      </div>
      <button
        type="button"
        disabled={!online || isSyncing}
        onClick={() => void handleSync()}
        className="flex items-center gap-1.5 rounded px-2 py-1 font-semibold hover:bg-white/50 disabled:opacity-40"
        title="Sinkron sekarang"
      >
        <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />{" "}
        Sinkron
      </button>
    </div>
  );
}

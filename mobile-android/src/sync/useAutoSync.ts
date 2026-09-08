import { useEffect, useRef, useState } from "react";
import { useNetworkStatus } from "../network/useNetworkStatus";
import { syncPending, type SyncAdapter, type SyncResult } from "./syncEngine";

export function useAutoSync(adapter: SyncAdapter | null): SyncResult {
  const network = useNetworkStatus();
  const [result, setResult] = useState<SyncResult>({ state: "IDLE", accepted: 0, conflicts: 0, failed: 0 });
  const lastAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!adapter || !network.isConnected) return;
    const attemptKey = `${network.isInternetReachable}:${network.isConnected}`;
    if (lastAttemptRef.current === attemptKey) return;
    lastAttemptRef.current = attemptKey;
    let mounted = true;
    void syncPending(adapter).then((next) => {
      if (mounted) setResult(next);
    });
    return () => { mounted = false; };
  }, [adapter, network.isConnected, network.isInternetReachable, result.state]);

  return result;
}

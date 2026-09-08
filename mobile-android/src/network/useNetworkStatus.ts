import { useEffect, useState } from "react";
import * as Network from "expo-network";

export type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
};

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: false,
    isInternetReachable: null,
  });

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const state = await Network.getNetworkStateAsync();
      if (mounted) {
        setStatus({
          isConnected: state.isConnected === true,
          isInternetReachable: state.isInternetReachable ?? null,
        });
      }
    };

    void refresh();
    const subscription = Network.addNetworkStateListener((state) => {
      setStatus({
        isConnected: state.isConnected === true,
        isInternetReachable: state.isInternetReachable ?? null,
      });
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return status;
}

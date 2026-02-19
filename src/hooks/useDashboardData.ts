import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import {
  loadDashboardData,
  type DashboardData,
} from "../domain/loadDashboardData";
import { getAppState, loadActiveProfileId } from "../domain/AppState";
import { getRepository } from "../db";

// ─── Return type ─────────────────────────────────────────────────────

export type UseDashboardDataResult = {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  /** Call after quick-log to refresh data */
  refresh: () => void;
  /** Clear error banner */
  clearError: () => void;
};

// ─── Hook ────────────────────────────────────────────────────────────

export function useDashboardData(): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Resolve active profile ID
      let profileId = getAppState().activeProfileId;
      if (profileId === null) {
        profileId = await loadActiveProfileId();
      }
      if (profileId === null) {
        setError("No active profile.");
        setData(null);
        return;
      }
      // 2. Delegate to pure loader (testable independently)
      const result = await loadDashboardData(profileId, getRepository());
      setData(result);
    } catch {
      setError("Failed to load dashboard.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { data, isLoading, error, refresh, clearError };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import {
  getLockState,
  lockApp,
  onBackground,
  shouldRelock,
} from "../domain/LockState";

type UseAppLockResult = {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
};

/**
 * Monitors RN AppState transitions to trigger lock/unlock:
 * - active → background/inactive: record timestamp
 * - background/inactive → active: relock if > 30 s elapsed
 */
export function useAppLock(): UseAppLockResult {
  const [isLocked, setIsLocked] = useState(() => getLockState().isLocked);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const handleAppStateChange = useCallback(
    (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (
        prev === "active" &&
        (nextState === "background" || nextState === "inactive")
      ) {
        onBackground();
      }

      if (
        (prev === "background" || prev === "inactive") &&
        nextState === "active"
      ) {
        if (shouldRelock()) {
          lockApp();
          setIsLocked(true);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  return { isLocked, setIsLocked };
}

import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NativeModules, StyleSheet, View } from "react-native";

import {
  checkBiometricAvailability,
  getLockoutRemainingMs,
  getLockState,
  PIN_LENGTH,
  unlockApp,
  verifyPin,
} from "../domain/LockState";
import {
  AppText,
  PinPad,
  ScreenContainer,
  colors,
  spacing,
} from "../ui";

// ── Types ────────────────────────────────────────────────────────────

type LockScreenProps = {
  onUnlock: () => void;
};

// ── Helpers ──────────────────────────────────────────────────────────

function formatRemainingMs(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds <= 0) return "";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `Try again in ${minutes}m ${seconds}s`;
  }
  return `Try again in ${seconds}s`;
}

// ── Component ────────────────────────────────────────────────────────

export function LockScreen({ onUnlock }: LockScreenProps): ReactElement {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lockoutMs, setLockoutMs] = useState(() => getLockoutRemainingMs());
  const [verifying, setVerifying] = useState(false);
  const lockoutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const biometricAttempted = useRef(false);

  // ── Biometric auto-prompt on mount ────────────────────────────────

  useEffect(() => {
    if (biometricAttempted.current) return;
    biometricAttempted.current = true;

    const attemptBiometric = async (): Promise<void> => {
      const state = getLockState();
      if (!state.isBiometricEnabled) return;

      const available = await checkBiometricAvailability();
      if (!available) return;

      try {
        // Guard: skip if native module is not built into the binary
        if (!NativeModules.ExpoLocalAuthentication) return;
        const LA =
          require("expo-local-authentication") as typeof import("expo-local-authentication");
        const result = await LA.authenticateAsync({
          promptMessage: "Unlock FlowCycle",
          cancelLabel: "Use PIN",
          disableDeviceFallback: true,
        });

        if (result.success) {
          unlockApp();
          onUnlock();
        }
        // On failure/cancel: fall back to PIN pad silently
      } catch {
        // Biometric failed — fall back to PIN pad silently
      }
    };

    void attemptBiometric();
  }, [onUnlock]);

  // ── Lockout countdown ────────────────────────────────────────────

  const startLockoutTimer = useCallback(() => {
    if (lockoutIntervalRef.current) {
      clearInterval(lockoutIntervalRef.current);
    }
    lockoutIntervalRef.current = setInterval(() => {
      const remaining = getLockoutRemainingMs();
      setLockoutMs(remaining);
      if (remaining <= 0 && lockoutIntervalRef.current) {
        clearInterval(lockoutIntervalRef.current);
        lockoutIntervalRef.current = null;
      }
    }, 1_000);
  }, []);

  useEffect(() => {
    if (lockoutMs > 0) {
      startLockoutTimer();
    }
    return () => {
      if (lockoutIntervalRef.current) {
        clearInterval(lockoutIntervalRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PIN entry ────────────────────────────────────────────────────

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (verifying) return;
      setError(null);
      setDigits((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        return [...prev, digit];
      });
    },
    [verifying],
  );

  const handleBackspace = useCallback(() => {
    if (verifying) return;
    setError(null);
    setDigits((prev) => prev.slice(0, -1));
  }, [verifying]);

  // ── Auto-submit when PIN_LENGTH digits entered ───────────────────

  useEffect(() => {
    if (digits.length !== PIN_LENGTH) return;

    const submit = async (): Promise<void> => {
      setVerifying(true);
      try {
        const result = await verifyPin(digits.join(""));
        if (result.success) {
          unlockApp();
          onUnlock();
        } else {
          setDigits([]);
          if (result.lockoutRemainingMs && result.lockoutRemainingMs > 0) {
            setLockoutMs(result.lockoutRemainingMs);
            startLockoutTimer();
            setError(null); // lockout message replaces error
          } else {
            setError("Incorrect PIN");
          }
        }
      } catch {
        setError("Incorrect PIN");
        setDigits([]);
      } finally {
        setVerifying(false);
      }
    };

    void submit();
  }, [digits, onUnlock, startLockoutTimer]);

  const locked = lockoutMs > 0;

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.container}>
        <AppText variant="heading" style={styles.title}>
          FlowCycle
        </AppText>

        <AppText variant="body" style={styles.subtitle}>
          Enter PIN
        </AppText>

        <View style={styles.padWrapper}>
          <PinPad
            pinLength={PIN_LENGTH}
            filledCount={digits.length}
            onDigitPress={handleDigitPress}
            onBackspace={handleBackspace}
            disabled={locked || verifying}
            error={!!error}
          />
        </View>

        <View style={styles.messageArea}>
          {locked ? (
            <AppText
              variant="body"
              style={styles.lockoutText}
              accessibilityLiveRegion="polite"
            >
              {formatRemainingMs(lockoutMs)}
            </AppText>
          ) : error ? (
            <AppText
              variant="caption"
              style={styles.errorText}
              accessibilityLiveRegion="polite"
            >
              {error}
            </AppText>
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  padWrapper: {
    marginBottom: spacing.md,
  },
  messageArea: {
    minHeight: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: colors.error,
  },
  lockoutText: {
    color: colors.error,
  },
});

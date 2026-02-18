import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { PIN_LENGTH, removePin, setPin, verifyPin } from "../domain/LockState";
import { AppText, PinPad, ScreenContainer } from "../ui";
import { colors, spacing } from "../ui/tokens";
import type { RootStackParamList } from "./navigationTypes";

type Props = NativeStackScreenProps<RootStackParamList, "SetupPin">;

type Step = "enter-current" | "enter-new" | "confirm-new";

function getInitialStep(mode: "set" | "change" | "remove"): Step {
  return mode === "set" ? "enter-new" : "enter-current";
}

function getStepLabel(step: Step, mode: "set" | "change" | "remove"): string {
  switch (step) {
    case "enter-current":
      return "Enter current PIN";
    case "enter-new":
      return mode === "set" ? "Enter a 6-digit PIN" : "Enter new PIN";
    case "confirm-new":
      return "Confirm PIN";
  }
}

function getHeading(mode: "set" | "change" | "remove"): string {
  switch (mode) {
    case "set":
      return "Set PIN";
    case "change":
      return "Change PIN";
    case "remove":
      return "Remove PIN";
  }
}

export function SetupPinScreen({ navigation, route }: Props): ReactElement {
  const { mode } = route.params;
  const [step, setStep] = useState<Step>(() => getInitialStep(mode));
  const [digits, setDigits] = useState<number[]>([]);
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  const heading = getHeading(mode);

  const handlePinEntry = useCallback(
    async (pin: string): Promise<void> => {
      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);

      try {
        if (step === "enter-current") {
          const result = await verifyPin(pin);

          if (!result.success) {
            if (
              result.lockoutRemainingMs !== null &&
              result.lockoutRemainingMs > 0
            ) {
              const secs = Math.ceil(result.lockoutRemainingMs / 1000);
              setError(
                secs >= 60
                  ? `Too many attempts. Try again in ${Math.ceil(secs / 60)}m`
                  : `Too many attempts. Try again in ${secs}s`,
              );
            } else {
              setError("Incorrect PIN");
            }
            setDigits([]);
            return;
          }

          if (mode === "remove") {
            const removed = await removePin(pin);
            if (!removed) {
              setError("Failed to remove PIN");
              setDigits([]);
              return;
            }
            navigation.goBack();
            return;
          }

          // mode === "change" — proceed to enter new PIN
          setError("");
          setDigits([]);
          setStep("enter-new");
          return;
        }

        if (step === "enter-new") {
          setFirstPin(pin);
          setError("");
          setDigits([]);
          setStep("confirm-new");
          return;
        }

        if (step === "confirm-new") {
          if (pin !== firstPin) {
            setError("PINs don't match");
            setFirstPin("");
            setDigits([]);
            setStep("enter-new");
            return;
          }

          await setPin(pin);
          navigation.goBack();
        }
      } catch {
        setError("Something went wrong");
        setDigits([]);
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [step, mode, firstPin, navigation],
  );

  useEffect(() => {
    if (digits.length !== PIN_LENGTH) return;
    void handlePinEntry(digits.join(""));
  }, [digits, handlePinEntry]);

  const onDigitPress = useCallback((digit: string): void => {
    setError("");
    setDigits((prev) =>
      prev.length < PIN_LENGTH ? [...prev, Number(digit)] : prev,
    );
  }, []);

  const onBackspace = useCallback((): void => {
    setDigits((prev) => prev.slice(0, -1));
  }, []);

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.content}>
        <AppText variant="heading" style={styles.heading}>
          {heading}
        </AppText>

        <AppText variant="body" style={styles.stepLabel}>
          {getStepLabel(step, mode)}
        </AppText>

        <PinPad
          pinLength={PIN_LENGTH}
          filledCount={digits.length}
          onDigitPress={onDigitPress}
          onBackspace={onBackspace}
          disabled={processing}
          error={error !== ""}
        />

        {error !== "" && (
          <AppText
            variant="caption"
            style={styles.error}
            accessibilityLiveRegion="polite"
          >
            {error}
          </AppText>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  heading: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  stepLabel: {
    color: colors.textMuted,
    marginBottom: spacing.xl,
    textAlign: "center",
  },
  error: {
    color: colors.error,
    marginTop: spacing.md,
    textAlign: "center",
  },
});

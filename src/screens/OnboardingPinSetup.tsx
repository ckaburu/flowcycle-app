import { useCallback, useEffect, useState, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { ScreenContainer, AppText } from "../ui";
import { PinPad } from "../ui/PinPad";
import { setPin } from "../domain/LockState";
import { colors, spacing } from "../ui/tokens";

const PIN_LENGTH = 6;

type Step = "enter" | "confirm";

type OnboardingPinSetupProps = {
  onComplete: () => void;
};

export function OnboardingPinSetup({
  onComplete,
}: OnboardingPinSetupProps): ReactElement {
  const [step, setStep] = useState<Step>("enter");
  const [digits, setDigits] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");

  const stepLabel =
    step === "enter" ? "Step 1 of 2: Enter PIN" : "Step 2 of 2: Confirm PIN";

  const onDigitPress = useCallback((digit: string): void => {
    setDigits((prev) => (prev.length < PIN_LENGTH ? prev + digit : prev));
  }, []);

  const onBackspace = useCallback((): void => {
    setDigits((prev) => prev.slice(0, -1));
  }, []);

  useEffect(() => {
    if (digits.length < PIN_LENGTH) return;

    if (step === "enter") {
      setFirstPin(digits);
      setDigits("");
      setError("");
      setStep("confirm");
      return;
    }

    // step === "confirm"
    if (digits === firstPin) {
      setPin(digits)
        .then(() => onComplete())
        .catch(() => {
          setError("Failed to save PIN. Try again.");
          setFirstPin("");
          setDigits("");
          setStep("enter");
        });
    } else {
      setError("PINs didn't match. Try again.");
      setFirstPin("");
      setDigits("");
      setStep("enter");
    }
  }, [digits, step, firstPin, onComplete]);

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <AppText variant="heading" style={styles.heading}>
            Create a PIN
          </AppText>
          <AppText variant="caption" style={styles.stepLabel}>
            {stepLabel}
          </AppText>
        </View>
        <View style={styles.padWrapper}>
          <PinPad
            pinLength={PIN_LENGTH}
            filledCount={digits.length}
            onDigitPress={onDigitPress}
            onBackspace={onBackspace}
            error={error !== ""}
          />
        </View>
        <View style={styles.messageArea}>
          {error !== "" && (
            <AppText variant="body" color={colors.error} style={styles.error}>
              {error}
            </AppText>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: spacing.lg,
  },
  heading: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  stepLabel: {
    color: colors.textMuted,
    textAlign: "center",
  },
  padWrapper: {
    alignItems: "center",
  },
  messageArea: {
    flex: 1,
    paddingTop: spacing.md,
    alignItems: "center",
  },
  error: {
    textAlign: "center",
  },
});

import { useEffect, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { ScreenContainer, AppText, AppButton } from "../ui";
import { colors, spacing } from "../ui/tokens";
import { isPinSet } from "../domain/LockState";

type PinPromptScreenProps = {
  onSetPin: () => void;
  onSkip: () => void;
};

export function PinPromptScreen({
  onSetPin,
  onSkip,
}: PinPromptScreenProps): ReactElement {
  // Recovery check: if PIN already set (crash recovery), skip ahead.
  useEffect(() => {
    const check = async (): Promise<void> => {
      const pinExists = await isPinSet();
      if (pinExists) {
        onSkip();
      }
    };
    check().catch(() => {});
  }, [onSkip]);

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.container}>
        <View style={styles.content}>
          <AppText variant="heading" style={styles.heading}>
            Protect your data?
          </AppText>
          <AppText variant="body" style={styles.body}>
            A 6-digit PIN keeps your information safe if someone else picks up
            your phone.
          </AppText>
        </View>
        <View style={styles.footer}>
          <AppButton title="Set PIN" variant="primary" onPress={onSetPin} />
          <View style={styles.gap} />
          <AppButton
            title="Maybe later"
            variant="secondary"
            onPress={onSkip}
          />
          <AppText variant="caption" style={styles.caption}>
            You can always set one later from Profiles.
          </AppText>
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
  content: {
    flex: 1,
    justifyContent: "center",
  },
  heading: {
    marginBottom: spacing.md,
    textAlign: "center",
  },
  body: {
    color: colors.text,
    textAlign: "center",
  },
  footer: {
    paddingBottom: spacing.xl,
  },
  gap: {
    height: spacing.sm,
  },
  caption: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.md,
  },
});

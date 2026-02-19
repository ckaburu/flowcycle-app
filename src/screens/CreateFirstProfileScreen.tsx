import { useEffect, useState, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { ScreenContainer, AppText, AppInput, AppButton, ErrorBanner } from "../ui";
import { colors, spacing } from "../ui/tokens";
import { getRepository } from "../db";
import { saveActiveProfileId } from "../domain/AppState";

type CreateFirstProfileScreenProps = {
  onNext: () => void;
};

export function CreateFirstProfileScreen({
  onNext,
}: CreateFirstProfileScreenProps): ReactElement {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Recovery check: if a profile already exists (crash recovery), skip ahead.
  useEffect(() => {
    const check = async (): Promise<void> => {
      const profiles = await getRepository().listProfiles();
      if (profiles.length > 0) {
        await saveActiveProfileId(profiles[0].id);
        onNext();
      }
    };
    check().catch(() => {});
  }, [onNext]);

  const onCreateProfile = async (): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    setSubmitting(true);
    setError("");
    try {
      const profile = await getRepository().createProfile(trimmed);
      await saveActiveProfileId(profile.id);
      onNext();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create profile";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.container}>
        <View style={styles.content}>
          <AppText variant="heading" style={styles.heading}>
            What should we call you?
          </AppText>
          <AppInput
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onCreateProfile}
          />
          <AppText variant="caption" style={styles.privacy}>
            🔒 This stays on your device. Always.
          </AppText>
        </View>
        <View style={styles.footer}>
          {error !== "" && (
            <ErrorBanner message={error} onDismiss={() => setError("")} />
          )}
          <AppButton
            title="Create Profile"
            variant="primary"
            onPress={onCreateProfile}
            disabled={name.trim().length === 0 || submitting}
            loading={submitting}
          />
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
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  privacy: {
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: "center",
  },
  footer: {
    paddingBottom: spacing.xl,
  },
});

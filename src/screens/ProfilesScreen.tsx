import type { ReactElement } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { getRepository } from "../db";
import { Profile } from "../db/repo";
import { saveActiveProfileId } from "../domain/AppState";
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  EmptyState,
  ErrorBanner,
  LoadingIndicator,
  ScreenContainer,
  colors,
  spacing,
} from "../ui";
import { RootStackParamList } from "./navigationTypes";

type Props = NativeStackScreenProps<RootStackParamList, "Profiles">;

const repository = getRepository();

export function ProfilesScreen({ navigation }: Props): ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfiles = await repository.listProfiles();
      setProfiles(nextProfiles);
    } catch {
      setError("Failed to load profiles.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfiles();
    }, [loadProfiles])
  );

  const onAddProfile = async (): Promise<void> => {
    const name = newProfileName.trim();
    if (!name) {
      setError("Profile name is required.");
      return;
    }

    try {
      setError(null);
      await repository.createProfile(name);
      setNewProfileName("");
      await loadProfiles();
    } catch {
      setError("Failed to add profile.");
    }
  };

  const onSelectProfile = async (profileId: number): Promise<void> => {
    try {
      setError(null);
      await saveActiveProfileId(profileId);
      navigation.navigate("CycleLog", { profileId });
    } catch {
      setError("Failed to set active profile.");
    }
  };

  return (
    <ScreenContainer>
      <AppText variant="heading" style={styles.title}>
        Profiles
      </AppText>

      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      ) : null}

      {isLoading ? <LoadingIndicator /> : null}

      {!isLoading && profiles.length === 0 ? (
        <EmptyState
          message="No profiles yet."
          hint="Create one below to start tracking."
        />
      ) : null}

      {profiles.map((profile) => (
        <Pressable
          key={profile.id}
          onPress={() => {
            void onSelectProfile(profile.id);
          }}
          accessibilityRole="button"
        >
          <AppCard style={styles.profileCard}>
            <AppText variant="subheading">{profile.name}</AppText>
            <AppText variant="caption">ID: {profile.id}</AppText>
          </AppCard>
        </Pressable>
      ))}

      <View style={styles.inputRow}>
        <AppInput
          label="New profile"
          value={newProfileName}
          onChangeText={setNewProfileName}
          placeholder="Profile name"
          autoCapitalize="words"
        />
        <AppButton
          title="Add Profile"
          onPress={() => {
            void onAddProfile();
          }}
          style={styles.addButton}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.md,
  },
  profileCard: {
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputRow: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  addButton: {
    marginTop: spacing.xs,
  },
});

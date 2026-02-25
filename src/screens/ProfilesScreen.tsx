import type { ReactElement } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { InteractionManager, Pressable, StyleSheet, View } from "react-native";

import { getRepository } from "../db";
import { Profile } from "../db/repo";
import { loadActiveProfileId, saveActiveProfileId } from "../domain/AppState";
import { syncNotifications } from "../domain/syncNotifications";
import { devSyncLogger } from "../domain/devSyncLogger";
import { ExpoNotificationAdapter } from "../utils/expoNotificationAdapter";
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  EmptyState,
  ErrorBanner,
  LoadingIndicator,
  ProfileAvatar,
  ScreenContainer,
  colors,
  spacing,
} from "../ui";
import { AVATAR_PALETTE, avatarColorIndex } from "../ui/avatarColor";
import type { ProfilesStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<ProfilesStackParamList, "Profiles">;

const repository = getRepository();

export function ProfilesScreen({ navigation }: Props): ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cycleCounts, setCycleCounts] = useState<Map<number, number>>(new Map());
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextProfiles, currentActiveId] = await Promise.all([
        repository.listProfiles(),
        loadActiveProfileId(),
      ]);

      const startsPerProfile = await Promise.all(
        nextProfiles.map((p) => repository.listCycleStarts(p.id)),
      );
      const counts = new Map<number, number>();
      nextProfiles.forEach((p, i) => counts.set(p.id, startsPerProfile[i].length));

      setProfiles(nextProfiles);
      setCycleCounts(counts);
      setActiveProfileId(currentActiveId);
    } catch {
      setError("Failed to load profiles.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void loadProfiles();
      });
      return () => task.cancel();
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
      setActiveProfileId(profileId);
      navigation.navigate("CycleLog", { profileId });

      // Fire-and-forget: re-sync notifications after profile switch
      syncNotifications(
        repository,
        new ExpoNotificationAdapter(),
        __DEV__ ? devSyncLogger : undefined,
      ).catch((err) => console.error("[NotifSync] sync failed:", err));
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

      {isLoading ? <LoadingIndicator /> : null}

      {!isLoading && profiles.length === 0 ? (
        <EmptyState
          message="Create your first profile to start tracking."
        />
      ) : null}

      {!isLoading && profiles.length > 0 ? (
        <AppText variant="label" color={colors.textMuted} style={styles.sectionLabel}>
          Select a profile
        </AppText>
      ) : null}

      {profiles.map((profile) => {
        const accent = AVATAR_PALETTE[avatarColorIndex(profile.name)];
        const count = cycleCounts.get(profile.id) ?? 0;
        return (
          <Pressable
            key={profile.id}
            onPress={() => {
              void onSelectProfile(profile.id);
            }}
            accessibilityRole="button"
          >
            <AppCard
              style={[
                styles.profileCard,
                { borderLeftWidth: 2, borderLeftColor: accent },
              ]}
            >
              <ProfileAvatar name={profile.name} size={32} />
              <View style={styles.profileInfo}>
                <View style={styles.profileNameRow}>
                  <AppText variant="subheading">{profile.name}</AppText>
                  {activeProfileId === profile.id && (
                    <View
                      style={[styles.activeDot, { backgroundColor: accent }]}
                    />
                  )}
                </View>
                <AppText variant="caption" color={colors.textMuted}>
                  {count > 0 ? `${count} cycle${count === 1 ? "" : "s"}` : "No cycles yet"}
                </AppText>
              </View>
            </AppCard>
          </Pressable>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xs,
  },
  inputRow: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  addButton: {
    marginTop: spacing.xs,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  profileCard: {
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  profileInfo: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

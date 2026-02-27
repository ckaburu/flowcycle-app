import type { ReactElement } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Alert, InteractionManager, Platform, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { getRepository } from "../db";
import { Profile } from "../db/repo";
import { loadActiveProfileId, saveActiveProfileId } from "../domain/AppState";
import { deleteProfileAndReassignActive } from "../domain/profileLifecycle";
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

  // Rename state
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

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
    if (renamingId !== null) return; // Don't navigate while renaming
    try {
      setError(null);
      await saveActiveProfileId(profileId);
      setActiveProfileId(profileId);
      navigation.navigate("CycleLog", { profileId });

      syncNotifications(
        repository,
        new ExpoNotificationAdapter(),
        __DEV__ ? devSyncLogger : undefined,
      ).catch((err) => console.error("[NotifSync] sync failed:", err));
    } catch {
      setError("Failed to set active profile.");
    }
  };

  const onStartRename = (profile: Profile): void => {
    setRenamingId(profile.id);
    setRenameValue(profile.name);
    setError(null);
  };

  const onCancelRename = (): void => {
    setRenamingId(null);
    setRenameValue("");
  };

  const onConfirmRename = async (): Promise<void> => {
    if (renamingId === null) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setError("Profile name is required.");
      return;
    }
    try {
      setError(null);
      await repository.renameProfile(renamingId, trimmed);
      setRenamingId(null);
      setRenameValue("");
      await loadProfiles();
    } catch {
      setError("Failed to rename profile.");
    }
  };

  const onDeleteProfile = (profile: Profile): void => {
    Alert.alert(
      "Delete Profile",
      `Delete "${profile.name}" and all its data? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void confirmDelete(profile.id),
        },
      ],
    );
  };

  const confirmDelete = async (profileId: number): Promise<void> => {
    try {
      setError(null);
      const adapter = new ExpoNotificationAdapter();
      await deleteProfileAndReassignActive(
        repository,
        adapter,
        profileId,
        __DEV__ ? devSyncLogger : undefined,
      );
      // If we were renaming this profile, cancel
      if (renamingId === profileId) {
        setRenamingId(null);
        setRenameValue("");
      }
      await loadProfiles();
    } catch {
      setError("Failed to delete profile.");
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
        const isActive = activeProfileId === profile.id;
        const isRenaming = renamingId === profile.id;

        return (
          <Pressable
            key={profile.id}
            onPress={() => {
              void onSelectProfile(profile.id);
            }}
            accessibilityRole="button"
            android_ripple={
              Platform.OS === "android" && !isRenaming
                ? { color: `${accent}20` }
                : undefined
            }
          >
            <AppCard
              style={[
                styles.profileCard,
                isActive
                  ? { backgroundColor: `${accent}14` }
                  : { borderLeftWidth: 2, borderLeftColor: accent },
              ]}
            >
              <ProfileAvatar name={profile.name} size={32} />
              <View style={styles.profileInfo}>
                {isRenaming ? (
                  <View style={styles.renameRow}>
                    <AppInput
                      value={renameValue}
                      onChangeText={setRenameValue}
                      autoCapitalize="words"
                      autoFocus
                      style={styles.renameInput}
                    />
                    <Pressable
                      onPress={() => void onConfirmRename()}
                      hitSlop={8}
                      testID={`profile-rename-save-${profile.id}`}
                    >
                      <Feather name="check" size={20} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={onCancelRename}
                      hitSlop={8}
                      testID={`profile-rename-cancel-${profile.id}`}
                    >
                      <Feather name="x" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.profileNameRow}>
                      <AppText variant="subheading">{profile.name}</AppText>
                      {isActive && (
                        <View
                          style={[styles.activeDot, { backgroundColor: accent }]}
                        />
                      )}
                    </View>
                    <AppText variant="caption" color={colors.textMuted}>
                      {count > 0 ? `${count} cycle${count === 1 ? "" : "s"}` : "No cycles yet"}
                    </AppText>
                  </>
                )}
              </View>
              {!isRenaming && (
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => onStartRename(profile)}
                    hitSlop={8}
                    testID={`profile-rename-${profile.id}`}
                  >
                    <Feather name="edit-2" size={16} color={colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => onDeleteProfile(profile)}
                    hitSlop={8}
                    testID={`profile-delete-${profile.id}`}
                  >
                    <Feather name="trash-2" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  renameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  renameInput: {
    flex: 1,
  },
});

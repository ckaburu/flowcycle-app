import { useState, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { AppText } from "../ui/AppText";
import { CycleDayRing } from "../ui/CycleDayRing";
import { EmptyState } from "../ui/EmptyState";
import { ErrorBanner } from "../ui/ErrorBanner";
import { LoadingIndicator } from "../ui/LoadingIndicator";
import { ProfileAvatar } from "../ui/ProfileAvatar";
import { ScreenContainer } from "../ui/ScreenContainer";
import { colors, spacing } from "../ui/tokens";

import { useDashboardData } from "../hooks/useDashboardData";
import { quickLogCycleStart } from "../domain/quickLogCycleStart";
import { formatIsoDate } from "../domain/cycleMath";
import { getRepository } from "../db";

import type { DashboardStackParamList, TabParamList } from "../navigation/types";

// ─── Types ───────────────────────────────────────────────────────────

type Props = CompositeScreenProps<
  NativeStackScreenProps<DashboardStackParamList, "Dashboard">,
  BottomTabScreenProps<TabParamList>
>;

// ─── Component ───────────────────────────────────────────────────────

export function DashboardScreen({ navigation }: Props): ReactElement {
  const { data, isLoading, error, refresh, clearError } = useDashboardData();
  const [logError, setLogError] = useState<string | null>(null);

  const handleLogPeriod = async (): Promise<void> => {
    if (!data) return;
    setLogError(null);
    const todayIso = formatIsoDate(new Date());
    const result = await quickLogCycleStart(
      data.profileId,
      todayIso,
      getRepository(),
    );
    if (result.status === "created") {
      refresh();
    } else {
      setLogError("A cycle start already exists for today.");
    }
  };

  const handleNavigateProfiles = (): void => {
    navigation.navigate("ProfilesTab", { screen: "Profiles" });
  };

  const handleNavigateCycleLog = (): void => {
    if (data) {
      navigation.navigate("ProfilesTab", {
        screen: "CycleLog",
        params: { profileId: data.profileId },
      });
    }
  };

  const dismissError = (): void => {
    clearError();
    setLogError(null);
  };

  // Determine which error to show (hook error takes priority)
  const displayError = error ?? logError;

  // ─── Loading state ─────────────────────────────────────────────────

  if (isLoading && !data) {
    return (
      <ScreenContainer>
        <LoadingIndicator />
      </ScreenContainer>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      {displayError ? (
        <ErrorBanner message={displayError} onDismiss={dismissError} />
      ) : null}

      {/* Header row: avatar + greeting */}
      {data ? (
        <View style={styles.headerRow}>
          <ProfileAvatar
            name={data.profileName}
            size={40}
            onPress={handleNavigateProfiles}
          />
          <AppText
            variant="subheading"
            style={styles.greeting}
            numberOfLines={1}
          >
            Hi, {data.profileName}
          </AppText>
          <View style={styles.spacer} />
        </View>
      ) : null}

      {/* Cycle Day Ring */}
      <View style={styles.ringContainer}>
        <CycleDayRing
          cycleDay={data?.cycleDay ?? null}
          typicalLength={data?.typicalLength ?? null}
        />
      </View>

      {/* Info card — only when there is cycle data */}
      {data && data.lastStart ? (
        <AppCard style={styles.infoCard}>
          <View style={styles.dataRow}>
            <AppText variant="body" style={styles.dataLabel}>
              Last start
            </AppText>
            <AppText variant="body">{data.lastStart}</AppText>
          </View>
          <View style={styles.dataRow}>
            <AppText variant="body" style={styles.dataLabel}>
              Typical length
            </AppText>
            <AppText variant="body">
              {data.typicalLength !== null
                ? `${data.typicalLength} days`
                : "—"}
            </AppText>
          </View>
          <View style={styles.dataRow}>
            <AppText variant="body" style={styles.dataLabel}>
              Next estimate
            </AppText>
            <AppText variant="body">
              {data.nextStartEstimate ?? "—"}
            </AppText>
          </View>
        </AppCard>
      ) : null}

      {/* Empty state hint */}
      {data && !data.lastStart ? (
        <EmptyState
          message="Log your first period to start tracking."
          style={styles.emptyHint}
        />
      ) : null}

      {/* Log Period button */}
      <AppButton
        title="Log Period Start"
        onPress={() => {
          void handleLogPeriod();
        }}
        disabled={isLoading || !data}
        style={styles.logButton}
      />

      {/* View Cycle Log link */}
      {data ? (
        <AppButton
          title="View Cycle Log"
          variant="ghost"
          onPress={handleNavigateCycleLog}
          style={styles.cycleLogLink}
        />
      ) : null}
    </ScreenContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  greeting: {
    marginLeft: spacing.sm,
    color: colors.text,
    flex: 1,
  },
  spacer: {
    width: spacing.md,
  },
  ringContainer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  infoCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  dataLabel: {
    color: colors.textMuted,
  },
  emptyHint: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  logButton: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  cycleLogLink: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
});

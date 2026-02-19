import type { NavigatorScreenParams } from "@react-navigation/native";

// ── Tab-level ──────────────────────────────────────────────
export type TabParamList = {
  DashboardTab: NavigatorScreenParams<DashboardStackParamList>;
  ProfilesTab: NavigatorScreenParams<ProfilesStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};

// ── Per-tab stacks ─────────────────────────────────────────
export type DashboardStackParamList = {
  Dashboard: undefined;
};

export type ProfilesStackParamList = {
  Profiles: undefined;
  CycleLog: { profileId: number };
};

export type SettingsStackParamList = {
  Settings: undefined;
  SetupPin: { mode: "set" | "change" | "remove" };
};

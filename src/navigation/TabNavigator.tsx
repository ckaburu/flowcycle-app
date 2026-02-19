import type { ReactElement } from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { CycleLogScreen } from "../screens/CycleLogScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { ProfilesScreen } from "../screens/ProfilesScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SetupPinScreen } from "../screens/SetupPinScreen";
import { colors } from "../ui/tokens";
import type {
  DashboardStackParamList,
  ProfilesStackParamList,
  SettingsStackParamList,
  TabParamList,
} from "./types";

// ── Per-tab stacks ─────────────────────────────────────────

const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();
const ProfilesStack = createNativeStackNavigator<ProfilesStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.primary,
  headerTitleStyle: { color: colors.text, fontWeight: "600" as const },
  contentStyle: { backgroundColor: colors.background },
} as const;

function DashboardTab(): ReactElement {
  return (
    <DashboardStack.Navigator screenOptions={stackScreenOptions}>
      <DashboardStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "Dashboard" }}
      />
    </DashboardStack.Navigator>
  );
}

function ProfilesTab(): ReactElement {
  return (
    <ProfilesStack.Navigator screenOptions={stackScreenOptions}>
      <ProfilesStack.Screen
        name="Profiles"
        component={ProfilesScreen}
        options={{ title: "Profiles" }}
      />
      <ProfilesStack.Screen
        name="CycleLog"
        component={CycleLogScreen}
        options={{ title: "Cycle Log" }}
      />
    </ProfilesStack.Navigator>
  );
}

function SettingsTab(): ReactElement {
  return (
    <SettingsStack.Navigator screenOptions={stackScreenOptions}>
      <SettingsStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <SettingsStack.Screen
        name="SetupPin"
        component={SetupPinScreen}
        options={{ title: "PIN Settings" }}
      />
    </SettingsStack.Navigator>
  );
}

// ── Tab navigator ──────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator(): ReactElement {
  return (
    <Tab.Navigator
      initialRouteName="DashboardTab"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardTab}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProfilesTab"
        component={ProfilesTab}
        options={{
          tabBarLabel: "Profiles",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>👤</Text>
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsTab}
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

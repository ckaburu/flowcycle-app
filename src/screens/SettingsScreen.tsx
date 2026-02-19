import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { InteractionManager } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { isPinSet } from "../domain/LockState";
import type { SettingsStackParamList } from "../navigation/types";
import { ListItem, SectionHeader, ScreenContainer, AppText } from "../ui";
import { spacing } from "../ui/tokens";

type Props = NativeStackScreenProps<SettingsStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props): ReactElement {
  const [pinSet, setPinSet] = useState(false);

  const checkPinStatus = useCallback(async (): Promise<void> => {
    const result = await isPinSet();
    setPinSet(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void checkPinStatus();
      });
      return () => task.cancel();
    }, [checkPinStatus]),
  );

  return (
    <ScreenContainer>
      <AppText variant="heading" style={{ marginBottom: spacing.sm }}>
        Settings
      </AppText>

      <SectionHeader title="Security" />

      {pinSet ? (
        <>
          <ListItem
            label="Change PIN"
            onPress={() =>
              navigation.navigate("SetupPin", { mode: "change" })
            }
            testID="settings-change-pin"
          />
          <ListItem
            label="Remove PIN"
            onPress={() =>
              navigation.navigate("SetupPin", { mode: "remove" })
            }
            testID="settings-remove-pin"
          />
        </>
      ) : (
        <ListItem
          label="Set PIN"
          onPress={() => navigation.navigate("SetupPin", { mode: "set" })}
          testID="settings-set-pin"
        />
      )}

      <SectionHeader title="About" />

      <ListItem label="Version" value="0.3.0" testID="settings-version" />
    </ScreenContainer>
  );
}

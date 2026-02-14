import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Button, Text, TextInput, View } from "react-native";

import { getRepository } from "../db";
import { Profile } from "../db/repo";
import { saveActiveProfileId } from "../domain/AppState";
import { RootStackParamList } from "./navigationTypes";

type Props = NativeStackScreenProps<RootStackParamList, "Profiles">;

const repository = getRepository();

export function ProfilesScreen({ navigation }: Props): JSX.Element {
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
    <View>
      <Text>Profiles</Text>

      {isLoading ? <Text>Loading...</Text> : null}
      {error ? <Text>{error}</Text> : null}

      {!isLoading && profiles.length === 0 ? <Text>No profiles yet.</Text> : null}

      {profiles.map((profile) => (
        <Button
          key={profile.id}
          title={`${profile.name} (id: ${profile.id})`}
          onPress={() => {
            void onSelectProfile(profile.id);
          }}
        />
      ))}

      <TextInput
        value={newProfileName}
        onChangeText={setNewProfileName}
        placeholder="New profile name"
        autoCapitalize="words"
      />
      <Button
        title="Add Profile"
        onPress={() => {
          void onAddProfile();
        }}
      />
    </View>
  );
}

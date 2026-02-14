import AsyncStorage from "@react-native-async-storage/async-storage";

const ACTIVE_PROFILE_ID_KEY = "flowcycle.activeProfileId";

export type AppState = {
  activeProfileId: number | null;
};

const appState: AppState = {
  activeProfileId: null,
};

function parseActiveProfileId(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function getAppState(): AppState {
  return { ...appState };
}

export async function loadActiveProfileId(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_PROFILE_ID_KEY);
  const activeProfileId = parseActiveProfileId(raw);
  appState.activeProfileId = activeProfileId;
  return activeProfileId;
}

export async function saveActiveProfileId(id: number | null): Promise<void> {
  appState.activeProfileId = id;

  if (id === null) {
    await AsyncStorage.removeItem(ACTIVE_PROFILE_ID_KEY);
    return;
  }

  await AsyncStorage.setItem(ACTIVE_PROFILE_ID_KEY, String(id));
}

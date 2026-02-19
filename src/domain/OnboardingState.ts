import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_COMPLETED_KEY = "flowcycle.onboardingCompleted";

type OnboardingStateData = {
  isCompleted: boolean;
};

const onboardingState: OnboardingStateData = {
  isCompleted: false,
};

export async function loadOnboardingCompleted(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
  onboardingState.isCompleted = raw === "true";
  return onboardingState.isCompleted;
}

export async function completeOnboarding(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
  onboardingState.isCompleted = true;
}

export function isOnboardingCompleted(): boolean {
  return onboardingState.isCompleted;
}

export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
  onboardingState.isCompleted = false;
}

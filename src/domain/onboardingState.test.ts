import {
  loadOnboardingCompleted,
  completeOnboarding,
  isOnboardingCompleted,
  resetOnboarding,
} from "./OnboardingState";

const mockStore: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => mockStore[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
}));

function clearMockStore(): void {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
}

beforeEach(async () => {
  clearMockStore();
  await resetOnboarding();
});

describe("OnboardingState", () => {
  it("isOnboardingCompleted returns false by default", () => {
    expect(isOnboardingCompleted()).toBe(false);
  });

  it("loadOnboardingCompleted reads true from AsyncStorage", async () => {
    mockStore["flowcycle.onboardingCompleted"] = "true";
    const result = await loadOnboardingCompleted();
    expect(result).toBe(true);
    expect(isOnboardingCompleted()).toBe(true);
  });

  it("loadOnboardingCompleted returns false when key absent", async () => {
    const result = await loadOnboardingCompleted();
    expect(result).toBe(false);
    expect(isOnboardingCompleted()).toBe(false);
  });

  it("completeOnboarding writes flag and updates state", async () => {
    await completeOnboarding();
    expect(mockStore["flowcycle.onboardingCompleted"]).toBe("true");
    expect(isOnboardingCompleted()).toBe(true);
  });

  it("resetOnboarding clears flag", async () => {
    await completeOnboarding();
    expect(isOnboardingCompleted()).toBe(true);
    await resetOnboarding();
    expect(mockStore["flowcycle.onboardingCompleted"]).toBeUndefined();
    expect(isOnboardingCompleted()).toBe(false);
  });
});

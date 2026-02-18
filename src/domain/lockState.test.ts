import {
  computeLockoutMs,
  enableBiometric,
  disableBiometric,
  getLockState,
  initLockState,
  isPinSet,
  lockApp,
  onBackground,
  removePin,
  setPin,
  shouldRelock,
  unlockApp,
  verifyPin,
  checkBiometricAvailability,
  getLockoutRemainingMs,
  isLockedOut,
} from "./LockState";

// ── Mocks ────────────────────────────────────────────────────────────

// Stub NativeModules so the guard in checkBiometricAvailability passes
jest.mock("react-native", () => ({
  NativeModules: { ExpoLocalAuthentication: {} },
}));

const mockStore: Record<string, string> = {};

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  CryptoEncoding: { BASE64: "base64" },
  digestStringAsync: jest.fn(async (_alg: string, data: string) => data),
  getRandomBytes: jest.fn(() => new Uint8Array(16).fill(42)),
}));

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LocalAuth =
  require("expo-local-authentication") as typeof import("expo-local-authentication");
const mockHasHardwareAsync = LocalAuth.hasHardwareAsync as jest.Mock;
const mockIsEnrolledAsync = LocalAuth.isEnrolledAsync as jest.Mock;

// ── Helpers ──────────────────────────────────────────────────────────

function clearMockStore(): void {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
}

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(async () => {
  clearMockStore();
  mockHasHardwareAsync.mockResolvedValue(false);
  mockIsEnrolledAsync.mockResolvedValue(false);
  await initLockState();
});

// ── Backoff timing ───────────────────────────────────────────────────

describe("computeLockoutMs", () => {
  it("returns 0 for failures 1-3", () => {
    expect(computeLockoutMs(1)).toBe(0);
    expect(computeLockoutMs(2)).toBe(0);
    expect(computeLockoutMs(3)).toBe(0);
  });

  it("returns 5000 for failure 4", () => {
    expect(computeLockoutMs(4)).toBe(5_000);
  });

  it("returns 15000 for failure 5", () => {
    expect(computeLockoutMs(5)).toBe(15_000);
  });

  it("returns 60000 for failure 6", () => {
    expect(computeLockoutMs(6)).toBe(60_000);
  });

  it("returns 300000 (5 min cap) for failure 7+", () => {
    expect(computeLockoutMs(7)).toBe(300_000);
    expect(computeLockoutMs(100)).toBe(300_000);
  });

  it("returns 0 for 0 or negative", () => {
    expect(computeLockoutMs(0)).toBe(0);
    expect(computeLockoutMs(-1)).toBe(0);
  });
});

// ── Hash verification ────────────────────────────────────────────────

describe("setPin and verifyPin", () => {
  it("stores credentials and verifyPin succeeds with correct PIN", async () => {
    await setPin("123456");
    expect(await isPinSet()).toBe(true);

    const result = await verifyPin("123456");
    expect(result.success).toBe(true);
    expect(result.lockoutRemainingMs).toBeNull();
  });

  it("verifyPin fails with wrong PIN", async () => {
    await setPin("123456");
    const result = await verifyPin("000000");
    expect(result.success).toBe(false);
  });

  it("verifyPin resets failedAttempts on success", async () => {
    await setPin("123456");
    await verifyPin("000000");
    await verifyPin("000000");
    await verifyPin("000000");
    expect(getLockState().failedAttempts).toBe(3);

    const result = await verifyPin("123456");
    expect(result.success).toBe(true);
    expect(getLockState().failedAttempts).toBe(0);
    expect(getLockState().lockUntil).toBeNull();
  });

  it("rejects non-6-digit PIN", async () => {
    await expect(setPin("12345")).rejects.toThrow();
    await expect(setPin("1234567")).rejects.toThrow();
    await expect(setPin("abcdef")).rejects.toThrow();
  });

  it("returns { success: false } when no PIN is set", async () => {
    const result = await verifyPin("123456");
    expect(result.success).toBe(false);
    expect(result.lockoutRemainingMs).toBeNull();
  });
});

// ── removePin ────────────────────────────────────────────────────────

describe("removePin", () => {
  it("clears credentials when given correct PIN", async () => {
    await setPin("123456");
    const removed = await removePin("123456");
    expect(removed).toBe(true);
    expect(await isPinSet()).toBe(false);
    expect(getLockState().isPinSet).toBe(false);
    expect(getLockState().isLocked).toBe(false);
  });

  it("returns false when given wrong PIN", async () => {
    await setPin("123456");
    const removed = await removePin("000000");
    expect(removed).toBe(false);
    expect(await isPinSet()).toBe(true);
  });
});

// ── Lockout persistence ──────────────────────────────────────────────

describe("lockout persistence", () => {
  it("persists failedAttempts and lockUntil after 4 failures", async () => {
    await setPin("123456");
    for (let i = 0; i < 4; i++) {
      await verifyPin("000000");
    }

    expect(getLockState().failedAttempts).toBe(4);
    expect(getLockState().lockUntil).toBeInstanceOf(Date);

    const raw = mockStore["pin_credentials_v1"];
    const creds = JSON.parse(raw);
    expect(creds.failedAttempts).toBe(4);
    expect(creds.lockUntil).toBeTruthy();
  });

  it("rejects verifyPin during active lockout", async () => {
    await setPin("123456");
    for (let i = 0; i < 4; i++) {
      await verifyPin("000000");
    }

    // lockUntil is ~5 s in future; correct PIN should still be rejected
    const result = await verifyPin("123456");
    expect(result.success).toBe(false);
    expect(result.lockoutRemainingMs).toBeGreaterThan(0);
  });

  it("cold restart reads persisted state", async () => {
    await setPin("123456");
    for (let i = 0; i < 4; i++) {
      await verifyPin("000000");
    }

    await initLockState(); // simulate cold restart

    const state = getLockState();
    expect(state.isPinSet).toBe(true);
    expect(state.isLocked).toBe(true);
    expect(state.failedAttempts).toBe(4);
    expect(state.lockUntil).toBeInstanceOf(Date);
  });
});

// ── Background timeout ───────────────────────────────────────────────

describe("background timeout", () => {
  it("shouldRelock returns false when no background timestamp", () => {
    expect(shouldRelock()).toBe(false);
  });

  it("shouldRelock returns false when elapsed < 30 s", async () => {
    await setPin("123456");
    onBackground();
    expect(shouldRelock()).toBe(false);
  });

  it("shouldRelock returns true when elapsed >= 30 s", async () => {
    await setPin("123456");
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);
    onBackground();
    (Date.now as jest.Mock).mockReturnValue(now + 31_000);

    expect(shouldRelock()).toBe(true);

    (Date.now as jest.Mock).mockRestore();
  });

  it("shouldRelock returns false when no PIN is set", () => {
    onBackground();
    expect(shouldRelock()).toBe(false);
  });
});

// ── State isolation ──────────────────────────────────────────────────

describe("state isolation", () => {
  it("getLockState returns shallow copy, not reference", () => {
    const s1 = getLockState();
    const s2 = getLockState();
    expect(s1).toEqual(s2);
    expect(s1).not.toBe(s2);

    s1.isLocked = true;
    expect(getLockState().isLocked).toBe(false);
  });

  it("initLockState reads existing PIN state from SecureStore", async () => {
    await setPin("123456");
    await initLockState();

    const state = getLockState();
    expect(state.isPinSet).toBe(true);
    expect(state.isLocked).toBe(true); // cold launch always locks
  });
});

// ── Lock lifecycle ───────────────────────────────────────────────────

describe("lock lifecycle", () => {
  it("lockApp only locks when PIN is set", async () => {
    lockApp();
    expect(getLockState().isLocked).toBe(false);

    await setPin("123456");
    lockApp();
    expect(getLockState().isLocked).toBe(true);
  });

  it("unlockApp clears isLocked", async () => {
    await setPin("123456");
    lockApp();
    unlockApp();
    expect(getLockState().isLocked).toBe(false);
  });
});

// ── Biometric ────────────────────────────────────────────────────────

describe("biometric", () => {
  it("returns false when no hardware", async () => {
    expect(await checkBiometricAvailability()).toBe(false);
    expect(getLockState().isBiometricAvailable).toBe(false);
  });

  it("returns true when hardware and enrollment present", async () => {
    mockHasHardwareAsync.mockResolvedValueOnce(true);
    mockIsEnrolledAsync.mockResolvedValueOnce(true);

    expect(await checkBiometricAvailability()).toBe(true);
    expect(getLockState().isBiometricAvailable).toBe(true);
  });

  it("enableBiometric and disableBiometric toggle state", async () => {
    await enableBiometric();
    expect(getLockState().isBiometricEnabled).toBe(true);
    expect(mockStore["biometric_enabled_v1"]).toBe("true");

    await disableBiometric();
    expect(getLockState().isBiometricEnabled).toBe(false);
    expect(mockStore["biometric_enabled_v1"]).toBeUndefined();
  });
});

// ── Lockout helpers ──────────────────────────────────────────────────

describe("lockout helpers", () => {
  it("getLockoutRemainingMs returns 0 when not locked out", () => {
    expect(getLockoutRemainingMs()).toBe(0);
  });

  it("isLockedOut returns false when not locked out", () => {
    expect(isLockedOut()).toBe(false);
  });
});

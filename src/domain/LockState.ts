import { NativeModules } from "react-native";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// ── Constants ────────────────────────────────────────────────────────

export const PIN_LENGTH = 6;
export const LOCK_TIMEOUT_MS = 30_000; // 30 s background → relock

const PIN_CREDENTIALS_KEY = "pin_credentials_v1";
const BIOMETRIC_ENABLED_KEY = "biometric_enabled_v1";

const BACKOFF_TABLE: readonly number[] = [
  0, 0, 0, // failures 1-3: no delay
  5_000, // failure 4: 5 s
  15_000, // failure 5: 15 s
  60_000, // failure 6: 60 s
];
const MAX_LOCKOUT_MS = 300_000; // failure 7+: 5 min

// ── Types ────────────────────────────────────────────────────────────

export type VerifyResult = {
  success: boolean;
  lockoutRemainingMs: number | null;
};

type PinCredentials = {
  salt: string; // base64-encoded 16 random bytes
  hash: string; // base64-encoded SHA-256(salt + pin)
  failedAttempts: number;
  lockUntil: string | null; // ISO 8601 or null
};

export type LockStateData = {
  isLocked: boolean;
  isPinSet: boolean;
  isBiometricEnabled: boolean;
  isBiometricAvailable: boolean;
  failedAttempts: number;
  lockUntil: Date | null;
  lastBackgroundedAt: number | null;
};

// ── Module-level state (never exported directly) ─────────────────────

const lockState: LockStateData = {
  isLocked: false,
  isPinSet: false,
  isBiometricEnabled: false,
  isBiometricAvailable: false,
  failedAttempts: 0,
  lockUntil: null,
  lastBackgroundedAt: null,
};

// ── Internal helpers ─────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function computeLockoutMs(failedAttempts: number): number {
  if (failedAttempts <= 0) return 0;
  if (failedAttempts <= BACKOFF_TABLE.length) {
    return BACKOFF_TABLE[failedAttempts - 1];
  }
  return MAX_LOCKOUT_MS;
}

function computeLockUntil(failedAttempts: number): string | null {
  const ms = computeLockoutMs(failedAttempts);
  if (ms === 0) return null;
  return new Date(Date.now() + ms).toISOString();
}

async function hashPin(salt: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + pin,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
}

async function readCredentials(): Promise<PinCredentials | null> {
  const raw = await SecureStore.getItemAsync(PIN_CREDENTIALS_KEY);
  if (raw === null) return null;
  return JSON.parse(raw) as PinCredentials;
}

async function writeCredentials(creds: PinCredentials): Promise<void> {
  await SecureStore.setItemAsync(
    PIN_CREDENTIALS_KEY,
    JSON.stringify(creds),
  );
}

// ── Exported: state getter ───────────────────────────────────────────

export function getLockState(): LockStateData {
  return { ...lockState };
}

// ── Exported: init ───────────────────────────────────────────────────

export async function initLockState(): Promise<void> {
  // Reset transient state
  lockState.lastBackgroundedAt = null;

  try {
    const creds = await readCredentials();
    if (creds) {
      lockState.isPinSet = true;
      lockState.failedAttempts = creds.failedAttempts;
      lockState.lockUntil = creds.lockUntil
        ? new Date(creds.lockUntil)
        : null;
      lockState.isLocked = true; // cold launch always locks when PIN set
    } else {
      lockState.isPinSet = false;
      lockState.isLocked = false;
      lockState.failedAttempts = 0;
      lockState.lockUntil = null;
    }

    const biometricFlag = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    lockState.isBiometricEnabled = biometricFlag === "true";
    lockState.isBiometricAvailable = await checkBiometricAvailability();
  } catch (error) {
    console.warn("Failed to init lock state, falling back to unlocked:", error);
    lockState.isPinSet = false;
    lockState.isLocked = false;
    lockState.isBiometricEnabled = false;
    lockState.isBiometricAvailable = false;
    lockState.failedAttempts = 0;
    lockState.lockUntil = null;
  }
}

// ── Exported: PIN management ─────────────────────────────────────────

export async function setPin(pin: string): Promise<void> {
  if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
    throw new Error(`PIN must be exactly ${PIN_LENGTH} digits`);
  }

  const saltBytes = Crypto.getRandomBytes(16);
  const salt = bytesToBase64(saltBytes);
  const hash = await hashPin(salt, pin);

  const creds: PinCredentials = {
    salt,
    hash,
    failedAttempts: 0,
    lockUntil: null,
  };

  await writeCredentials(creds);
  lockState.isPinSet = true;
  lockState.failedAttempts = 0;
  lockState.lockUntil = null;
}

export async function verifyPin(pin: string): Promise<VerifyResult> {
  const creds = await readCredentials();
  if (!creds) {
    return { success: false, lockoutRemainingMs: null };
  }

  // Reject if currently locked out
  if (creds.lockUntil) {
    const remaining = new Date(creds.lockUntil).getTime() - Date.now();
    if (remaining > 0) {
      return { success: false, lockoutRemainingMs: remaining };
    }
  }

  const candidate = await hashPin(creds.salt, pin);

  if (candidate === creds.hash) {
    // Success → reset backoff
    creds.failedAttempts = 0;
    creds.lockUntil = null;
    await writeCredentials(creds);
    lockState.failedAttempts = 0;
    lockState.lockUntil = null;
    return { success: true, lockoutRemainingMs: null };
  }

  // Failure → increment backoff
  creds.failedAttempts += 1;
  creds.lockUntil = computeLockUntil(creds.failedAttempts);
  await writeCredentials(creds);
  lockState.failedAttempts = creds.failedAttempts;
  lockState.lockUntil = creds.lockUntil ? new Date(creds.lockUntil) : null;

  const lockoutMs = computeLockoutMs(creds.failedAttempts);
  return {
    success: false,
    lockoutRemainingMs: lockoutMs > 0 ? lockoutMs : null,
  };
}

export async function removePin(currentPin: string): Promise<boolean> {
  const result = await verifyPin(currentPin);
  if (!result.success) return false;

  await SecureStore.deleteItemAsync(PIN_CREDENTIALS_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  lockState.isPinSet = false;
  lockState.isLocked = false;
  lockState.isBiometricEnabled = false;
  lockState.failedAttempts = 0;
  lockState.lockUntil = null;
  return true;
}

export async function isPinSet(): Promise<boolean> {
  const creds = await readCredentials();
  return creds !== null;
}

// ── Exported: biometric ──────────────────────────────────────────────

export async function checkBiometricAvailability(): Promise<boolean> {
  try {
    // Guard: skip if native module is not built into the binary
    if (!NativeModules.ExpoLocalAuthentication) {
      lockState.isBiometricAvailable = false;
      return false;
    }
    const LocalAuthentication =
      require("expo-local-authentication") as typeof import("expo-local-authentication");
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const available = hasHardware && isEnrolled;
    lockState.isBiometricAvailable = available;
    return available;
  } catch {
    lockState.isBiometricAvailable = false;
    return false;
  }
}

export async function enableBiometric(): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
  lockState.isBiometricEnabled = true;
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  lockState.isBiometricEnabled = false;
}

// ── Exported: lock lifecycle ─────────────────────────────────────────

export function lockApp(): void {
  if (lockState.isPinSet) {
    lockState.isLocked = true;
  }
}

export function unlockApp(): void {
  lockState.isLocked = false;
}

export function onBackground(): void {
  lockState.lastBackgroundedAt = Date.now();
}

export function shouldRelock(): boolean {
  if (!lockState.isPinSet) return false;
  if (lockState.lastBackgroundedAt === null) return false;
  const elapsed = Date.now() - lockState.lastBackgroundedAt;
  return elapsed >= LOCK_TIMEOUT_MS;
}

// ── Exported: backoff helpers ────────────────────────────────────────

export function getLockoutRemainingMs(): number {
  if (!lockState.lockUntil) return 0;
  const remaining = lockState.lockUntil.getTime() - Date.now();
  return Math.max(0, remaining);
}

export function isLockedOut(): boolean {
  return getLockoutRemainingMs() > 0;
}

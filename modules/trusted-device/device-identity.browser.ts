import { DeviceIdentityProvider } from './device-identity.types';
import { TrustedDeviceIdentity } from './trusted-device.types';

/**
 * BROWSER device identity provider.
 *
 * DEVELOPMENT / BROWSER ONLY.
 *
 * This provider produces a deterministic browser-safe identity used only for
 * development and browser-based testing of the trusted-device flow. It is
 * explicitly NOT the production device identity: the production target is a
 * Capacitor Android application whose identity comes from the native provider
 * (device-identity.native.ts). Selecting the native provider on native
 * platforms guarantees this browser identity can never affect Android behavior.
 *
 * Identity rules:
 * - Deterministic for the same browser profile (persisted per origin/profile).
 * - A different browser profile (or incognito context with cleared storage)
 *   yields a different identity, so profiles can represent different test
 *   devices.
 * - An explicit test override (`BrowserDeviceIdentity.setOverride(...)`)
 *   simulates "a different device" without changing the profile.
 *
 * No browser fingerprinting, IP address, or user-agent-derived identity is
 * used as the device identifier.
 */

const IDENTITY_STORAGE_KEY = 'sapana.device_identity.browser.v1';
const OVERRIDE_STORAGE_KEY = 'sapana.device_identity.browser.override.v1';

const MEMORY_STORE: Record<string, string> = {};

function storageGet(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        return value;
      }
    } catch {
      // Storage unavailable: fall through to in-memory store.
    }
  }
  return MEMORY_STORE[key] ?? null;
}

function storageSet(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
      return;
    } catch {
      // Storage unavailable: fall through to in-memory store.
    }
  }
  MEMORY_STORE[key] = value;
}

function storageRemove(key: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage unavailable: fall through to in-memory store.
    }
  }
  delete MEMORY_STORE[key];
}

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'browser-dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 12);
}

export const browserDeviceIdentityProvider: DeviceIdentityProvider = {
  kind: 'browser',
  developmentOnly: true,

  async getIdentity(): Promise<TrustedDeviceIdentity> {
    const override = storageGet(OVERRIDE_STORAGE_KEY);
    const deviceId = override ?? storageGet(IDENTITY_STORAGE_KEY) ?? (() => {
      const generated = generateDeviceId();
      storageSet(IDENTITY_STORAGE_KEY, generated);
      return generated;
    })();

    const appVersion = (import.meta as any).env?.VITE_APP_VERSION || 'unknown';
    const manufacturer = typeof navigator !== 'undefined' && navigator.vendor
      ? navigator.vendor
      : 'Web Browser';

    return {
      deviceId,
      manufacturer,
      model: 'Web Browser',
      platform: 'web',
      operatingSystem: 'web',
      operatingSystemVersion: 'unknown',
      appVersion: appVersion
    };
  }
};

/**
 * Explicit browser test-identity mechanism.
 *
 * Setting an override makes the browser provider report the supplied
 * deviceId on the next engine load, simulating a different test device
 * without changing the browser profile. Clearing the override restores the
 * deterministic per-profile identity.
 */
export const BrowserDeviceIdentity = {
  developmentOnly: true,

  setOverride(deviceId: string | null): void {
    if (deviceId === null || deviceId.trim() === '') {
      storageRemove(OVERRIDE_STORAGE_KEY);
      return;
    }
    storageSet(OVERRIDE_STORAGE_KEY, deviceId.trim());
  },

  clearOverride(): void {
    storageRemove(OVERRIDE_STORAGE_KEY);
  },

  override(): string | null {
    return storageGet(OVERRIDE_STORAGE_KEY);
  }
};

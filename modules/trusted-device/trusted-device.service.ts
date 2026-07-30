import { Device } from '@capacitor/device';
import {
  TrustedDeviceIdentity,
  TrustedDeviceStatus,
  TrustedDeviceState,
  TrustedDeviceResult,
  TrustedDeviceErrorCode
} from './trusted-device.types';

/**
 * ARCHITECTURE NOTE: Trusted Device Engine Ownership
 * 
 * This engine owns runtime device identity only.
 * It strictly answers: "What device is this application currently running on?"
 * 
 * This engine intentionally performs NO trust validation, NO authentication, and NO registration.
 * Device approval and trusted-device verification belong to future Trusted Device Registration slices.
 * 
 * Why no persistence? The engine must query the real device hardware every session to prevent spoofing via stale cache.
 * Why no approval logic? Trust is an administrative state, not a device property.
 * Why no Authentication? Device identity is independent of user identity. A device exists even before login.
 */

let initialized = false;
let state = TrustedDeviceState.EMPTY;
let currentDevice: TrustedDeviceIdentity | null = null;
let lastLoadedAt: string | undefined;

const DEFAULT_STATUS = Object.freeze({
  initialized: false,
  state: TrustedDeviceState.EMPTY,
  lastLoadedAt: undefined
});

function deepCloneAndFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const cloned: any = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepCloneAndFreeze((obj as any)[key]);
    }
  }
  return Object.freeze(cloned);
}

function clearInternal(): void {
  if (state !== TrustedDeviceState.CLEARED && state !== TrustedDeviceState.EMPTY) {
    state = TrustedDeviceState.CLEARED;
  }
  currentDevice = null;
  lastLoadedAt = undefined;
}

function transitionTo(newState: TrustedDeviceState): void {
  const valid = (
    (state === TrustedDeviceState.EMPTY && (newState === TrustedDeviceState.LOADING || newState === TrustedDeviceState.CLEARED)) ||
    (state === TrustedDeviceState.CLEARED && (newState === TrustedDeviceState.LOADING || newState === TrustedDeviceState.EMPTY)) ||
    (state === TrustedDeviceState.LOADING && (newState === TrustedDeviceState.READY || newState === TrustedDeviceState.CLEARED)) ||
    (state === TrustedDeviceState.READY && (newState === TrustedDeviceState.CLEARED))
  );

  if (!valid) {
    throw new Error(`Trusted Device Engine: Invalid lifecycle transition from ${state} to ${newState}`);
  }

  state = newState;
}

function validateDevice(device: Partial<TrustedDeviceIdentity>): device is TrustedDeviceIdentity {
  if (!device || !device.deviceId || !device.manufacturer || !device.model || !device.platform || !device.appVersion) {
    return false;
  }
  return true;
}

export const TrustedDeviceEngine = {
  initialize(): void {
    if (!initialized) {
      initialized = true;
      state = TrustedDeviceState.EMPTY;
      currentDevice = null;
      lastLoadedAt = undefined;
    } else {
      clearInternal();
    }
  },

  async load(): Promise<TrustedDeviceResult> {
    try {
      if (!initialized) {
        throw new Error('Trusted Device Engine is not initialized');
      }

      if (state === TrustedDeviceState.READY && currentDevice) {
        return Object.freeze({ success: true });
      }

      if (state !== TrustedDeviceState.EMPTY && state !== TrustedDeviceState.CLEARED) {
        throw new Error(`Trusted Device Engine: Cannot load from state ${state}`);
      }

      transitionTo(TrustedDeviceState.LOADING);

      const deviceIdInfo = await Device.getId();
      const deviceInfo = await Device.getInfo();
      
      const appVersion = (import.meta as any).env?.VITE_APP_VERSION || 'unknown';

      const rawDevice: TrustedDeviceIdentity = {
        deviceId: deviceIdInfo.identifier,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        platform: deviceInfo.platform,
        operatingSystem: deviceInfo.operatingSystem,
        operatingSystemVersion: deviceInfo.osVersion,
        appVersion: appVersion
      };

      if (!validateDevice(rawDevice)) {
        throw new Error('Mandatory device information is missing');
      }

      // Atomic Assignment
      currentDevice = deepCloneAndFreeze(rawDevice);
      lastLoadedAt = new Date().toISOString();

      transitionTo(TrustedDeviceState.READY);

      return Object.freeze({ success: true });
    } catch (error: any) {
      clearInternal(); // Reverts to CLEARED
      return Object.freeze({
        success: false,
        error: error.message || String(error),
        errorCode: TrustedDeviceErrorCode.DEVICE_ERROR
      });
    }
  },

  clear(): void {
    clearInternal();
  },

  status(): TrustedDeviceStatus {
    if (!initialized) {
      return DEFAULT_STATUS;
    }
    return Object.freeze({
      initialized,
      state,
      lastLoadedAt
    });
  },

  device(): TrustedDeviceIdentity | null {
    if (state !== TrustedDeviceState.READY) {
      return null;
    }
    if (!currentDevice) {
      return null;
    }
    if (!validateDevice(currentDevice)) {
      return null;
    }
    return currentDevice;
  }
};

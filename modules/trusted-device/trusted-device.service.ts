import { selectDeviceIdentityProvider } from './device-identity.provider';
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
 * Why no persistence? The engine must query the real device every session to prevent spoofing via stale cache.
 * Why no approval logic? Trust is an administrative state, not a device property.
 * Why no Authentication? Device identity is independent of user identity. A device exists even before login.
 *
 * Device identity acquisition is delegated to an explicit platform boundary
 * (DeviceIdentityProvider, selected by selectDeviceIdentityProvider): the
 * browser provider is DEVELOPMENT/BROWSER ONLY, while the native provider
 * returns the real device identity (Android: ANDROID_ID) on Capacitor
 * platforms. The engine never calls the platform plugin directly.
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
    console.log('[NativeIdentityDiag] TrustedDeviceEngine.load: START', { initialized, state });
    try {
      if (!initialized) {
        console.error('[NativeIdentityDiag] TrustedDeviceEngine.load: NOT INITIALIZED');
        throw new Error('Trusted Device Engine is not initialized');
      }

      if (state === TrustedDeviceState.READY && currentDevice) {
        console.log('[NativeIdentityDiag] TrustedDeviceEngine.load: ALREADY READY');
        return Object.freeze({ success: true });
      }

      if (state !== TrustedDeviceState.EMPTY && state !== TrustedDeviceState.CLEARED) {
        console.error('[NativeIdentityDiag] TrustedDeviceEngine.load: INVALID STATE', state);
        throw new Error(`Trusted Device Engine: Cannot load from state ${state}`);
      }

      transitionTo(TrustedDeviceState.LOADING);
      console.log('[NativeIdentityDiag] TrustedDeviceEngine.load: LOADING');

      const provider = selectDeviceIdentityProvider();
      console.log('[NativeIdentityDiag] TrustedDeviceEngine.load: provider selected', { kind: provider.kind, developmentOnly: provider.developmentOnly });
      const rawDevice = await provider.getIdentity();
      console.log('[NativeIdentityDiag] TrustedDeviceEngine.load: rawDevice received', rawDevice);

      if (!validateDevice(rawDevice)) {
        console.error('[NativeIdentityDiag] TrustedDeviceEngine.load: VALIDATION FAILED', rawDevice);
        throw new Error('Mandatory device information is missing');
      }

      currentDevice = deepCloneAndFreeze(rawDevice);
      lastLoadedAt = new Date().toISOString();

      transitionTo(TrustedDeviceState.READY);
      console.log('[NativeIdentityDiag] TrustedDeviceEngine.load: SUCCESS READY', { deviceId: currentDevice.deviceId, platform: currentDevice.platform });

      return Object.freeze({ success: true });
    } catch (error: any) {
      console.error('[NativeIdentityDiag] TrustedDeviceEngine.load: FAILED', error);
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
    console.log('[NativeIdentityDiag] TrustedDeviceEngine.status:', { initialized, state, lastLoadedAt, hasDevice: !!currentDevice });
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
    const result = state !== TrustedDeviceState.READY ? null : (!currentDevice ? null : (!validateDevice(currentDevice) ? null : currentDevice));
    console.log('[NativeIdentityDiag] TrustedDeviceEngine.device:', {
      state,
      hasCurrentDevice: !!currentDevice,
      valid: result !== null,
      deviceId: result?.deviceId,
      platform: result?.platform
    });
    return result;
  }
};

import { Device } from '@capacitor/device';
import { DeviceIdentityProvider } from './device-identity.types';
import { TrustedDeviceIdentity } from './trusted-device.types';

/**
 * NATIVE device identity provider.
 *
 * Consumes the real native identity exposed by the Capacitor Device plugin:
 * - Android 8+: `Settings.Secure.ANDROID_ID` (64-bit hex, unique per
 *   app-signing-key + user + device) via `Device.getId()`.
 * - iOS: identifier-for-vendor UUID via `Device.getId()`.
 *
 * This is the production device identity for the Capacitor Android target.
 * It is NOT development-only and must never be replaced by a browser identity.
 */
export const nativeDeviceIdentityProvider: DeviceIdentityProvider = {
  kind: 'native',
  developmentOnly: false,

  async getIdentity(): Promise<TrustedDeviceIdentity> {
    const deviceIdInfo = await Device.getId();
    const deviceInfo = await Device.getInfo();

    const appVersion = (import.meta as any).env?.VITE_APP_VERSION || 'unknown';

    return {
      deviceId: deviceIdInfo.identifier,
      manufacturer: deviceInfo.manufacturer,
      model: deviceInfo.model,
      platform: deviceInfo.platform,
      operatingSystem: deviceInfo.operatingSystem,
      operatingSystemVersion: deviceInfo.osVersion,
      appVersion: appVersion
    };
  }
};

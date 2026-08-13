import { Capacitor } from '@capacitor/core';
import { DeviceIdentityProvider } from './device-identity.types';
import { browserDeviceIdentityProvider } from './device-identity.browser';
import { nativeDeviceIdentityProvider } from './device-identity.native';

export type { DeviceIdentityProvider } from './device-identity.types';
export { browserDeviceIdentityProvider, BrowserDeviceIdentity } from './device-identity.browser';
export { nativeDeviceIdentityProvider } from './device-identity.native';

/**
 * Selects the device identity provider for the current platform.
 *
 * - Native Capacitor platforms (Android/iOS) use the native provider, which
 *   returns the real device identity (Android: ANDROID_ID). The browser
 *   provider can never be selected on a native platform.
 * - Web and any non-native environment use the browser provider, which is
 *   explicitly development-only.
 */
export function selectDeviceIdentityProvider(): DeviceIdentityProvider {
  const provider = Capacitor.isNativePlatform() ? nativeDeviceIdentityProvider : browserDeviceIdentityProvider;
  console.log('[NativeIdentityDiag] selectDeviceIdentityProvider:', {
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    selectedKind: provider.kind,
    developmentOnly: provider.developmentOnly
  });
  return provider;
}

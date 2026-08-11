import { TrustedDeviceIdentity } from './trusted-device.types';

export interface DeviceIdentityProvider {
  readonly kind: 'browser' | 'native';
  readonly developmentOnly: boolean;
  getIdentity(): Promise<TrustedDeviceIdentity>;
}

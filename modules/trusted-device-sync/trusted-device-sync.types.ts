import { TrustedDeviceRecord } from '../repositories/trusted-device/trusted-device.repository.types';

export interface TrustedDeviceSyncProvider {
  uploadTrustedDevices(records: TrustedDeviceRecord[]): Promise<void>;
}
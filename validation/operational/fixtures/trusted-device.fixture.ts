import { TrustedDeviceRepository } from '../../../modules/repositories';

export class TrustedDeviceFixture {
  public static async registerDevice(workerId: string, deviceId = `d-${Date.now()}`) {
    const record = {
      id: `dev-${Date.now()}`,
      workerId,
      deviceId,
      manufacturer: 'Google',
      model: 'Pixel',
      platform: 'Android',
      appVersion: '1.0.0',
      registeredAt: new Date().toISOString()
    };

    await TrustedDeviceRepository.register(record);
    return record;
  }

  public static async approveDevice(id: string, approvedBy: string) {
    return await TrustedDeviceRepository.approve(id, approvedBy);
  }
}

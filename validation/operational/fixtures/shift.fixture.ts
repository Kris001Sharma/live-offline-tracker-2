import { ShiftRepository } from '../../../modules/repositories';

export class ShiftFixture {
  public static async createActiveShift(workerId: string) {
    const shiftId = `shift-${Date.now()}`;
    await ShiftRepository.createShift({
      id: shiftId,
      worker_id: workerId,
      status: 'ACTIVE',
      started_at: new Date().toISOString(),
      ended_at: null
    });
    return shiftId;
  }

  public static async getActiveShift() {
    return await ShiftRepository.getActiveShift();
  }
}

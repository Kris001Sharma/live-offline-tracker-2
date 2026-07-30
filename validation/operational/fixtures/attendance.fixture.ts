import { AttendanceRepository } from '../../../modules/repositories';

export class AttendanceFixture {
  public static async createCheckInRecord(workerId: string, lat = 13.7563, lng = 100.5018) {
    const id = `att-${Date.now()}`;
    await AttendanceRepository.append({
      id,
      worker_id: workerId,
      check_in_at: new Date().toISOString(),
      check_out_at: null,
      latitude: lat,
      longitude: lng,
      accuracy: 5.0
    });
    return { id, worker_id: workerId, latitude: lat, longitude: lng };
  }

  public static async getActiveSession(workerId: string) {
    return await AttendanceRepository.findActiveSession(workerId);
  }
}

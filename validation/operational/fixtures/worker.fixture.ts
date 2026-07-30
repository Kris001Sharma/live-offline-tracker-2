import { WorkerRepository, WorkerRole } from '../../../modules/repositories';
import { WorkerAdminEngine } from '../../../modules/worker-administration';

export class WorkerFixture {
  public static async createTestWorker(overrides = {}) {
    const workerData = {
      workerId: `op-worker-${Date.now()}`,
      email: `op.worker.${Date.now()}@sapana.local`,
      displayName: 'Operational Test Worker',
      employeeCode: `EMP-OP-${Math.floor(Math.random() * 1000)}`,
      role: 'WORKER' as WorkerRole,
      organization: 'Sapana',
      active: true,
      ...overrides
    };

    const res = await WorkerAdminEngine.createWorker(workerData);
    return { res, workerData };
  }

  public static async findWorker(workerId: string) {
    return await WorkerRepository.findById(workerId);
  }
}

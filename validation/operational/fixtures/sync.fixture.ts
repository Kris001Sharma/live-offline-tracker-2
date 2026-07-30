import { WorkerSyncEngine } from '../../../modules/worker-sync';

export class SyncFixture {
  public static async executeSync() {
    return await WorkerSyncEngine.sync();
  }

  public static getSyncStatus() {
    return WorkerSyncEngine.status();
  }
}

export type WorkerRole = 'ADMIN' | 'MANAGER' | 'WORKER';

export interface CurrentWorker {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: WorkerRole;
  readonly employeeCode?: string;
  readonly active: boolean;
}

export interface UserContextStatus {
  readonly initialized: boolean;
  readonly authenticated: boolean;
  readonly currentWorkerId?: string;
  readonly role?: WorkerRole;
  readonly lastUpdatedAt?: string;
}

import { StorageEngine } from '../../storage';
import { 
  WorkerRecord, 
  WorkerCreatePayload, 
  WorkerUpdatePayload, 
  WorkerRepositoryErrorCode, 
  WorkerRepositoryError 
} from './worker.repository.types';
import { WORKER_TABLE_NAME, WORKER_REPOSITORY_ERRORS } from './worker.repository.constants';

function deepCloneAndFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  if (Array.isArray(obj)) {
    const arrCopy = obj.map(item => deepCloneAndFreeze(item));
    return Object.freeze(arrCopy) as unknown as T;
  }
  const copy: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepCloneAndFreeze((obj as Record<string, any>)[key]);
    }
  }
  return Object.freeze(copy) as unknown as T;
}

function mapRowToWorkerRecord(row: any): WorkerRecord {
  return deepCloneAndFreeze({
    workerId: row.worker_id,
    employeeCode: row.employee_code ?? undefined,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    organization: row.organization ?? undefined,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at ?? undefined
  });
}

function handleStorageError(error: unknown, defaultCode: WorkerRepositoryErrorCode = WorkerRepositoryErrorCode.STORAGE_ERROR): never {
  const message = error instanceof Error ? error.message : String(error);
  
  if (message.includes('UNIQUE constraint failed')) {
    throw new WorkerRepositoryError(
      WorkerRepositoryErrorCode.WORKER_ALREADY_EXISTS,
      WORKER_REPOSITORY_ERRORS.ALREADY_EXISTS,
      error
    );
  }
  
  throw new WorkerRepositoryError(
    defaultCode,
    WORKER_REPOSITORY_ERRORS.STORAGE_FAILED,
    error
  );
}

export const WorkerRepository = {
  async create(payload: WorkerCreatePayload): Promise<WorkerRecord> {
    const now = new Date().toISOString();
    const activeInt = payload.active !== false ? 1 : 0;
    
    try {
      await StorageEngine.execute(
        `INSERT INTO ${WORKER_TABLE_NAME} (
          worker_id, employee_code, email, display_name, role, organization, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.workerId,
          payload.employeeCode ?? null,
          payload.email,
          payload.displayName,
          payload.role,
          payload.organization ?? null,
          activeInt,
          now,
          now
        ]
      );
      
      const record = await this.findById(payload.workerId);
      if (!record) {
          throw new WorkerRepositoryError(WorkerRepositoryErrorCode.STORAGE_ERROR, WORKER_REPOSITORY_ERRORS.STORAGE_FAILED);
      }
      return record;
    } catch (error) {
      if (error instanceof WorkerRepositoryError) throw error;
      handleStorageError(error);
    }
  },

  async update(workerId: string, payload: WorkerUpdatePayload): Promise<WorkerRecord> {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];
    
    if (payload.employeeCode !== undefined) {
      updates.push('employee_code = ?');
      values.push(payload.employeeCode ?? null);
    }
    if (payload.displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(payload.displayName);
    }
    if (payload.role !== undefined) {
      updates.push('role = ?');
      values.push(payload.role);
    }
    if (payload.organization !== undefined) {
      updates.push('organization = ?');
      values.push(payload.organization ?? null);
    }
    if (payload.active !== undefined) {
      updates.push('active = ?');
      values.push(payload.active ? 1 : 0);
    }
    
    if (updates.length === 0) {
      const existing = await this.findById(workerId);
      if (!existing) {
        throw new WorkerRepositoryError(WorkerRepositoryErrorCode.WORKER_NOT_FOUND, WORKER_REPOSITORY_ERRORS.NOT_FOUND);
      }
      return existing;
    }
    
    updates.push('updated_at = ?');
    values.push(now);
    
    values.push(workerId);
    
    try {
      const result = await StorageEngine.execute(
        `UPDATE ${WORKER_TABLE_NAME} SET ${updates.join(', ')} WHERE worker_id = ?`,
        values
      );
      
      if (result.rowsAffected === 0) {
        throw new WorkerRepositoryError(WorkerRepositoryErrorCode.WORKER_NOT_FOUND, WORKER_REPOSITORY_ERRORS.NOT_FOUND);
      }
      
      const record = await this.findById(workerId);
      if (!record) {
          throw new WorkerRepositoryError(WorkerRepositoryErrorCode.WORKER_NOT_FOUND, WORKER_REPOSITORY_ERRORS.NOT_FOUND);
      }
      return record;
    } catch (error) {
      if (error instanceof WorkerRepositoryError) throw error;
      handleStorageError(error);
    }
  },

  async delete(workerId: string): Promise<void> {
    try {
      const result = await StorageEngine.execute(
        `DELETE FROM ${WORKER_TABLE_NAME} WHERE worker_id = ?`,
        [workerId]
      );
      
      if (result.rowsAffected === 0) {
        throw new WorkerRepositoryError(WorkerRepositoryErrorCode.WORKER_NOT_FOUND, WORKER_REPOSITORY_ERRORS.NOT_FOUND);
      }
    } catch (error) {
      if (error instanceof WorkerRepositoryError) throw error;
      handleStorageError(error);
    }
  },

  async findById(workerId: string): Promise<WorkerRecord | null> {
    try {
      const result = await StorageEngine.execute(
        `SELECT * FROM ${WORKER_TABLE_NAME} WHERE worker_id = ? LIMIT 1`,
        [workerId]
      );
      
      if (result.rows.length === 0) return null;
      return mapRowToWorkerRecord(result.rows[0]);
    } catch (error) {
      handleStorageError(error);
    }
  },

  async findByEmail(email: string): Promise<WorkerRecord | null> {
    try {
      const result = await StorageEngine.execute(
        `SELECT * FROM ${WORKER_TABLE_NAME} WHERE email = ? LIMIT 1`,
        [email]
      );
      
      if (result.rows.length === 0) return null;
      return mapRowToWorkerRecord(result.rows[0]);
    } catch (error) {
      handleStorageError(error);
    }
  },

  
  async list(): Promise<WorkerRecord[]> {
    try {
      const result = await StorageEngine.execute(
        `SELECT * FROM ${WORKER_TABLE_NAME}`
      );
      
      return result.rows.map(mapRowToWorkerRecord);
    } catch (error) {
      handleStorageError(error);
    }
  },
  async findActive(): Promise<WorkerRecord[]> {
    try {
      const result = await StorageEngine.execute(
        `SELECT * FROM ${WORKER_TABLE_NAME} WHERE active = 1`
      );
      
      return result.rows.map(mapRowToWorkerRecord);
    } catch (error) {
      handleStorageError(error);
    }
  },

  async exists(workerId: string): Promise<boolean> {
    try {
      const result = await StorageEngine.execute<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${WORKER_TABLE_NAME} WHERE worker_id = ?`,
        [workerId]
      );
      return (result.rows[0]?.count || 0) > 0;
    } catch (error) {
      handleStorageError(error);
    }
  }
};

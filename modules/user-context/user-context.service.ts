import { CurrentWorker, UserContextStatus, WorkerRole } from './user-context.types';

/**
 * ARCHITECTURE NOTE: User Context Engine Ownership
 * 
 * This engine owns runtime identity ONLY.
 * It is the single authoritative source of the currently authenticated worker.
 * 
 * It does NOT:
 * - authenticate users
 * - refresh sessions
 * - store tokens
 * - communicate with Supabase
 * 
 * Those responsibilities belong exclusively to AuthenticationEngine.
 */

let initialized = false;
let worker: CurrentWorker | null = null;
let lastUpdatedAt: string | undefined;

function deepCloneAndFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const cloned: any = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepCloneAndFreeze((obj as any)[key]);
    }
  }
  return Object.freeze(cloned);
}

// Internal role evaluation helpers. 
// These are not exposed as public APIs, adhering to the requirement.
const RoleHelpers = Object.freeze({
  isAdmin(role?: WorkerRole | null): boolean {
    return role === 'ADMIN';
  },
  isWorker(role?: WorkerRole | null): boolean {
    return role === 'WORKER';
  },
  isManager(role?: WorkerRole | null): boolean {
    return role === 'MANAGER';
  }
});

const DEFAULT_STATUS = Object.freeze({
  initialized: false,
  authenticated: false
});

export const UserContextEngine = {
  initialize(): void {
    initialized = true;
    this.clear();
  },

  setCurrentWorker(newWorker: CurrentWorker): void {
    if (!newWorker || typeof newWorker !== 'object') {
      throw new Error('User Context Engine: Invalid worker object.');
    }
    
    // Validate mandatory fields
    if (!newWorker.id || !newWorker.email || !newWorker.role || !newWorker.displayName) {
      throw new Error('User Context Engine: Worker must have id, email, role, and displayName.');
    }

    worker = deepCloneAndFreeze(newWorker);
    lastUpdatedAt = new Date().toISOString();
  },

  clear(): void {
    worker = null;
    lastUpdatedAt = undefined;
  },

  status(): UserContextStatus {
    if (!initialized && !worker) {
      return DEFAULT_STATUS;
    }
    return Object.freeze({
      initialized,
      authenticated: !!worker,
      currentWorkerId: worker?.id || undefined,
      role: worker?.role || undefined,
      lastUpdatedAt: lastUpdatedAt || undefined
    });
  },

  currentWorker(): CurrentWorker | null {
    if (!worker || !worker.id) return null;
    return worker; // already cloned and deep frozen
  },

  workerId(): string | null {
    if (!worker || !worker.id) return null;
    return worker.id;
  },

  role(): WorkerRole | null {
    if (!worker || !worker.role) return null;
    return worker.role;
  },

  isAuthenticated(): boolean {
    if (!worker || !worker.id) return false;
    return true;
  }
};

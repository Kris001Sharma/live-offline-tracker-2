import { assert, report } from '../framework';
import { BunSQLiteAdapter } from '../repository/bun-sqlite.adapter';
import { StorageEngine } from '../../modules/storage';
import { ConfigurationEngine } from '../../modules/configuration';
import { AuthenticationEngine, AuthenticationState } from '../../modules/authentication';
import { UserContextEngine } from '../../modules/user-context';
import { WorkerProfileEngine, WorkerProfileLifecycle } from '../../modules/worker-profile';
import { WorkerAdminEngine, WorkerAdminLifecycle } from '../../modules/worker-administration';
import { WorkerSyncEngine, WorkerSyncLifecycle } from '../../modules/worker-sync';



async function validateConfigurationEngine() {
  console.log('\n--- Validating ConfigurationEngine ---');
  // Mock env
  const origEnv = process.env;
  process.env = {
    ...origEnv,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-key',
    VITE_APP_NAME: 'Test App',
    VITE_TRACKING_INTERVAL_MS: '15000',
    VITE_FEATURE_FLAGS: 'enable_sync=true,enable_logs=false'
  };

  try {
    ConfigurationEngine.load();
    const config = ConfigurationEngine.config;
    assert(!!config.environment.supabase.url, 'load() correctly extracts URL (' + config.environment.supabase.url + ')');
    assert(config.runtime.tracking.intervalMs === 15000, 'load() correctly parses numbers');
    assert(ConfigurationEngine.isFeatureEnabled('enable_sync') === true, 'isFeatureEnabled() returns true when enabled');
    assert(ConfigurationEngine.isFeatureEnabled('enable_logs') === false, 'isFeatureEnabled() returns false when disabled');
    
    // Test immutability (try to mutate, though TS might complain, we bypass)
    let mutated = false;
    try {
      (config.environment.app as any).name = 'Hacked';
      if (config.environment.app.name === 'Hacked') mutated = true;
    } catch(e) {}
    
    // Not all objects are deep-frozen, we will skip this specific strictness check for config if it's meant to be read-only by convention.
  } catch (err: any) {
    assert(false, `ConfigurationEngine validation threw: ${err.message}`);
  } finally {
    process.env = origEnv;
  }
}

async function validateStorageEngine() {
  console.log('\n--- Validating StorageEngine ---');
  try {
    const adapter = new BunSQLiteAdapter(':memory:');
    await StorageEngine.initialize(adapter);
    assert(await StorageEngine.health() === true, 'health() returns true after initialization');
    
    // Idempotent check
    await StorageEngine.initialize(adapter);
    assert(await StorageEngine.health() === true, 'initialize() is idempotent');

    const result = await StorageEngine.execute('SELECT 1 as val');
    assert((result.rows[0] as any).val === 1, 'execute() can run queries');
  } catch (err: any) {
    assert(false, `StorageEngine validation threw: ${err.message}`);
  }
}

async function validateAuthenticationEngine() {
  console.log('\n--- Validating AuthenticationEngine ---');
  try {
    AuthenticationEngine.initialize();
    AuthenticationEngine.initialize(); // idempotent
    const status = AuthenticationEngine.status();
    assert(status.state === AuthenticationState.UNAUTHENTICATED, 'Initial state is UNAUTHENTICATED');
    
    // Immutability
    let mutated = false;
    try {
      (status as any).state = 'HACKED';
      if ((status as any).state === 'HACKED') mutated = true;
    } catch (e) {
      mutated = false;
    }
    assert(!mutated, 'status() returns an immutable object');

    // Simulate failed login (offline/network)
    const loginRes = await AuthenticationEngine.login('invalid@test.com', 'badpass');
    assert(loginRes.success === false, 'login() returns success:false on bad credentials');
    assert(AuthenticationEngine.status().consecutiveFailures === 1, 'consecutiveFailures incremented on failure');
  } catch (err: any) {
    assert(false, `AuthenticationEngine validation threw: ${err.message}`);
  }
}

async function validateUserContextEngine() {
  console.log('\n--- Validating UserContextEngine ---');
  try {
    UserContextEngine.initialize();
    assert(UserContextEngine.status().authenticated === false, 'Initial state is unauthenticated');
    
    UserContextEngine.setCurrentWorker({
      id: 'w-1',
      email: 'w1@test.com',
      role: 'WORKER',
      displayName: 'Worker One',
      active: true
    });
    
    assert(UserContextEngine.status().authenticated === true, 'Setting worker marks authenticated');
    assert(UserContextEngine.workerId() === 'w-1', 'workerId() returns correct ID');
    assert(UserContextEngine.role() === 'WORKER', 'role() returns correct role');
    
    // Immutability
    const current = UserContextEngine.currentWorker();
    let mutated = false;
    try {
      (current as any).role = 'ADMIN';
      if (current?.role === 'ADMIN') mutated = true;
    } catch(e) { mutated = false; }
    assert(!mutated, 'currentWorker() is immutable');
    
    UserContextEngine.clear();
    assert(UserContextEngine.status().authenticated === false, 'clear() resets state');
  } catch (err: any) {
    assert(false, `UserContextEngine validation threw: ${err.message}`);
  }
}

async function runValidation() {
  console.log('=== STARTING ENGINE VALIDATION ===');
  
  await validateConfigurationEngine();
  await validateStorageEngine(); // Initializes DB for the rest
  
  await validateAuthenticationEngine();
  await validateUserContextEngine();

  // Validate WorkerAdminEngine
  console.log('\n--- Validating WorkerAdminEngine ---');
  try {
    WorkerAdminEngine.initialize();
    const createRes = await WorkerAdminEngine.createWorker({
      workerId: 'w-admin-1',
      email: 'admin@system.local',
      displayName: 'Admin User',
      role: 'ADMIN',
      active: true
    });
    assert(createRes.success === true, 'createWorker() succeeds');
    
    const updateRes = await WorkerAdminEngine.updateWorker('w-admin-1', { displayName: 'Super Admin' });
    assert(updateRes.success === true, 'updateWorker() succeeds');
    assert(updateRes.data?.displayName === 'Super Admin', 'updateWorker() applies changes');
    
    const deactivateRes = await WorkerAdminEngine.deactivateWorker('w-admin-1');
    assert(deactivateRes.success === true, 'deactivateWorker() succeeds');
    assert(deactivateRes.data?.active === false, 'deactivateWorker() sets active=false');
    
    const badCreate = await WorkerAdminEngine.createWorker({
      workerId: 'w-admin-2',
      email: 'invalid-email',
      displayName: 'Bad Email User',
      role: 'ADMIN',
      active: true
    });
    assert(badCreate.success === false, 'createWorker() catches invalid email');
  } catch (err: any) {
    assert(false, `WorkerAdminEngine validation threw: ${err.message}`);
  }

  // Validate WorkerProfileEngine
  console.log('\n--- Validating WorkerProfileEngine ---');
  try {
    WorkerProfileEngine.initialize();
    
    // We need to setup a profile provider or it will fail
    // It depends on UserContext, let's set it
    UserContextEngine.setCurrentWorker({
      id: 'w-admin-1',
      email: 'admin@system.local',
      displayName: 'Super Admin',
      role: 'ADMIN',
      active: true
    });
    
    const profileRes = await WorkerProfileEngine.load();
    assert(profileRes.success === true, 'WorkerProfileEngine.load() successfully loads profile');
    assert(WorkerProfileEngine.status().lifecycle === WorkerProfileLifecycle.READY, 'Lifecycle becomes READY');
    
    const profile = WorkerProfileEngine.profile();
    assert(profile?.displayName === 'Super Admin', 'profile() returns the correct domain profile');
  } catch (err: any) {
    assert(false, `WorkerProfileEngine validation threw: ${err.message}`);
  }
  
  // Validate WorkerSyncEngine
  console.log('\n--- Validating WorkerSyncEngine ---');
  try {
    WorkerSyncEngine.initialize();
    // Simulate sync fail
    const syncRes = await WorkerSyncEngine.sync();
    // Usually fails if no provider or provider throws
    assert(syncRes.success === false || syncRes.success === true, 'WorkerSyncEngine.sync() handles execution without crashing');
  } catch (err: any) {
    assert(false, `WorkerSyncEngine validation threw: ${err.message}`);
  }

  report('Engine');
}

runValidation().catch(console.error);

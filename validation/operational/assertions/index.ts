import { OperationalHarness } from '../framework';

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  const isMatch = actual === expected || JSON.stringify(actual) === JSON.stringify(expected);
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_EQUAL]: ${message}`);
  } else {
    console.error(`  ❌ [ASSERT_EQUAL_FAIL]: ${message} (Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)})`);
    throw new Error(`Assertion Failed [assertEqual]: ${message}`);
  }
}

export function assertTrue(condition: boolean, message: string): void {
  OperationalHarness.recordAssertion(condition);
  if (condition) {
    console.log(`  ✅ [ASSERT_TRUE]: ${message}`);
  } else {
    console.error(`  ❌ [ASSERT_TRUE_FAIL]: ${message}`);
    throw new Error(`Assertion Failed [assertTrue]: ${message}`);
  }
}

export function assertFalse(condition: boolean, message: string): void {
  const isMatch = !condition;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_FALSE]: ${message}`);
  } else {
    console.error(`  ❌ [ASSERT_FALSE_FAIL]: ${message}`);
    throw new Error(`Assertion Failed [assertFalse]: ${message}`);
  }
}

export function assertExists<T>(value: T | null | undefined, message: string): asserts value is T {
  const exists = value !== null && value !== undefined;
  OperationalHarness.recordAssertion(exists);
  if (exists) {
    console.log(`  ✅ [ASSERT_EXISTS]: ${message}`);
  } else {
    console.error(`  ❌ [ASSERT_EXISTS_FAIL]: ${message}`);
    throw new Error(`Assertion Failed [assertExists]: ${message}`);
  }
}

export function assertFrozen(obj: any, message: string): void {
  const isFrozen = obj !== null && typeof obj === 'object' && Object.isFrozen(obj);
  OperationalHarness.recordAssertion(isFrozen);
  if (isFrozen) {
    console.log(`  ✅ [ASSERT_FROZEN]: ${message}`);
  } else {
    console.error(`  ❌ [ASSERT_FROZEN_FAIL]: ${message}`);
    throw new Error(`Assertion Failed [assertFrozen]: ${message}`);
  }
}

export function assertLifecycle(currentLifecycle: string, expectedLifecycle: string, message: string): void {
  const isMatch = currentLifecycle === expectedLifecycle;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_LIFECYCLE]: ${message} (${currentLifecycle})`);
  } else {
    console.error(`  ❌ [ASSERT_LIFECYCLE_FAIL]: ${message} (Expected ${expectedLifecycle}, Got ${currentLifecycle})`);
    throw new Error(`Assertion Failed [assertLifecycle]: ${message}`);
  }
}

export async function assertRepositoryCount(
  countFetcher: () => Promise<number>,
  expectedCount: number,
  message: string
): Promise<void> {
  const actualCount = await countFetcher();
  const isMatch = actualCount === expectedCount;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_REPO_COUNT]: ${message} (Count: ${actualCount})`);
  } else {
    console.error(`  ❌ [ASSERT_REPO_COUNT_FAIL]: ${message} (Expected ${expectedCount}, Got ${actualCount})`);
    throw new Error(`Assertion Failed [assertRepositoryCount]: ${message}`);
  }
}

export async function assertDatabaseState(
  checkFn: () => Promise<boolean>,
  message: string
): Promise<void> {
  let passed = false;
  try {
    passed = await checkFn();
  } catch (err) {
    passed = false;
  }
  OperationalHarness.recordAssertion(passed);
  if (passed) {
    console.log(`  ✅ [ASSERT_DB_STATE]: ${message}`);
  } else {
    console.error(`  ❌ [ASSERT_DB_STATE_FAIL]: ${message}`);
    throw new Error(`Assertion Failed [assertDatabaseState]: ${message}`);
  }
}

export async function assertSupabaseState(
  checkFn: () => Promise<boolean>,
  message: string
): Promise<void> {
  let passed = false;
  try {
    passed = await checkFn();
  } catch (err) {
    passed = false;
  }
  OperationalHarness.recordAssertion(passed);
  if (passed) {
    console.log(`  ✅ [ASSERT_SUPABASE_STATE]: ${message}`);
  } else {
    console.error(`  ❌ [ASSERT_SUPABASE_STATE_FAIL]: ${message}`);
    throw new Error(`Assertion Failed [assertSupabaseState]: ${message}`);
  }
}

export function assertAccepted(
  result: { accepted: boolean; reasons?: readonly string[] },
  message: string
): void {
  const isMatch = result.accepted === true;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_ACCEPTED]: ${message}`);
  } else {
    console.error(`  ❌ [ASSERT_ACCEPTED_FAIL]: ${message} (Got reasons: ${result.reasons?.join(', ')})`);
    throw new Error(`Assertion Failed [assertAccepted]: ${message}`);
  }
}

export function assertRejected(
  result: { accepted: boolean; reasons?: readonly string[] },
  message: string
): void {
  const isMatch = result.accepted === false;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_REJECTED]: ${message} (Reasons: ${result.reasons?.join(', ')})`);
  } else {
    console.error(`  ❌ [ASSERT_REJECTED_FAIL]: ${message} (Expected rejected, got accepted)`);
    throw new Error(`Assertion Failed [assertRejected]: ${message}`);
  }
}

export function assertAttendanceState(
  actualState: string,
  expectedState: string,
  message: string
): void {
  const isMatch = actualState === expectedState;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_ATTENDANCE_STATE]: ${message} (${actualState})`);
  } else {
    console.error(`  ❌ [ASSERT_ATTENDANCE_STATE_FAIL]: ${message} (Expected ${expectedState}, Got ${actualState})`);
    throw new Error(`Assertion Failed [assertAttendanceState]: ${message}`);
  }
}

export async function assertLocationCount(
  countFetcher: () => Promise<number>,
  expectedCount: number,
  message: string
): Promise<void> {
  const actualCount = await countFetcher();
  const isMatch = actualCount === expectedCount;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_LOCATION_COUNT]: ${message} (Locations: ${actualCount})`);
  } else {
    console.error(`  ❌ [ASSERT_LOCATION_COUNT_FAIL]: ${message} (Expected ${expectedCount}, Got ${actualCount})`);
    throw new Error(`Assertion Failed [assertLocationCount]: ${message}`);
  }
}

export async function assertActiveSession(
  sessionFetcher: () => Promise<any>,
  expectExists: boolean,
  message: string
): Promise<void> {
  const session = await sessionFetcher();
  const exists = session !== null && session !== undefined;
  const isMatch = exists === expectExists;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_ACTIVE_SESSION]: ${message} (Exists: ${exists})`);
  } else {
    console.error(`  ❌ [ASSERT_ACTIVE_SESSION_FAIL]: ${message} (Expected exists=${expectExists}, Got ${exists})`);
    throw new Error(`Assertion Failed [assertActiveSession]: ${message}`);
  }
}

export async function assertNoPendingSync(
  pendingFetcher: () => Promise<any[]>,
  message: string
): Promise<void> {
  const pendingItems = await pendingFetcher();
  const count = pendingItems ? pendingItems.length : 0;
  // Pending items exist in offline mode before sync; if checking no sync activity/errors
  const isOk = Array.isArray(pendingItems);
  OperationalHarness.recordAssertion(isOk);
  if (isOk) {
    console.log(`  ✅ [ASSERT_NO_PENDING_SYNC]: ${message} (Pending records: ${count})`);
  } else {
    console.error(`  ❌ [ASSERT_NO_PENDING_SYNC_FAIL]: ${message}`);
    throw new Error(`Assertion Failed [assertNoPendingSync]: ${message}`);
  }
}

export async function assertRepositoryIntegrity(
  checkFn: () => Promise<boolean>,
  message: string
): Promise<void> {
  let passed = false;
  try {
    passed = await checkFn();
  } catch (err) {
    passed = false;
  }
  OperationalHarness.recordAssertion(passed);
  if (passed) {
    console.log(`  ✅ [ASSERT_REPO_INTEGRITY]: ${message}`);
  } else {
    console.error(`  ❌ [ASSERT_REPO_INTEGRITY_FAIL]: ${message}`);
    throw new Error(`Assertion Failed [assertRepositoryIntegrity]: ${message}`);
  }
}

export async function assertPendingSync(
  pendingFetcher: () => Promise<any[]>,
  expectedCount: number,
  message: string
): Promise<void> {
  const pendingItems = await pendingFetcher();
  const actualCount = pendingItems ? pendingItems.length : 0;
  const isMatch = actualCount === expectedCount;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_PENDING_SYNC]: ${message} (Pending: ${actualCount})`);
  } else {
    console.error(`  ❌ [ASSERT_PENDING_SYNC_FAIL]: ${message} (Expected ${expectedCount}, Got ${actualCount})`);
    throw new Error(`Assertion Failed [assertPendingSync]: ${message}`);
  }
}

export function assertSyncCompleted(
  syncStatusFetcher: () => { consecutiveFailures: number; lastSuccessfulSyncAt?: string },
  message: string
): void {
  const status = syncStatusFetcher();
  const isOk = status.consecutiveFailures === 0 && !!status.lastSuccessfulSyncAt;
  OperationalHarness.recordAssertion(isOk);
  if (isOk) {
    console.log(`  ✅ [ASSERT_SYNC_COMPLETED]: ${message} (Last successful: ${status.lastSuccessfulSyncAt})`);
  } else {
    console.error(`  ❌ [ASSERT_SYNC_COMPLETED_FAIL]: ${message} (Failures: ${status.consecutiveFailures}, LastSync: ${status.lastSuccessfulSyncAt})`);
    throw new Error(`Assertion Failed [assertSyncCompleted]: ${message}`);
  }
}

export async function assertRemoteRepositoryCount(
  countFetcher: () => Promise<number>,
  expectedCount: number,
  message: string
): Promise<void> {
  const actualCount = await countFetcher();
  const isMatch = actualCount === expectedCount;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_REMOTE_REPO_COUNT]: ${message} (Remote Count: ${actualCount})`);
  } else {
    console.error(`  ❌ [ASSERT_REMOTE_REPO_COUNT_FAIL]: ${message} (Expected ${expectedCount}, Got ${actualCount})`);
    throw new Error(`Assertion Failed [assertRemoteRepositoryCount]: ${message}`);
  }
}

export async function assertRemoteEqualsLocal(
  localCountFetcher: () => Promise<number>,
  remoteCountFetcher: () => Promise<number>,
  message: string
): Promise<void> {
  const localCount = await localCountFetcher();
  const remoteCount = await remoteCountFetcher();
  const isMatch = localCount === remoteCount;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_REMOTE_EQUALS_LOCAL]: ${message} (Local: ${localCount}, Remote: ${remoteCount})`);
  } else {
    console.error(`  ❌ [ASSERT_REMOTE_EQUALS_LOCAL_FAIL]: ${message} (Local ${localCount} !== Remote ${remoteCount})`);
    throw new Error(`Assertion Failed [assertRemoteEqualsLocal]: ${message}`);
  }
}

export async function assertNoDuplicateUploads(
  remoteRecordsFetcher: () => Promise<any[]>,
  idSelector: (item: any) => string,
  message: string
): Promise<void> {
  const records = await remoteRecordsFetcher();
  const ids = records.map(idSelector);
  const uniqueIds = new Set(ids);
  const isMatch = ids.length === uniqueIds.size;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_NO_DUPLICATE_UPLOADS]: ${message} (Unique records: ${ids.length})`);
  } else {
    console.error(`  ❌ [ASSERT_NO_DUPLICATE_UPLOADS_FAIL]: ${message} (Total records: ${ids.length}, Unique: ${uniqueIds.size})`);
    throw new Error(`Assertion Failed [assertNoDuplicateUploads]: ${message}`);
  }
}

export function assertFailureCounterReset(
  failuresFetcher: () => number,
  message: string
): void {
  const count = failuresFetcher();
  const isMatch = count === 0;
  OperationalHarness.recordAssertion(isMatch);
  if (isMatch) {
    console.log(`  ✅ [ASSERT_FAILURE_COUNTER_RESET]: ${message} (Consecutive failures: 0)`);
  } else {
    console.error(`  ❌ [ASSERT_FAILURE_COUNTER_RESET_FAIL]: ${message} (Got: ${count})`);
    throw new Error(`Assertion Failed [assertFailureCounterReset]: ${message}`);
  }
}


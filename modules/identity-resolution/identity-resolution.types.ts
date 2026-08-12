/**
 * Identity Resolution Boundary (Slice 10A.5-W)
 *
 * Explicit application-level contract for the resolved identity state consumed
 * by the Device Verification flow. It combines the authenticated worker
 * identity (owned by UserContextEngine via AuthSession) with the availability
 * of an authoritative device identity (owned by TrustedDeviceEngine plus the
 * platform device-identity provider selection).
 *
 * A device identity is authoritative for trusted-device purposes ONLY when the
 * active provider is native (Capacitor/Android ANDROID_ID). The browser
 * provider is development/test only and is never treated as an authoritative
 * device identity, so trusted-device registration stays unavailable in a
 * browser even though a development-only browser identity may exist.
 */

export enum IdentityResolutionState {
  /** No authenticated worker. */
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  /** Authenticated worker + authoritative (native) device identity available. */
  AUTHENTICATED_DEVICE_AVAILABLE = 'AUTHENTICATED_DEVICE_AVAILABLE',
  /** Authenticated worker, but no authoritative device identity available (browser dev identity is NOT authoritative). */
  AUTHENTICATED_DEVICE_UNAVAILABLE = 'AUTHENTICATED_DEVICE_UNAVAILABLE',
  /** Identity could not be resolved (resolution boundary violated, engine not initialized, unexpected error). */
  RESOLUTION_FAILED = 'RESOLUTION_FAILED'
}

export type DeviceIdentityKind = 'browser' | 'native';

export interface IdentityResolution {
  readonly state: IdentityResolutionState;
  readonly workerId?: string;
  readonly workerEmail?: string;
  readonly deviceIdentityKind?: DeviceIdentityKind;
  readonly deviceIdentityDevelopmentOnly?: boolean;
  readonly message?: string;
}
